import { create } from 'zustand';

/**
 * Presentation-only opt-in. The beta and classic editors share quoteStore,
 * tenant/cloud permissions, catalog stores and quote data.
 * No quote is duplicated or migrated by switching this preference.
 */
const KEY = 'salesshop:quotes-mobile-beta-v1';

function readOptIn(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(KEY) === '1'; }
  catch { return false; }
}

interface QuotesMobileBetaState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useQuotesMobileBetaStore = create<QuotesMobileBetaState>((set) => ({
  enabled: readOptIn(),
  setEnabled: (enabled) => {
    try { window.localStorage.setItem(KEY, enabled ? '1' : '0'); } catch { /* private mode */ }
    set({ enabled });
  },
}));
