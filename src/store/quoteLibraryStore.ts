import { create } from 'zustand';

type QuoteLibraryMode = 'mine' | 'team';
interface QuoteLibraryState {
  mode: QuoteLibraryMode;
  setMode: (mode: QuoteLibraryMode) => void;
}

/** UI navigation only; roles and quote reads are still authorized by Supabase. */
export const useQuoteLibraryStore = create<QuoteLibraryState>((set)=>({
  mode:'mine',
  setMode:(mode)=>set({mode}),
}));
