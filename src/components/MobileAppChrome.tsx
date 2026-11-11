import { useEffect, useRef, useState } from 'react';
import { WorkspaceToolbar } from '../design-system/shell';
import { useNavigationStore, type AppView, type CatalogSection } from '../store/navigationStore';
import { useNotebookStore } from '../store/notebookStore';
import { useDismissibleLayer } from '../lib/useDismissibleLayer';
import { resolveMobileDrawerChoice } from '../lib/mobileDrawerNavigation';
import { AuthStatus } from './AuthGate';
import { GlobalSearch } from './GlobalSearch';
import { QuickCreate } from './QuickCreate';
import { WorkspaceHelp } from './WorkspaceHelp';
import { BuildBadge } from './BuildBadge';
import { useAuthStore } from '../store/authStore';
import { useAppearanceStore } from '../store/appearanceStore';
import { canEditTeamArea } from '../services/teamDepartments';
import { resolveOwnerPerspective } from '../services/rolePerspective';
import { useRolePerspectiveStore } from '../store/rolePerspectiveStore';
import { useQuoteLibraryStore } from '../store/quoteLibraryStore';
import { useQuotesMobileBetaStore } from '../store/quotesMobileBetaStore';
import { useQuoteStore } from '../store/quoteStore';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';

const APP_DESTINATIONS: Array<{ view: AppView; label: string; short: string }> = [
  { view: 'home', label: 'Home', short: 'Home' },
  { view: 'quotes', label: 'Quotes', short: 'Quotes' },
  { view: 'tasks', label: 'Tasks', short: 'Tasks' },
  { view: 'board', label: 'Board', short: 'Board' },
  { view: 'dashboard', label: 'Connections', short: 'Connections' },
  { view: 'notebook', label: 'Notebook', short: 'Notebook' },
  { view: 'catalog', label: 'Catalog', short: 'Catalog' },
];

const CATALOG_LABELS:Partial<Record<CatalogSection,string>>={
 materials:'Materials',sinks:'Sinks',other:'Other',rates:'Rates',tags:'Tags',
 suppliers:'Suppliers',
};
function viewLabel(view:AppView){
 return APP_DESTINATIONS.find(item=>item.view===view)?.label??'SalesShop';
}
function catalogLabel(section:CatalogSection){
 return CATALOG_LABELS[section]??'Catalog';
}
/** One visual language for the primary SalesShop destinations. */
function MobileDestinationIcon({view}:{view:AppView}){
 return <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
  strokeLinejoin="round" aria-hidden="true">
  {view==='home'?<><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/></>:
   view==='quotes'?<><path d="M6 2h9l4 4v16H6z"/><path d="M15 2v5h4M9 12h7M9 16h7"/></>:
   view==='tasks'?<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/></>:
   view==='board'?<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16M3 10h18"/></>:
   view==='dashboard'?<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/></>:
   view==='notebook'?<><path d="M12 5a9 9 0 0 0-9-1v16a9 9 0 0 1 9 1 9 9 0 0 1 9-1V4a9 9 0 0 0-9 1z"/><path d="M12 5v16"/></>:
   view==='catalog'?<><path d="M4 4h16v16H4z"/><path d="M4 10h16M10 10v10"/></>:
   <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></>}
 </svg>;
}

