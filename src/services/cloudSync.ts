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
} = {}) {
  if (!supabase) return;

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
  // The existing local cache is not authoritative: recover only rows recorded
  // by a same-user/same-org write-ahead marker, and only if newer than cloud.
  // Viewers and identity switches must never replay writable CRM data.
  const ownCache=previousScope?.userId===userId&&previousScope.organizationId===orgId;
  const pendingCrm=ownCache&&options.allowCrmRecovery!==false
    ?readPendingCrmSync({organizationId:orgId,userId}):null;
  const recoveredCrm=mergePendingCrmChanges(normalizedCrm,localCrm,pendingCrm);
  if (recoveredCrm) {
    writeLocalDocument(CRM_DOCUMENT_KEY, recoveredCrm, false);
  } else if (canSeedOrgFromLocal) {
    if (localCrm?.schemaVersion === 3) {
      await syncNormalizedCrm(orgId, localCrm);
    } else {
      writeLocalDocument(CRM_DOCUMENT_KEY, emptyCrmDocument(), false);
    }
  } else {
    writeLocalDocument(CRM_DOCUMENT_KEY, emptyCrmDocument(), false);
  }

  // Quotes use normalized current rows + immutable revision snapshots.
  const pendingQuoteSync=readPendingQuoteSync({organizationId:orgId,userId});
  // Keep only explicitly pending drafts owned by this user. A stale local
  // cache cannot overwrite issued revisions, archived rows or anyone else's
  // quotes, even if the server has newer versions.
  const recoveredQuotes=mergePendingQuoteDrafts(normalizedQuotes,localQuotes,pendingQuoteSync);
  if (recoveredQuotes) {
    writeLocalDocument(QUOTES_DOCUMENT_KEY,recoveredQuotes,false);
  } else if (canSeedOrgFromLocal && localQuotes?.schemaVersion === 2 &&
    localQuotes.quotes.length > 0 && localQuotes.quotes.every(quote=>quote.ownerUserId===userId)) {
    await syncNormalizedQuotes(orgId, localQuotes);
    const seededQuotes = await loadNormalizedQuotes(orgId, preferredActiveQuoteId);
    writeLocalDocument(QUOTES_DOCUMENT_KEY, seededQuotes ?? localQuotes, false);
  } else {
    // Collaborators never seed a company with their own local/demo data.
    // Only a workspace owner initializing a new shop creates the starter quote.
    if (canSeedOrgFromLocal) {
      const starter = starterQuoteDocument(userId);
      await syncNormalizedQuotes(orgId, starter);
      writeLocalDocument(QUOTES_DOCUMENT_KEY, starter, false);
    } else {
      writeLocalDocument(QUOTES_DOCUMENT_KEY, { schemaVersion: 2, activeQuoteId: null, quotes: [] }, false);
    }
  }

  // Signatures are immutable business records. Existing cloud records always win.
  if (normalizedSignatures) {
    writeLocalDocument(SIGNATURES_DOCUMENT_KEY, normalizedSignatures, false);
  } else if (canSeedOrgFromLocal) {
    const localSignatures = readLocalDocument(SIGNATURES_DOCUMENT_KEY) as SignatureDocument | null;
    if (localSignatures?.schemaVersion === 1) {
      await syncNormalizedSignatures(orgId, localSignatures);
      const seededSignatures = await loadNormalizedSignatures(orgId);
      writeLocalDocument(SIGNATURES_DOCUMENT_KEY, seededSignatures ?? emptySignatureDocument(), false);
    } else {
      writeLocalDocument(SIGNATURES_DOCUMENT_KEY, emptySignatureDocument(), false);
    }
  } else {
    writeLocalDocument(SIGNATURES_DOCUMENT_KEY, emptySignatureDocument(), false);
  }

  // Notebook remains intentionally private and document-shaped.
  const { data: notebookRow, error: notebookError } = notebookResult;
  if (notebookError) throw notebookError;

  if (notebookRow?.document !== undefined) {
    writeLocalDocument(PRIVATE_DOCUMENT_KEY, notebookRow.document, false);
  } else if (canSeedNotebookFromLocal) {
    const localNotebook = readLocalDocument(PRIVATE_DOCUMENT_KEY);
    if (localNotebook !== null) await upsertPrivateDocument(userId, localNotebook);
  } else {
    removeLocalDocument(PRIVATE_DOCUMENT_KEY);
  }

  writeCacheScope({ userId, organizationId: orgId });
}

