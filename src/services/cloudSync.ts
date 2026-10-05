import { supabase } from '../lib/supabase';
import {
  CLOUD_DOCUMENT_SAVED_EVENT,
  readLocalDocument,
  removeLocalDocument,
  writeLocalDocument,
  type CloudDocumentKey,
  type CloudDocumentSavedDetail,
} from '../data/cloudAwareStorage';
import type { CrmDocument } from '../types/crm';
import { loadNormalizedCrm, syncNormalizedCrm } from './normalizedCrmSync';

const ORG_DOCUMENT_KEYS: CloudDocumentKey[] = ['quotes', 'signatures'];
const CRM_DOCUMENT_KEY: CloudDocumentKey = 'crm';
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

async function upsertOrgDocument(orgId: string, userId: string, key: CloudDocumentKey, document: unknown) {
  if (!supabase) return;
  const { error } = await supabase.from('org_documents').upsert({
    organization_id: orgId,
    document_key: key,
    document,
    updated_by: userId,
  }, { onConflict: 'organization_id,document_key' });
  if (error) throw error;
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

export async function hydrateCloudDocuments(orgId: string, userId: string) {
  if (!supabase) return;

  const previousScope = readCacheScope();
  const canSeedOrgFromLocal = !previousScope || previousScope.organizationId === orgId;
  const canSeedNotebookFromLocal = !previousScope || previousScope.userId === userId;

  // CRM now uses normalized tables. The old org_documents.crm row is retained only as a rollback backup.
  const normalizedCrm = await loadNormalizedCrm(orgId);
  if (normalizedCrm) {
    writeLocalDocument(CRM_DOCUMENT_KEY, normalizedCrm, false);
  } else if (canSeedOrgFromLocal) {
    const localCrm = readLocalDocument(CRM_DOCUMENT_KEY);
    if (localCrm !== null) {
      await syncNormalizedCrm(orgId, localCrm as CrmDocument);
    } else {
      // Cloud mode should never fall through to the repository's local demo seed.
      writeLocalDocument(CRM_DOCUMENT_KEY, emptyCrmDocument(), false);
    }
  } else {
    // A different account/workspace must receive an explicitly empty cache, not another shop's local data.
    writeLocalDocument(CRM_DOCUMENT_KEY, emptyCrmDocument(), false);
  }

  const { data: orgRows, error: orgError } = await supabase
    .from('org_documents')
    .select('document_key,document')
    .eq('organization_id', orgId)
    .in('document_key', ORG_DOCUMENT_KEYS);
  if (orgError) throw orgError;

  const cloudOrgDocuments = new Map<string, unknown>(
    (orgRows ?? []).map((row) => [String(row.document_key), row.document]),
  );

  for (const key of ORG_DOCUMENT_KEYS) {
    if (cloudOrgDocuments.has(key)) {
      writeLocalDocument(key, cloudOrgDocuments.get(key), false);
      continue;
    }

    if (!canSeedOrgFromLocal) {
      removeLocalDocument(key);
      continue;
    }

    const local = readLocalDocument(key);
    if (local !== null) await upsertOrgDocument(orgId, userId, key, local);
  }

  const { data: notebookRow, error: notebookError } = await supabase
    .from('private_documents')
    .select('document')
    .eq('owner_id', userId)
    .eq('document_key', PRIVATE_DOCUMENT_KEY)
    .maybeSingle();
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

export function startCloudSync(orgId: string, userId: string, onError?: (message: string) => void) {
  stopCloudSync();
  if (!supabase || typeof window === 'undefined') return;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<CloudDocumentSavedDetail>).detail;
    if (!detail?.key) return;
    const previous = pending.get(detail.key);
    if (previous) window.clearTimeout(previous);

    const delay = detail.key === 'notebook' ? 1200 : 500;
    const timer = window.setTimeout(() => {
      pending.delete(detail.key);
      const operation = detail.key === PRIVATE_DOCUMENT_KEY
        ? upsertPrivateDocument(userId, detail.document)
        : detail.key === CRM_DOCUMENT_KEY
          ? syncNormalizedCrm(orgId, detail.document as CrmDocument)
          : upsertOrgDocument(orgId, userId, detail.key, detail.document);
      void operation.catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Cloud sync failed.';
        onError?.(message);
      });
    }, delay);
    pending.set(detail.key, timer);
  };

  window.addEventListener(CLOUD_DOCUMENT_SAVED_EVENT, handler);
  activeCleanup = () => window.removeEventListener(CLOUD_DOCUMENT_SAVED_EVENT, handler);
}

export function stopCloudSync() {
  activeCleanup?.();
  activeCleanup = null;
  if (typeof window !== 'undefined') {
    pending.forEach((timer) => window.clearTimeout(timer));
  }
  pending.clear();
}
