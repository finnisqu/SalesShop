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

    if(route?.view)return{view:route.view,catalogSection:route.catalogSection??catalogSection};

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
  const snapshot=(state:NavigationState):NavigationLocation=>({
    view:state.view,catalogSection:state.catalogSection,ratesFocus:state.ratesFocus,
    focusedProjectId:state.focusedProjectId,focusedCompanyId:state.focusedCompanyId,
    focusedQuoteId:state.focusedQuoteId,
  });
  const navigate=(view:AppView,patch:Partial<NavigationLocation>={})=>{
    let target:string|undefined;
    let origin:string|undefined;
    set(state=>{
      const next:NavigationLocation={...snapshot(state),view,
        ratesFocus:undefined,focusedProjectId:null,focusedCompanyId:null,focusedQuoteId:null,...patch};
      const current=snapshot(state);
      const changed=Object.keys(current).some(key=>
        current[key as keyof NavigationLocation]!==next[key as keyof NavigationLocation]);
      if(!changed)return state;
      origin=salesShopRoutePath(current);
      rememberView(view);
      rememberCatalogSection(next.catalogSection);
      target=salesShopRoutePath(next);
      return {...next,history:[...state.history,current].slice(-20)};
    });
    // The store remains the source of truth. History is a navigation affordance,
    // never an authorization mechanism.
    if(target && typeof window!=='undefined' && appRelativePath()!==target){
      // The old SPA root has no route to restore on browser Back. Record its
      // actual current workspace before leaving it, without adding a history step.
      if(appRelativePath()==='/' && origin)
        window.history.replaceState({salesShop:true},'',appPath(origin));
      window.history.pushState({salesShop:true},'',appPath(target));
    }
  };
  return {
    view:initial.view,catalogSection:initial.catalogSection,
    ratesFocus:undefined,
    focusedProjectId:typeof window!=='undefined' ? parseSalesShopRoute(appRelativePath())?.focusedProjectId ?? null : null,
    focusedCompanyId:typeof window!=='undefined' ? parseSalesShopRoute(appRelativePath())?.focusedCompanyId ?? null : null,
    focusedQuoteId:typeof window!=='undefined' ? parseSalesShopRoute(appRelativePath())?.focusedQuoteId ?? null : null,
    history:[],
    goBack:()=>{
      const state=get();
      if(!state.history.length)return;
      const previous=state.history[state.history.length-1];
      rememberView(previous.view);
      rememberCatalogSection(previous.catalogSection);
      set({...previous,history:state.history.slice(0,-1)});
      // Update the store immediately for keyboard/mobile controls. A later
      // popstate for this same location must be a no-op, not another pop.
      if(typeof window!=='undefined')window.history.back();
    },
    syncFromBrowser:()=>{
      if(typeof window==='undefined')return;
      const path=appRelativePath();
      const parsed=parseSalesShopRoute(path)??(path==='/'?{view:'home' as const}:null);
      if(!parsed)return;
      set(state=>{
        const next={...snapshot(state),ratesFocus:undefined,
          focusedQuoteId:null,focusedProjectId:null,focusedCompanyId:null,...parsed};
        const current=snapshot(state);
        if(Object.keys(current).every(key=>current[key as keyof NavigationLocation]===next[key as keyof NavigationLocation]))
          return state;
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
    openCompany:companyId=>navigate('dashboard',{focusedCompanyId:companyId}),
    openNotebookPage:pageId=>{
      useNotebookStore.getState().selectEntry(pageId);
      navigate('notebook');
    },
    openQuote:quoteId=>{
      useQuoteStore.getState().hydrate();
      useQuoteStore.getState().selectQuote(quoteId);
      navigate('quotes',{focusedQuoteId:quoteId});
    },
    clearFocusedProject:()=>{
      if(!get().focusedProjectId)return;
      set({focusedProjectId:null});
      if(typeof window!=='undefined'&&appRelativePath().startsWith('/board/projects/'))
        window.history.replaceState({salesShop:true},'',appPath('/board'));
    },
    clearFocusedCompany:()=>{
      if(!get().focusedCompanyId)return;
      set({focusedCompanyId:null});
      if(typeof window!=='undefined'&&appRelativePath().startsWith('/board/accounts/'))
        window.history.replaceState({salesShop:true},'',appPath('/board'));
    },
  };
});
