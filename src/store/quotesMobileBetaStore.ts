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

export interface QuotesBetaLocation {
  quoteId?:string;
  page:'library'|'quote'|'area'|'review';
  quoteTab:'build'|'details'|'preview';
  areaTab:'measure'|'materials'|'pricing';
  areaId:string|null;
}

interface QuotesMobileBetaState {
  enabled: boolean;
  location:QuotesBetaLocation;
  setLocation:(location:QuotesBetaLocation)=>void;
  setEnabled: (enabled: boolean) => void;
}

export const useQuotesMobileBetaStore = create<QuotesMobileBetaState>((set) => ({
  enabled: readOptIn(),
  location:{page:'library',quoteTab:'build',areaTab:'measure',areaId:null},
  setLocation:location=>set({location}),
  setEnabled: (enabled) => {
    try { window.localStorage.setItem(KEY, enabled ? '1' : '0'); } catch { /* private mode */ }
    set(state=>({ enabled, location:enabled?state.location:{page:'library',quoteTab:'build',areaTab:'measure',areaId:null} }));
  },
}));