export function MobileAppChrome() {
  const view = useNavigationStore((state) => state.view);
  const mode = useAuthStore((state) => state.mode);
  const quickTheme = useAppearanceStore(state=>state.preferences.themeChoice);
  const setAppearance = useAppearanceStore(state=>state.update);
  const teamRole = useAuthStore((state) => state.teamRole);
  const department = useAuthStore((state) => state.teamDepartment);
  const previewId = useRolePerspectiveStore((state) => state.activePerspective);
  const quoteLibraryMode = useQuoteLibraryStore((state) => state.mode);
  const betaQuotesEnabled = useQuotesMobileBetaStore((state) => state.enabled);
  const betaQuoteLocation = useQuotesMobileBetaStore((state) => state.location);
  const activeQuote = useQuoteStore((state) => state.quotes.find(q => q.id === state.activeQuoteId) ?? null);
  const quoteUndoDepth = useQuoteStore((state) => state.activeQuoteId ? state.undoStacks[state.activeQuoteId]?.length ?? 0 : 0);
  const quoteRedoDepth = useQuoteStore((state) => state.activeQuoteId ? state.redoStacks[state.activeQuoteId]?.length ?? 0 : 0);
  const user = useAuthStore((state) => state.user);
  const preview = resolveOwnerPerspective(previewId, teamRole, mode);
  const effectiveRole = preview?.role ?? teamRole;
  const effectiveDepartment = preview?.department ?? department;
  const viewer = mode === 'cloud' && effectiveRole === 'viewer';
  const scopedMember = mode === 'cloud' && effectiveRole === 'member' && effectiveDepartment !== 'general';
  const quoteReadOnly = viewer || (scopedMember && !canEditTeamArea(effectiveRole, effectiveDepartment, 'quotes'));
  const setView = useNavigationStore((state) => state.setView);
  const goBack = useNavigationStore((state) => state.goBack);
  const canGoBack = useNavigationStore((state) => state.history.length > 0);
  const catalogSection = useNavigationStore((state) => state.catalogSection);

  const entries = useNotebookStore((state) => state.entries);
  const activeEntryId = useNotebookStore((state) => state.activeEntryId);

  // Keep the mobile quote dock above iOS Safari's expanding browser toolbar.
  // visualViewport describes what is actually visible; the layout viewport
  // can extend beneath the toolbar. Both change when Safari chrome moves.
  useEffect(()=>{
    const viewport=window.visualViewport;
    const root=document.documentElement;
    const sync=()=>{
      const height=viewport?.height??window.innerHeight;
      const hiddenBottom=viewport
        ?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop)
        :0;
      if(Number.isFinite(height)&&height>120)
        root.style.setProperty('--ss-mobile-visual-height',Math.floor(height)+'px');
      if(Number.isFinite(hiddenBottom)){
        root.style.setProperty('--ss-mobile-footer-inset',Math.min(180,Math.ceil(hiddenBottom))+'px');
        root.style.setProperty('--ss-mobile-occluded-bottom',Math.ceil(hiddenBottom)+'px');
        const active=document.activeElement;
        const editing=active instanceof HTMLElement&&active.matches(
          'input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable="true"]');
        if(hiddenBottom>160&&editing)root.dataset.ssMobileKeyboard='open';
        else delete root.dataset.ssMobileKeyboard;
      }
      // Keep modal sheets inside the visible screen when the keyboard opens.
      root.style.setProperty('--ss-mobile-visual-top',Math.max(0,Math.floor(viewport?.offsetTop??0))+'px');
    };
    sync();
    viewport?.addEventListener('resize',sync);
    viewport?.addEventListener('scroll',sync);
    window.addEventListener('resize',sync);
    window.addEventListener('orientationchange',sync);
    // Focus may switch between inputs without a viewport resize. Recheck the
    // keyboard state so sheet gestures and bottom actions stay predictable.
    document.addEventListener('focusin',sync);
    document.addEventListener('focusout',sync);
    return ()=>{
      viewport?.removeEventListener('resize',sync);
      viewport?.removeEventListener('scroll',sync);
      window.removeEventListener('resize',sync);
      window.removeEventListener('orientationchange',sync);
      document.removeEventListener('focusin',sync);
      document.removeEventListener('focusout',sync);
      root.style.removeProperty('--ss-mobile-visual-height');
      root.style.removeProperty('--ss-mobile-footer-inset');
      root.style.removeProperty('--ss-mobile-occluded-bottom');
      root.style.removeProperty('--ss-mobile-visual-top');
      delete root.dataset.ssMobileKeyboard;
    };
  },[]);
  const [open, setOpen] = useState(false);
  const navigationButtonRef=useRef<HTMLButtonElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useDismissibleLayer<HTMLDivElement>(profileOpen, () => setProfileOpen(false));
  useEffect(()=>{
    if(!profileOpen)return;
    const dismiss=(event:PointerEvent)=>{
      if(profileRef.current&&!profileRef.current.contains(event.target as Node))setProfileOpen(false);
    };
    document.addEventListener('pointerdown',dismiss);
    return ()=>document.removeEventListener('pointerdown',dismiss);
  },[profileOpen,profileRef]);
  const searchRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);
  const openNavigation = () => {
    setProfileOpen(false);
    setOpen(previous=>!previous);
  };
  const drawerRef = useDismissibleLayer<HTMLElement>(open, () => setOpen(false));
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{
      const target=event.target as Node;
      if(!drawerRef.current?.contains(target)&&!navigationButtonRef.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open,drawerRef]);
  const [boardMode, setBoardMode] = useState<'projects' | 'accounts'>(() => {
    if (typeof window === 'undefined') return 'projects';
    return window.sessionStorage.getItem('salesshop-board-mode-v1') === 'accounts' ? 'accounts' : 'projects';
  });

  useEffect(() => {
    const syncBoardMode = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: 'projects' | 'accounts' }>).detail;
      if (detail?.mode) setBoardMode(detail.mode);
    };
    window.addEventListener('sales-shop:board-mode-changed', syncBoardMode);
    return () => window.removeEventListener('sales-shop:board-mode-changed', syncBoardMode);
  }, []);


  const activeEntry = entries.find((entry) => entry.id === activeEntryId) ?? null;

  if (view === 'quotes' && !betaQuotesEnabled && !quoteReadOnly && !preview && !(quoteLibraryMode === 'team' && mode === 'cloud' && (teamRole === 'owner' || teamRole === 'admin'))) return null;

  const isEditingQuote = view === 'quotes' && betaQuotesEnabled && !quoteReadOnly && !preview &&
    quoteLibraryMode !== 'team' && betaQuoteLocation.page !== 'library' && activeQuote !== null;
  const canEditQuote = isEditingQuote && activeQuote !== null && quoteIsCommerciallyEditable(activeQuote);
  const backFromQuote = () => window.dispatchEvent(new Event('sales-shop:quotes-beta-back'));
  const openSearch = () => {setProfileOpen(false);searchRef.current?.querySelector<HTMLButtonElement>('.global-search-launcher')?.click();};
  const openCreate = () => {setProfileOpen(false);createRef.current?.querySelector<HTMLButtonElement>('.quick-create-launcher')?.click();};
  const openQuickNote = () => {setProfileOpen(false);window.dispatchEvent(new Event('sales-shop:global-post-it'));};

  const contextTitle = view === 'notebook'
    ? activeEntry?.title || 'Notebook'
    : view === 'catalog'
      ? `Catalog · ${catalogLabel(catalogSection)}`
      : view === 'board'
        ? `Board · ${boardMode === 'accounts' ? 'Accounts' : 'Deals'}`
        : viewLabel(view);

  const chooseView = (next: AppView) => {
    const choice = resolveMobileDrawerChoice(next);
    setOpen(false);
    setView(choice.view);
  };

  return (
    <>
      <WorkspaceToolbar mode="legacy" className={'mobile-app-commandbar'+(isEditingQuote?' is-quote-editing':'')}>
        {isEditingQuote ? <>
          <button type="button" className="mobile-app-back-button mobile-quote-back"
            onClick={backFromQuote} aria-label={betaQuoteLocation.page==='area'?'Back to quote':'Back to Documents'} title="Back">‹</button>
          <button type="button" className="mobile-quote-history-button" disabled={!canEditQuote||quoteUndoDepth===0}
            aria-label="Undo quote edit" title="Undo" onClick={()=>{if(activeQuote)useQuoteStore.getState().undoQuote(activeQuote.id);}}>
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/>
            </svg>
          </button>
          <button type="button" className="mobile-quote-history-button" disabled={!canEditQuote||quoteRedoDepth===0}
            aria-label="Redo quote edit" title="Redo" onClick={()=>{if(activeQuote)useQuoteStore.getState().redoQuote(activeQuote.id);}}>
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/>
            </svg>
          </button>
          <div className="mobile-quote-toolbar-spacer mobile-app-current" aria-label="Quote editor">
            <strong>Quote</strong>
          </div>
        </> : <>
          {canGoBack&&<button type="button" className="mobile-app-back-button"
            onClick={goBack} aria-label="Back to previous SalesShop tab" title="Go back">‹</button>}
          <div className="mobile-app-current">
            <strong>{contextTitle}</strong>
          </div>
        </>}
        {!isEditingQuote&&<div className="mobile-app-help">
          <WorkspaceHelp page={view==='dashboard'?'connections':view}
            section={view==='catalog'?catalogSection:view==='board'?(boardMode==='accounts'?'accounts':'deals'):undefined}/>
        </div>}
        <div className="mobile-quote-actions-slot" id="mobile-quote-actions-slot" aria-label="Document options"/>
        <button ref={navigationButtonRef} type="button" className="mobile-app-menu-button" onClick={openNavigation}
          aria-expanded={open} aria-haspopup="dialog" aria-controls="mobile-app-navigation-popover"
          aria-label="Open SalesShop navigation" title="SalesShop navigation">☰</button>
        <div className="mobile-profile-menu" ref={profileRef}>
          <button type="button" className="mobile-profile-trigger" aria-label="Open profile and tools"
            aria-expanded={profileOpen} aria-haspopup="true" onClick={()=>{setOpen(false);setProfileOpen(v=>!v);}}>
            <span aria-hidden="true">{(user?.email?.trim().charAt(0)||'S').toUpperCase()}</span>
          </button>
          {profileOpen&&<div className="mobile-profile-panel" role="group" aria-label="Profile and tools">
            <div className="mobile-profile-heading">
              <strong>My SalesShop</strong>
              <button type="button" aria-label="Close profile menu" onClick={()=>setProfileOpen(false)}>×</button>
              {user?.email&&<small title={user.email}>{user.email}</small>}
            </div>
            <div className="mobile-profile-tools">
              {!viewer&&!preview&&<button type="button" onClick={openSearch}>⌕ <span>Search SalesShop</span></button>}
              {!viewer&&!scopedMember&&!preview&&<button type="button" onClick={openCreate}>＋ <span>Quick create</span></button>}
              {!preview&&<button type="button" onClick={openQuickNote}>▧ <span>Quick note</span></button>}
            </div>
            <div className="app-profile-theme-shortcuts" aria-label="Quick appearance">
              <span>Appearance</span>
              <div role="group" aria-label="Switch appearance theme">
                {(['warm','light','dark'] as const).map(choice=>
                  <button type="button" key={choice} aria-pressed={quickTheme===choice}
                    onClick={()=>setAppearance({themeChoice:choice})}>
                    {choice==='warm'?'Warm':choice==='light'?'Light':'Dark'}
                  </button>)}
              </div>
            </div>
            <button type="button" className="mobile-profile-settings" onClick={()=>{setProfileOpen(false);setView('settings');}}>⚙ Settings &amp; Profile</button>
            <div className="mobile-profile-build"><small>Loaded build &amp; version</small><BuildBadge compact /></div>
            <div className="mobile-profile-session"><AuthStatus /></div>
          </div>}
        </div>
      </WorkspaceToolbar>
      <div className="mobile-app-hidden-launchers" aria-hidden="true">
        {!viewer&&!preview&&<div ref={searchRef}><GlobalSearch /></div>}
        {!viewer&&!scopedMember&&!preview&&<div ref={createRef}><QuickCreate /></div>}
      </div>
      {open && <div className="mobile-app-drawer-backdrop mobile-app-nav-popover-surface">
        <aside id="mobile-app-navigation-popover" ref={drawerRef} className="mobile-app-drawer" role="dialog" aria-modal="false" aria-label="SalesShop navigation">
          <header>
            <div><span>SalesShop</span><strong>{viewLabel(view)}</strong></div>
            <button type="button" data-dialog-initial-focus onClick={() => setOpen(false)} aria-label="Close navigation">×</button>
          </header>

          <nav className="mobile-app-drawer-nav" aria-label="SalesShop sections">
             {APP_DESTINATIONS.map(item=><button type="button" key={item.view}
               className={view===item.view?'active':''}
               aria-current={view===item.view?'page':undefined}
               onClick={()=>chooseView(item.view)}>
               <span className="mobile-app-drawer-nav-icon"><MobileDestinationIcon view={item.view}/></span>
               <span className="mobile-app-drawer-nav-label">{item.label}</span>
               <span className="mobile-app-drawer-nav-chevron" aria-hidden="true">›</span>
             </button>)}
           </nav>

          

          


        </aside>
      </div>}
    </>
  );
}
