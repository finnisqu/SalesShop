import { create } from 'zustand';
import { useNotebookStore } from './notebookStore';
import { useQuoteStore } from './quoteStore';

export type AppView = 'notebook' | 'board' | 'quotes' | 'rate-book' | 'sinks' | 'materials' | 'dashboard' | 'settings';

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

const VIEW_STORAGE_KEY = 'salesshop-active-view-v1';
const APP_VIEWS: AppView[] = ['notebook', 'board', 'quotes', 'rate-book', 'sinks', 'materials', 'dashboard', 'settings'];

function initialView(): AppView {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as AppView | null;
    return stored && APP_VIEWS.includes(stored) ? stored : 'notebook';
  } catch {
    return 'notebook';
  }
}

function rememberView(view: AppView) {
  try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* best-effort UI continuity */ }
}

export const useNavigationStore = create<NavigationState>((set) => {
  const navigate = (view: AppView, patch: Partial<NavigationState> = {}) => {
    rememberView(view);
    set({ view, focusedProjectId: null, focusedCompanyId: null, ...patch });
  };

  return {
    view: initialView(),
    focusedProjectId: null,
    focusedCompanyId: null,
    setView: (view) => navigate(view),
    openProject: (projectId) => navigate('board', { focusedProjectId: projectId }),
    openCompany: (companyId) => navigate('board', { focusedCompanyId: companyId }),
    openNotebookPage: (pageId) => {
      useNotebookStore.getState().selectEntry(pageId);
      navigate('notebook');
    },
    openQuote: (quoteId) => {
      useQuoteStore.getState().hydrate();
      useQuoteStore.getState().selectQuote(quoteId);
      navigate('quotes');
    },
    clearFocusedProject: () => set({ focusedProjectId: null }),
    clearFocusedCompany: () => set({ focusedCompanyId: null }),
  };
});
