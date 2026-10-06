import { create } from 'zustand';
import type { SupplierImportSession } from '../types/supplierImport';

interface SupplierImportState {
  session: SupplierImportSession | null;
  hydrated: boolean;
  hydrate: () => void;
  setSession: (session: SupplierImportSession) => void;
  setEffectiveDate: (effectiveDate?: string) => void;
  clearSession: () => void;
}

const LOCAL_KEY = 'salesshop-supplier-import-staging-v1';

function readSession(): SupplierImportSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupplierImportSession;
    if (parsed?.schemaVersion !== 1 || !parsed.source || !Array.isArray(parsed.candidates)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: SupplierImportSession | null) {
  try {
    if (session) localStorage.setItem(LOCAL_KEY, JSON.stringify(session));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    // Staging is convenience state only. A storage quota should never block parsing/review.
  }
}

export const useSupplierImportStore = create<SupplierImportState>((set, get) => ({
  session: null,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    set({ session: readSession(), hydrated: true });
  },
  setSession: (session) => {
    writeSession(session);
    set({ session });
  },
  setEffectiveDate: (effectiveDate) => {
    const current = get().session;
    if (!current) return;
    const session = { ...current, source: { ...current.source, effectiveDate: effectiveDate || undefined } };
    writeSession(session);
    set({ session });
  },
  clearSession: () => {
    writeSession(null);
    set({ session: null });
  },
}));
