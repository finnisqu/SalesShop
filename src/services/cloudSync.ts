import { supabase } from '../lib/supabase';
import {timeStartupStep} from './appLifecycleDiagnostics';
import {
  CLOUD_DOCUMENT_SAVED_EVENT,
  readLocalDocument,
  removeLocalDocument,
  writeLocalDocument,
  type CloudDocumentKey,
  type CloudDocumentSavedDetail,
} from '../data/cloudAwareStorage';
import type { CrmDocument } from '../types/crm';
import type { QuoteDocument } from '../types/quote';
import type { SignatureDocument } from '../types/signature';
import type {NotebookDocument} from '../types/notebook';
import {markPendingNotebookSync,readPendingNotebookSync,clearPendingNotebookSync,mergePendingNotebookChanges} from './notebookCloudRecovery';
import { loadNormalizedCrm, syncNormalizedCrm } from './normalizedCrmSync';
import { loadNormalizedQuotes, syncNormalizedQuotes } from './normalizedQuoteSync';
import {markPendingQuoteSync,clearPendingQuoteSync,readPendingQuoteSync,mergePendingQuoteDrafts} from './quoteCloudRecovery';
import {markPendingCrmSync,clearPendingCrmSync,readPendingCrmSync,mergePendingCrmChanges} from './crmCloudRecovery';
import {useQuoteCloudStatusStore} from '../store/quoteCloudStatusStore';
import { loadNormalizedSignatures, syncNormalizedSignatures } from './normalizedSignatureSync';

const CRM_DOCUMENT_KEY: CloudDocumentKey = 'crm';
const QUOTES_DOCUMENT_KEY: CloudDocumentKey = 'quotes';
const SIGNATURES_DOCUMENT_KEY: CloudDocumentKey = 'signatures';
const PRIVATE_DOCUMENT_KEY: CloudDocumentKey = 'notebook';
const CACHE_SCOPE_KEY = 'salesshop-cloud-cache-scope-v1';
const pending = new Map<CloudDocumentKey, number>();
let activeCleanup: (() => void) | null = null;

interface CacheScope {
  userId: string;
  organizationId: string;
}

