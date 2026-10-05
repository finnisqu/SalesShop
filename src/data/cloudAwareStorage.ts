export type CloudDocumentKey = 'crm' | 'quotes' | 'signatures' | 'notebook';

export const CLOUD_DOCUMENT_SAVED_EVENT = 'salesshop:document-saved';

export const LOCAL_STORAGE_KEYS: Record<CloudDocumentKey, string> = {
  crm: 'salesshop-react-crm-v1',
  quotes: 'salesshop-react-quotes-v1',
  signatures: 'salesshop-react-signatures-v1',
  notebook: 'salesshop-react-notebook-v1',
};

export interface CloudDocumentSavedDetail {
  key: CloudDocumentKey;
  document: unknown;
}

export function readLocalDocument(key: CloudDocumentKey): unknown | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS[key]);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocalDocument(key: CloudDocumentKey, document: unknown, notify = true) {
  localStorage.setItem(LOCAL_STORAGE_KEYS[key], JSON.stringify(document));
  if (!notify || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CloudDocumentSavedDetail>(CLOUD_DOCUMENT_SAVED_EVENT, {
    detail: { key, document },
  }));
}