export function startCloudSync(orgId: string, userId: string, onError?: (message: string) => void,
  options: { readOnlyShared?: boolean; onRecovered?: () => void } = {}) {
  stopCloudSync();
  if (!supabase || typeof window === 'undefined') return;

  const scope={organizationId:orgId,userId};
  let disposed=false;
  const retryableFailures=new Set<CloudDocumentKey>();
  // Serialize writes to each document so a slower older request cannot
  // finish after a newer record edit and restore stale cloud values.
  const inFlight=new Map<CloudDocumentKey,Promise<void>>();
  const scheduledRevision=new Map<CloudDocumentKey,number>();
  let lastRecoveryRetry=0;
  let baselineCrm=readLocalDocument(CRM_DOCUMENT_KEY) as CrmDocument|null;
  const setQuoteSaveStatus=useQuoteCloudStatusStore.getState().setStatus;
  setQuoteSaveStatus(readPendingQuoteSync(scope)?'pending':'saved');
  const schedule=(key:CloudDocumentKey,document:unknown)=>{
    const revision=(scheduledRevision.get(key)??0)+1;
    scheduledRevision.set(key,revision);
    const previous=pending.get(key);
    if(previous)window.clearTimeout(previous);
    // Local quote data already exists; persist an identity-scoped marker
    // BEFORE the debounce, so a refresh cannot silently erase a draft.
    const token=key===QUOTES_DOCUMENT_KEY?markPendingQuoteSync(scope,document)
      :key===CRM_DOCUMENT_KEY?markPendingCrmSync(scope,document,baselineCrm):null;
    if(key===QUOTES_DOCUMENT_KEY)setQuoteSaveStatus('pending');
    const delay=key==='notebook'?1200:500;
    const timer=window.setTimeout(()=>{
      pending.delete(key);
      if(disposed)return;
      if(key===QUOTES_DOCUMENT_KEY)setQuoteSaveStatus('syncing');
      // A failed earlier write must not block a newer one, but successful
      // writes must never overtake one another for the same document.
      const operation=(inFlight.get(key)??Promise.resolve()).catch(()=>{}).then(()=>{
        if(disposed)return;
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
        if(disposed)return;
        if(key===CRM_DOCUMENT_KEY&&token)clearPendingCrmSync(scope,token);
        if(key===QUOTES_DOCUMENT_KEY&&token)clearPendingQuoteSync(scope,token);
        // A later edit superseded this response: only the latest generation
        // may change save banners, failure states or the sync baseline.
        if(scheduledRevision.get(key)!==revision)return;
        const recoveredFailure=retryableFailures.delete(key);
        if(key===CRM_DOCUMENT_KEY&&!readPendingCrmSync(scope))
          baselineCrm=document as CrmDocument;
        if(key===QUOTES_DOCUMENT_KEY&&token&&!readPendingQuoteSync(scope))
          setQuoteSaveStatus('saved');
        if(recoveredFailure&&!retryableFailures.size&&
          !readPendingCrmSync(scope)&&!readPendingQuoteSync(scope))
          options.onRecovered?.();
      }).catch((error:unknown)=>{
        if(disposed||scheduledRevision.get(key)!==revision)return;
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
    if(!detail?.key)return;
    // Viewers may sync only their own notebook, never shared company quotes.
    if(options.readOnlyShared&&detail.key!==PRIVATE_DOCUMENT_KEY)return;
    schedule(detail.key,detail.document);
  };
  window.addEventListener(CLOUD_DOCUMENT_SAVED_EVENT,handler);
  // Retry only previously failed saves with still-present, scoped recovery
  // markers. Do not continually resubmit every record on tab focus.
  const retryFailed=()=>{
    if(disposed||options.readOnlyShared)return;
    if(Date.now()-lastRecoveryRetry<15000)return;
    let attempted=false;
    if(retryableFailures.has(CRM_DOCUMENT_KEY)&&readPendingCrmSync(scope)){
      const doc=readLocalDocument(CRM_DOCUMENT_KEY) as CrmDocument|null;
      if(doc?.schemaVersion===3){
        schedule(CRM_DOCUMENT_KEY,doc);attempted=true;
      }
    }
    if(retryableFailures.has(QUOTES_DOCUMENT_KEY)&&readPendingQuoteSync(scope)){
      const doc=readLocalDocument(QUOTES_DOCUMENT_KEY) as QuoteDocument|null;
      if(doc?.schemaVersion===2){
        schedule(QUOTES_DOCUMENT_KEY,doc);attempted=true;
      }
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
  if(!options.readOnlyShared&&readPendingQuoteSync(scope)){
    const restored=readLocalDocument(QUOTES_DOCUMENT_KEY) as QuoteDocument|null;
    if(restored?.schemaVersion===2)schedule(QUOTES_DOCUMENT_KEY,restored);
  }
  if(!options.readOnlyShared&&readPendingCrmSync(scope)){
    const restored=readLocalDocument(CRM_DOCUMENT_KEY) as CrmDocument|null;
    if(restored?.schemaVersion===3)schedule(CRM_DOCUMENT_KEY,restored);
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
