import { create } from 'zustand';
import { useNotebookStore } from './notebookStore';
import { useQuoteStore } from './quoteStore';

export type AppView = 'notebook' | 'board' | 'quotes' | 'dashboard';

interface NavigationState {
  view: AppView;
  focusedProjectId: string | null;
  setView: (view: AppView) => void;
  openProject: (projectId: string) => void;
  openNotebookPage: (pageId: string) => void;
  openQuote: (quoteId: string) => void;
  clearFocusedProject: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  view: 'notebook',
  focusedProjectId: null,
  setView: (view) => set({ view, focusedProjectId: null }),
  openProject: (projectId) => set({ view: 'board', focusedProjectId: projectId }),
  openNotebookPage: (pageId) => {
    useNotebookStore.getState().selectEntry(pageId);
    set({ view: 'notebook', focusedProjectId: null });
  },
  openQuote: (quoteId) => {
    useQuoteStore.getState().hydrate();
    useQuoteStore.getState().selectQuote(quoteId);
    set({ view: 'quotes', focusedProjectId: null });
  },
  clearFocusedProject: () => set({ focusedProjectId: null }),
}));
