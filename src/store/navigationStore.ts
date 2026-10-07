import { create } from 'zustand';
import { useNotebookStore } from './notebookStore';
import { useQuoteStore } from './quoteStore';

export type CatalogSection = 'materials' | 'sinks' | 'other' | 'rates' | 'suppliers';
export type AppView = 'notebook' | 'board' | 'quotes' | 'catalog' | 'dashboard' | 'settings';

interface NavigationState {
  view: AppView;
  catalogSection: CatalogSection;
  focusedProjectId: string | null;
  focusedCompanyId: string | null;
  setView: (view: AppView) => void;
  setCatalogSection: (section: CatalogSection) => void;
  openCatalog: (section?: CatalogSection) => void;
  openProject: (projectId: string) => void;
  openCompany: (companyId: string) => void;
  openNotebookPage: (pageId: string) => void;
  openQuote: (quoteId: string) => void;
  clearFocusedProject: () => void;
  clearFocusedCompany: () => void;
}

const VIEW_STORAGE_KEY = 'salesshop-active-view-v1';
const CATALOG_SECTION_STORAGE_KEY = 'salesshop-catalog-section-v1';
const APP_VIEWS: AppView[] = ['notebook', 'board', 'quotes', 'catalog', 'dashboard', 'settings'];
const CATALOG_SECTIONS: CatalogSection[] = ['materials', 'sinks', 'other', 'rates', 'suppliers'];

function readInitialNavigation(): Pick<NavigationState, 'view' | 'catalogSection'> {
  try {
    const storedView = localStorage.getItem(VIEW_STORAGE_KEY);
    const storedSection = localStorage.getItem(CATALOG_SECTION_STORAGE_KEY) as CatalogSection | null;
    const catalogSection = storedSection && CATALOG_SECTIONS.includes(storedSection) ? storedSection : 'materials';

    // Migrate the three pre-Catalog top-level views without losing where the user was working.
    if (storedView === 'materials') return { view: 'catalog', catalogSection: 'materials' };
    if (storedView === 'sinks') return { view: 'catalog', catalogSection: 'sinks' };
    if (storedView === 'rate-book') return { view: 'catalog', catalogSection: 'rates' };

    return {
      view: storedView && APP_VIEWS.includes(storedView as AppView) ? storedView as AppView : 'notebook',
      catalogSection,
    };
  } catch {
    return { view: 'notebook', catalogSection: 'materials' };
  }
}

function rememberView(view: AppView) {
  try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* best-effort UI continuity */ }
}

function rememberCatalogSection(section: CatalogSection) {
  try { localStorage.setItem(CATALOG_SECTION_STORAGE_KEY, section); } catch { /* best-effort UI continuity */ }
}

const initial = readInitialNavigation();

export const useNavigationStore = create<NavigationState>((set) => {
  const navigate = (view: AppView, patch: Partial<NavigationState> = {}) => {
    rememberView(view);
    set({ view, focusedProjectId: null, focusedCompanyId: null, ...patch });
  };

  return {
    view: initial.view,
    catalogSection: initial.catalogSection,
    focusedProjectId: null,
    focusedCompanyId: null,
    setView: (view) => navigate(view),
    setCatalogSection: (catalogSection) => {
      rememberCatalogSection(catalogSection);
      rememberView('catalog');
      set({ view: 'catalog', catalogSection, focusedProjectId: null, focusedCompanyId: null });
    },
    openCatalog: (catalogSection = 'materials') => {
      rememberCatalogSection(catalogSection);
      navigate('catalog', { catalogSection });
    },
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