function emptyCrmDocument(): CrmDocument {
  return { schemaVersion: 3, companies: [], contacts: [], projects: [], activities: [] };
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function starterQuoteDocument(userId: string): QuoteDocument {
  const timestamp = new Date().toISOString();
  const date = localDateKey();
  const quoteId = `quote_${crypto.randomUUID()}`;
  return {
    schemaVersion: 2,
    activeQuoteId: quoteId,
    quotes: [{
      id: quoteId,
      quoteNumber: `DRAFT-${quoteId}`,
      documentType: 'quote',
      originalQuoteDate: date,
      quoteDate: date,
      revision: 0,
      status: 'Draft',
      ownerUserId: userId,
      title: 'Untitled quote',
      sections: [],
      lines: [{
        id: `line_${crypto.randomUUID()}`,
        kind: 'item',
        description: 'New line item',
        pricingMode: 'direct',
        amount: 0,
        customerVisible: true,
        includeInTotal: true,
      }],
      customerColumns: { quantity: false, rate: false, lineAmount: true },
      customerNotes: '',
      internalNotes: '',
      history: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
  };
}

function emptySignatureDocument(): SignatureDocument {
  return { schemaVersion: 1, signatures: [] };
}

function readCacheScope(): CacheScope | null {
  try {
    const raw = localStorage.getItem(CACHE_SCOPE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CacheScope>;
    return value.userId && value.organizationId
      ? { userId: value.userId, organizationId: value.organizationId }
      : null;
  } catch {
    return null;
  }
}

function writeCacheScope(scope: CacheScope) {
  localStorage.setItem(CACHE_SCOPE_KEY, JSON.stringify(scope));
}

async function upsertPrivateDocument(userId: string, document: unknown) {
  if (!supabase) return;
  const { error } = await supabase.from('private_documents').upsert({
    owner_id: userId,
    document_key: PRIVATE_DOCUMENT_KEY,
    document,
  }, { onConflict: 'owner_id,document_key' });
  if (error) throw error;
}

export async function ensureCurrentWorkspace() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('ensure_current_workspace');
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('SalesShop could not resolve a workspace.');
  return data;
}

export async function hydrateCloudDocuments(orgId: string, userId: string, options: {
  allowCompanySeed?: boolean;
  allowNotebookSeed?: boolean;
  allowCrmRecovery?: boolean;
  allowQuoteRecovery?: boolean;
  isCurrent?: () => boolean;
} = {}) {
  if (!supabase) return;
  const assertCurrent=()=>{
    if(options.isCurrent?.()===false)
      throw new Error('Workspace changed while loading cloud records.');
  };
  const writeHydrated=(key:CloudDocumentKey,value:unknown)=>{
    assertCurrent();
    writeLocalDocument(key,value,false);
  };
  const removeHydrated=(key:CloudDocumentKey)=>{
    assertCurrent();
    removeLocalDocument(key);
  };

  const previousScope = readCacheScope();
  // A previously hydrated cloud cache is never an authoritative company seed.
  const canSeedOrgFromLocal = options.allowCompanySeed === true && !previousScope;
  const canSeedNotebookFromLocal = options.allowNotebookSeed !== false && (!previousScope || previousScope.userId === userId);

  // Parallelize READS only, after membership/organization authorization is
  // established by authStore. Keep the existing CRM -> Quotes -> Signatures ->
  // Notebook write and seed sequence, including pending-quote recovery.
  // The old org_documents.crm row is rollback-only.
  const localCrm = readLocalDocument(CRM_DOCUMENT_KEY) as CrmDocument | null;
  const localQuotes = readLocalDocument(QUOTES_DOCUMENT_KEY) as QuoteDocument | null;
  const preferredActiveQuoteId = localQuotes?.schemaVersion === 2 ? localQuotes.activeQuoteId : null;
  const [normalizedCrm, normalizedQuotes, normalizedSignatures, notebookResult] = await Promise.all([
    timeStartupStep('crm',()=>loadNormalizedCrm(orgId)),
    timeStartupStep('quotes',()=>loadNormalizedQuotes(orgId, preferredActiveQuoteId)),
    timeStartupStep('signatures',()=>loadNormalizedSignatures(orgId)),
    timeStartupStep('notebook',()=>supabase!.from('private_documents')
      .select('document').eq('owner_id',userId)
      .eq('document_key',PRIVATE_DOCUMENT_KEY).maybeSingle()),
  ]);
  assertCurrent();
  // The existing local cache is not authoritative: recover only rows recorded
  // by a same-user/same-org write-ahead marker, and only if newer than cloud.
  // Viewers and identity switches must never replay writable CRM data.
  const ownCache=previousScope?.userId===userId&&previousScope.organizationId===orgId;
  const pendingCrm=ownCache&&options.allowCrmRecovery!==false
    ?readPendingCrmSync({organizationId:orgId,userId}):null;
  const recoveredCrm=mergePendingCrmChanges(normalizedCrm,localCrm,pendingCrm);
  if (recoveredCrm) {
    writeHydrated(CRM_DOCUMENT_KEY, recoveredCrm);
  } else if (canSeedOrgFromLocal) {
    if (localCrm?.schemaVersion === 3) {
      assertCurrent();
      await syncNormalizedCrm(orgId, localCrm);
    } else {
      writeHydrated(CRM_DOCUMENT_KEY, emptyCrmDocument());
    }
  } else {
    writeHydrated(CRM_DOCUMENT_KEY, emptyCrmDocument());
  }

  // Quotes use normalized current rows + immutable revision snapshots.
  const pendingQuoteSync=ownCache&&options.allowQuoteRecovery!==false
    ?readPendingQuoteSync({organizationId:orgId,userId}):null;
  // Keep only explicitly pending drafts owned by this user. A stale local
  // cache cannot overwrite issued revisions, archived rows or anyone else's
  // quotes, even if the server has newer versions.
  const recoveredQuotes=mergePendingQuoteDrafts(normalizedQuotes,localQuotes,pendingQuoteSync);
  if (recoveredQuotes) {
    writeHydrated(QUOTES_DOCUMENT_KEY,recoveredQuotes);
  } else if (canSeedOrgFromLocal && localQuotes?.schemaVersion === 2 &&
    localQuotes.quotes.length > 0 && localQuotes.quotes.every(quote=>quote.ownerUserId===userId)) {
    assertCurrent();
    await syncNormalizedQuotes(orgId, localQuotes);
    const seededQuotes = await loadNormalizedQuotes(orgId, preferredActiveQuoteId);
    writeHydrated(QUOTES_DOCUMENT_KEY, seededQuotes ?? localQuotes);
  } else {
    // Collaborators never seed a company with their own local/demo data.
    // Only a workspace owner initializing a new shop creates the starter quote.
    if (canSeedOrgFromLocal) {
      const starter = starterQuoteDocument(userId);
      assertCurrent();
      await syncNormalizedQuotes(orgId, starter);
      writeHydrated(QUOTES_DOCUMENT_KEY, starter);
    } else {
      writeHydrated(QUOTES_DOCUMENT_KEY, { schemaVersion: 2, activeQuoteId: null, quotes: [] });
    }
  }

  // Signatures are immutable business records. Existing cloud records always win.
  if (normalizedSignatures) {
    writeHydrated(SIGNATURES_DOCUMENT_KEY, normalizedSignatures);
  } else if (canSeedOrgFromLocal) {
    const localSignatures = readLocalDocument(SIGNATURES_DOCUMENT_KEY) as SignatureDocument | null;
    if (localSignatures?.schemaVersion === 1) {
      assertCurrent();
      await syncNormalizedSignatures(orgId, localSignatures);
      const seededSignatures = await loadNormalizedSignatures(orgId);
      writeHydrated(SIGNATURES_DOCUMENT_KEY, seededSignatures ?? emptySignatureDocument());
    } else {
      writeHydrated(SIGNATURES_DOCUMENT_KEY, emptySignatureDocument());
    }
  } else {
    writeHydrated(SIGNATURES_DOCUMENT_KEY, emptySignatureDocument());
  }

  // Notebook remains intentionally private and document-shaped.
  const { data: notebookRow, error: notebookError } = notebookResult;
  if (notebookError) throw notebookError;

  // Recover only marked, newer pages from the same user's same-org cache.
  // An unrelated or older cloud page is never overwritten by this merge.
  const pendingNotebook=ownCache?readPendingNotebookSync({organizationId:orgId,userId}):null;
  const recoveredNotebook=mergePendingNotebookChanges(notebookRow?.document,
    readLocalDocument(PRIVATE_DOCUMENT_KEY),pendingNotebook);
  if (recoveredNotebook) {
    writeHydrated(PRIVATE_DOCUMENT_KEY,recoveredNotebook);
  } else if (notebookRow?.document !== undefined) {
    writeHydrated(PRIVATE_DOCUMENT_KEY, notebookRow.document);
  } else if (canSeedNotebookFromLocal) {
    const localNotebook = readLocalDocument(PRIVATE_DOCUMENT_KEY);
    if (localNotebook !== null){assertCurrent();await upsertPrivateDocument(userId, localNotebook);}
  } else {
    removeHydrated(PRIVATE_DOCUMENT_KEY);
  }

  assertCurrent();
  writeCacheScope({ userId, organizationId: orgId });
}

export function startCloudSync(orgId: string, userId: string, onError?: (message: string) => void,
  options: {readOnlyShared?:boolean;canWriteCrm?:boolean;canWriteQuotes?:boolean;
    canWriteSignatures?:boolean;onRecovered?:()=>void;isActive?:()=>boolean} = {}) {
  stopCloudSync();
  if (!supabase || typeof window === 'undefined') return;

  const scope={organizationId:orgId,userId};
  let disposed=false;
  const active=()=>!disposed&&options.isActive?.()!==false;
  const canWriteCrm=!options.readOnlyShared&&options.canWriteCrm!==false;
  const canWriteQuotes=!options.readOnlyShared&&options.canWriteQuotes!==false;
  const canWriteSignatures=!options.readOnlyShared&&options.canWriteSignatures!==false;
  const canWrite=(key:CloudDocumentKey)=>key===PRIVATE_DOCUMENT_KEY||
    (key===CRM_DOCUMENT_KEY?canWriteCrm:
      key===QUOTES_DOCUMENT_KEY?canWriteQuotes:canWriteSignatures);
  const retryableFailures=new Set<CloudDocumentKey>();
  // Serialize writes to each document so a slower older request cannot
  // finish after a newer record edit and restore stale cloud values.
  const inFlight=new Map<CloudDocumentKey,Promise<void>>();
  const scheduledRevision=new Map<CloudDocumentKey,number>();
  let lastRecoveryRetry=0;
  let baselineCrm=readLocalDocument(CRM_DOCUMENT_KEY) as CrmDocument|null;
  let baselineNotebook=readLocalDocument(PRIVATE_DOCUMENT_KEY) as NotebookDocument|null;
  const setQuoteSaveStatus=useQuoteCloudStatusStore.getState().setStatus;
  setQuoteSaveStatus(canWriteQuotes&&readPendingQuoteSync(scope)?'pending':'saved');
  const schedule=(key:CloudDocumentKey,document:unknown)=>{
    const revision=(scheduledRevision.get(key)??0)+1;
    scheduledRevision.set(key,revision);
    const previous=pending.get(key);
    if(previous)window.clearTimeout(previous);
    // Local quote data already exists; persist an identity-scoped marker
    // BEFORE the debounce, so a refresh cannot silently erase a draft.
    const token=key===QUOTES_DOCUMENT_KEY?markPendingQuoteSync(scope,document)
      :key===CRM_DOCUMENT_KEY?markPendingCrmSync(scope,document,baselineCrm)
      :key===PRIVATE_DOCUMENT_KEY?markPendingNotebookSync(scope,document,baselineNotebook):null;
    if(key===QUOTES_DOCUMENT_KEY)setQuoteSaveStatus('pending');
    const delay=key==='notebook'?1200:500;
    const timer=window.setTimeout(()=>{
      pending.delete(key);
      if(disposed)return;
      if(key===QUOTES_DOCUMENT_KEY)setQuoteSaveStatus('syncing');
      // A failed earlier write must not block a newer one, but successful
      // writes must never overtake one another for the same document.
      const operation=(inFlight.get(key)??Promise.resolve()).catch(()=>{}).then(()=>{
        if(!active())return;
        return key===PRIVATE_DOCUMENT_KEY
          ?upsertPrivateDocument(userId,document)
          :key===CRM_DOCUMENT_KEY
            ?syncNormalizedCrm(orgId,document as CrmDocument)
          :key===QUOTES_DOCUMENT_KEY
            ?syncNormalizedQuotes(orgId,document as QuoteDocument)
            :syncNormalizedSignatures(orgId,document as SignatureDocument);
      });
      inFlight.set(key,operation);
      void operation.then(()=>{
        if(!active())return;
        if(key===CRM_DOCUMENT_KEY&&token)clearPendingCrmSync(scope,token);
        if(key===QUOTES_DOCUMENT_KEY&&token)clearPendingQuoteSync(scope,token);
        if(key===PRIVATE_DOCUMENT_KEY&&token)clearPendingNotebookSync(scope,token);
        // A later edit superseded this response: only the latest generation
        // may change save banners, failure states or the sync baseline.
        if(scheduledRevision.get(key)!==revision)return;
        const recoveredFailure=retryableFailures.delete(key);
        if(key===CRM_DOCUMENT_KEY&&!readPendingCrmSync(scope))
          baselineCrm=document as CrmDocument;
        if(key===PRIVATE_DOCUMENT_KEY&&!readPendingNotebookSync(scope))
          baselineNotebook=document as NotebookDocument;
        // A recovery marker can fail to persist (storage quota/private mode).
        // Cloud confirmation still means this particular write was saved.
        if(key===QUOTES_DOCUMENT_KEY&&!readPendingQuoteSync(scope))
          setQuoteSaveStatus('saved');
        if(recoveredFailure&&!retryableFailures.size&&
          !readPendingCrmSync(scope)&&!readPendingQuoteSync(scope)&&!readPendingNotebookSync(scope))
          options.onRecovered?.();
      }).catch((error:unknown)=>{
        if(!active()||scheduledRevision.get(key)!==revision)return;
        retryableFailures.add(key);
        const message=error instanceof Error?error.message:'Cloud sync failed.';
        if(key===QUOTES_DOCUMENT_KEY)setQuoteSaveStatus('error',message);
        onError?.(message);
      });
    },delay);
    pending.set(key,timer);
  };
  const handler=(event:Event)=>{
    const detail=(event as CustomEvent<CloudDocumentSavedDetail>).detail;
    if(!detail?.key||!active())return;
    // Mirror the member's department-specific write privileges. Database
    // RLS independently checks every actual cloud mutation.
    if(!canWrite(detail.key))return;
    schedule(detail.key,detail.document);
  };
  window.addEventListener(CLOUD_DOCUMENT_SAVED_EVENT,handler);
  // Retry failed saves within the active session, even if metadata storage
  // was blocked. Reload recovery still requires scoped pending markers.
  const retryFailed=()=>{
    if(!active())return;
    if(Date.now()-lastRecoveryRetry<15000)return;
    let attempted=false;
    // Within this live, identity-checked session a failed write is retryable
    // even if browser storage rejected the metadata recovery marker.
    if(canWriteCrm&&retryableFailures.has(CRM_DOCUMENT_KEY)){
      const doc=readLocalDocument(CRM_DOCUMENT_KEY) as CrmDocument|null;
      if(doc?.schemaVersion===3){
        schedule(CRM_DOCUMENT_KEY,doc);attempted=true;
      }
    }
    if(canWriteQuotes&&retryableFailures.has(QUOTES_DOCUMENT_KEY)){
      const doc=readLocalDocument(QUOTES_DOCUMENT_KEY) as QuoteDocument|null;
      if(doc?.schemaVersion===2){
        schedule(QUOTES_DOCUMENT_KEY,doc);attempted=true;
      }
    }
    // A private Notebook may be saved by viewers. Failed Notebook and
    // Signature requests can be retried in-session; on reload, Notebook
    // recovery separately requires an identity-scoped pending marker.
    if(retryableFailures.has(PRIVATE_DOCUMENT_KEY)){
      const doc=readLocalDocument(PRIVATE_DOCUMENT_KEY);
      if(doc!==null){schedule(PRIVATE_DOCUMENT_KEY,doc);attempted=true;}
    }
    if(canWriteSignatures&&retryableFailures.has(SIGNATURES_DOCUMENT_KEY)){
      const doc=readLocalDocument(SIGNATURES_DOCUMENT_KEY) as SignatureDocument|null;
      if(doc?.schemaVersion===1){schedule(SIGNATURES_DOCUMENT_KEY,doc);attempted=true;}
    }
    if(attempted)lastRecoveryRetry=Date.now();
  };
  const retryWhenVisible=()=>{if(document.visibilityState==='visible')retryFailed();};
  window.addEventListener('online',retryFailed);
  document.addEventListener('visibilitychange',retryWhenVisible);
  activeCleanup=()=>{
    disposed=true;
    window.removeEventListener(CLOUD_DOCUMENT_SAVED_EVENT,handler);
    window.removeEventListener('online',retryFailed);
    document.removeEventListener('visibilitychange',retryWhenVisible);
  };

  // A previously interrupted debounced save survives a browser reload.
  // Re-attempt after the auth store finishes assigning this organization.
  if(canWriteQuotes&&readPendingQuoteSync(scope)){
    const restored=readLocalDocument(QUOTES_DOCUMENT_KEY) as QuoteDocument|null;
    if(restored?.schemaVersion===2)schedule(QUOTES_DOCUMENT_KEY,restored);
  }
  if(canWriteCrm&&readPendingCrmSync(scope)){
    const restored=readLocalDocument(CRM_DOCUMENT_KEY) as CrmDocument|null;
    if(restored?.schemaVersion===3)schedule(CRM_DOCUMENT_KEY,restored);
  }
  // Notebook is private even for Viewers; recover interrupted pages only
  // after identity-scoped cloud hydration has safely merged their revisions.
  if(readPendingNotebookSync(scope)){
    const restored=readLocalDocument(PRIVATE_DOCUMENT_KEY) as NotebookDocument|null;
    if(restored?.schemaVersion===3)schedule(PRIVATE_DOCUMENT_KEY,restored);
  }
}

/**
 * Local browser storage is not a permission boundary. When changing a cloud
 * identity, discard previously hydrated company and personal cloud caches.
 * Do not clear local-only/demo data (which has no cloud cache scope).
 * A signed-in successor will rehydrate authorized rows from RLS.
 */
export function clearCloudIdentityCache() {
  try {
    if (!readCacheScope()) return;
    for (const key of [CRM_DOCUMENT_KEY, QUOTES_DOCUMENT_KEY, SIGNATURES_DOCUMENT_KEY, PRIVATE_DOCUMENT_KEY]) {
      removeLocalDocument(key);
    }
    localStorage.removeItem('salesshop-company-settings-v1');
    localStorage.removeItem(CACHE_SCOPE_KEY);
  } catch { /* best effort when storage is blocked */ }
}

export function stopCloudSync() {
  activeCleanup?.();
  activeCleanup = null;
  if (typeof window !== 'undefined') {
    pending.forEach((timer) => window.clearTimeout(timer));
  }
  pending.clear();
}
