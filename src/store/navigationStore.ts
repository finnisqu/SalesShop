import { create } from 'zustand';
import { useNotebookStore } from './notebookStore';
import { useQuoteStore } from './quoteStore';

export type AppView = 'notebook' | 'board' | 'quotes' | 'rate-book' | 'materials' | 'dashboard' | 'settings';

interface NavigationState {
  view: AppView;
  focusedProjectId: string | null;
  focusedCompanyId: string | null;
  setView: (view: AppView) => void;
  openProject: (projectId: string) => void;
  openCompany: (companyId: string) => void;
  openNotebookPage: (pageId: string) => void;
  openQuote: (quoteId: string) => void;
  clearFocusedProject: () => void;
  clearFocusedCompany: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  view: 'notebook',
  focusedProjectId: null,
  focusedCompanyId: null,
  setView: (view) => set({ view, focusedProjectId: null, focusedCompanyId: null }),
  openProject: (projectId) => set({ view: 'board', focusedProjectId: projectId, focusedCompanyId: null }),
  openCompany: (companyId) => set({ view: 'board', focusedCompanyId: companyId, focusedProjectId: null }),
  openNotebookPage: (pageId) => {
    useNotebookStore.getState().selectEntry(pageId);
    set({ view: 'notebook', focusedProjectId: null, focusedCompanyId: null });
  },
  openQuote: (quoteId) => {
    useQuoteStore.getState().hydrate();
    useQuoteStore.getState().selectQuote(quoteId);
    set({ view: 'quotes', focusedProjectId: null, focusedCompanyId: null });
  },
  clearFocusedProject: () => set({ focusedProjectId: null }),
  clearFocusedCompany: () => set({ focusedCompanyId: null }),
}));
