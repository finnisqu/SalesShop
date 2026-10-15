import { create } from 'zustand';
import { scopedStorageKey } from '../lib/developerPlayground';
import { useNotebookStore } from './notebookStore';
import { useQuoteStore } from './quoteStore';
import { appPath,appRelativePath } from '../lib/appUrl';
import {parseSalesShopRoute,salesShopRoutePath} from '../services/appRoutes';

export type CatalogSection = 'materials' | 'sinks' | 'other' | 'rates' | 'suppliers';
export type AppView = 'home' | 'notebook' | 'board' | 'quotes' | 'catalog' | 'dashboard' | 'settings';

export interface NavigationLocation {
  view: AppView;
  catalogSection: CatalogSection;
  ratesFocus?: 'material';
  focusedProjectId: string | null;
  focusedCompanyId: string | null;
  focusedQuoteId: string | null;
}

interface NavigationState {
  view: AppView;
  catalogSection: CatalogSection;
  ratesFocus?: 'material';
  focusedProjectId: string | null;
  focusedCompanyId: string | null;
  focusedQuoteId: string | null;
  history: NavigationLocation[];
  goBack: () => void;
  syncFromBrowser: () => void;
  setView: (view: AppView) => void;
  setCatalogSection: (section: CatalogSection) => void;
  openCatalog: (section?: CatalogSection) => void;
  openBuilderRates: () => void;
  openProject: (projectId: string) => void;
  openCompany: (companyId: string) => void;
  openNotebookPage: (pageId: string) => void;
  openQuote: (quoteId: string) => void;
  clearFocusedProject: () => void;
  clearFocusedCompany: () => void;
}

const VIEW_STORAGE_KEY = scopedStorageKey('salesshop-active-view-v1');
const CATALOG_SECTION_STORAGE_KEY = scopedStorageKey('salesshop-catalog-section-v1');
const APP_VIEWS: AppView[] = ['home', 'notebook', 'board', 'quotes', 'catalog', 'dashboard', 'settings'];
const CATALOG_SECTIONS: CatalogSection[] = ['materials', 'sinks', 'other', 'rates', 'suppliers'];

function readInitialNavigation(): Pick<NavigationState, 'view' | 'catalogSection'> {
  try {
    const route = typeof window!=='undefined' ? parseSalesShopRoute(appRelativePath()) : null;
    const storedView = localStorage.getItem(VIEW_STORAGE_KEY);
    const storedSection = localStorage.getItem(CATALOG_SECTION_STORAGE_KEY) as CatalogSection | null;
    const catalogSection = storedSection && CATALOG_SECTIONS.includes(storedSection) ? storedSection : 'materials';

    // Migrate the three pre-Catalog top-level views without losing where the user was working.
    if (storedView === 'materials') return { view: 'catalog', catalogSection: 'materials' };
    if (storedView === 'sinks') return { view: 'catalog', catalogSection: 'sinks' };
    if (storedView === 'rate-book') return { view: 'catalog', catalogSection: 'rates' };

    return {
      view: route?.view ?? (storedView && APP_VIEWS.includes(storedView as AppView) ? storedView as AppView : 'home'),
      catalogSection:route?.catalogSection ?? catalogSection,
    };
  } catch {
    return { view: 'home', catalogSection: 'materials' };
  }
}

function rememberView(view: AppView) {
  try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* best-effort UI continuity */ }
}

function rememberCatalogSection(section: CatalogSection) {
  try { localStorage.setItem(CATALOG_SECTION_STORAGE_KEY, section); } catch { /* best-effort UI continuity */ }
}

const initial = readInitialNavigation();

export const useNavigationStore = create<NavigationState>((set,get) => {
  const getNavigationHistoryLength=()=>get().history.length;
  const snapshot=(state:NavigationState):NavigationLocation=>({
    view:state.view,catalogSection:state.catalogSection,ratesFocus:state.ratesFocus,
    focusedProjectId:state.focusedProjectId,focusedCompanyId:state.focusedCompanyId,
    focusedQuoteId:state.focusedQuoteId,
  });
  const navigate=(view:AppView,patch:Partial<NavigationLocation>={})=>{
    let target:string|undefined;
    set(state=>{
      const next:NavigationLocation={...snapshot(state),view,
        ratesFocus:undefined,focusedProjectId:null,focusedCompanyId:null,focusedQuoteId:null,...patch};
      const current=snapshot(state);
      const changed=Object.keys(current).some(key=>
        current[key as keyof NavigationLocation]!==next[key as keyof NavigationLocation]);
      if(!changed)return state;
      rememberView(view);
      rememberCatalogSection(next.catalogSection);
      target=salesShopRoutePath(next);
      return {...next,history:[...state.history,current].slice(-20)};
    });
    // The store remains the source of truth. History is a navigation affordance,
    // never an authorization mechanism.
    if(target && typeof window!=='undefined' && appRelativePath()!==target){
      window.history.pushState({salesShop:true},'',appPath(target));
    }
  };
  return {
    view:initial.view,catalogSection:initial.catalogSection,
    ratesFocus:undefined,focusedProjectId:null,focusedCompanyId:null,focusedQuoteId:
      typeof window!=='undefined' ? parseSalesShopRoute(appRelativePath())?.focusedQuoteId ?? null : null,
    history:[],
    goBack:()=>{
      if(typeof window!=='undefined' && getNavigationHistoryLength() > 0)window.history.back();
    },
    syncFromBrowser:()=>{
      if(typeof window==='undefined')return;
      const parsed=parseSalesShopRoute(appRelativePath());
      if(!parsed)return;
      set(state=>{
        const next={...snapshot(state),ratesFocus:undefined,
          focusedQuoteId:null,focusedProjectId:null,focusedCompanyId:null,...parsed};
        rememberView(next.view);
        rememberCatalogSection(next.catalogSection);
        return {...state,...next,history:state.history.slice(0,-1)};
      });
      const quoteId=parsed.focusedQuoteId;
      if(quoteId){
        const store=useQuoteStore.getState();
        if(store.quotes.some(quote=>quote.id===quoteId))store.selectQuote(quoteId);
      }
    },
    setView:view=>navigate(view),
    setCatalogSection:catalogSection=>navigate('catalog',{catalogSection}),
    openCatalog:(catalogSection='materials')=>navigate('catalog',{catalogSection}),
    openBuilderRates:()=>navigate('catalog',{catalogSection:'rates',ratesFocus:'material'}),
    openProject:projectId=>navigate('board',{focusedProjectId:projectId}),
    openCompany:companyId=>navigate('board',{focusedCompanyId:companyId}),
    openNotebookPage:pageId=>{
      useNotebookStore.getState().selectEntry(pageId);
      navigate('notebook');
    },
    openQuote:quoteId=>{
      useQuoteStore.getState().hydrate();
      useQuoteStore.getState().selectQuote(quoteId);
      navigate('quotes',{focusedQuoteId:quoteId});
    },
    clearFocusedProject:()=>set({focusedProjectId:null}),
    clearFocusedCompany:()=>set({focusedCompanyId:null}),
  };
});
