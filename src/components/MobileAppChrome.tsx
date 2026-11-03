import { useEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceToolbar } from '../design-system/shell';
import { useNavigationStore, type AppView, type CatalogSection } from '../store/navigationStore';
import { useNotebookStore } from '../store/notebookStore';
import { useDismissibleLayer } from '../lib/useDismissibleLayer';
import { resolveMobileDrawerChoice } from '../lib/mobileDrawerNavigation';
import { AuthStatus } from './AuthGate';
import { GlobalSearch } from './GlobalSearch';
import { QuickCreate } from './QuickCreate';
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

const CATALOG_SECTIONS: Array<{ id: CatalogSection; label: string }> = [
  { id: 'materials', label: 'Materials' },
  { id: 'sinks', label: 'Sinks' },
  { id: 'other', label: 'Other' },
  { id: 'rates', label: 'Rates' },
  { id: 'suppliers', label: 'Suppliers' },
];

function viewLabel(view: AppView) {
  return APP_DESTINATIONS.find((item) => item.view === view)?.label ?? 'SalesShop';
}

function catalogLabel(section: CatalogSection) {
  return CATALOG_SECTIONS.find((item) => item.id === section)?.label ?? 'Catalog';
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
  const setCatalogSection = useNavigationStore((state) => state.setCatalogSection);

  const entries = useNotebookStore((state) => state.entries);
  const activeEntryId = useNotebookStore((state) => state.activeEntryId);
  const selectEntry = useNotebookStore((state) => state.selectEntry);
  const createEntry = useNotebookStore((state) => state.createEntry);

  const [open, setOpen] = useState(false);
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
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const openNavigation = () => {
    setProfileOpen(false);
    // Every entry starts at the top level: Catalog only expands after an explicit tap.
    setCatalogExpanded(false);
    setOpen(true);
  };
  const drawerRef = useDismissibleLayer<HTMLElement>(open, () => setOpen(false));
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
  const visibleEntries = useMemo(
    () => entries
      .filter((entry) => !entry.hidden || entry.id === activeEntryId)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt)),
    [entries, activeEntryId],
  );

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
    const choice = resolveMobileDrawerChoice(next, catalogExpanded);
    if (choice.kind === 'toggle-catalog') {
      setCatalogExpanded(choice.expanded);
      return;
    }
    setOpen(false);
    setCatalogExpanded(false);
    setView(choice.view);
  };

  return (
    <>
      <WorkspaceToolbar mode="legacy" className={'mobile-app-commandbar'+(isEditingQuote?' is-quote-editing':'')}>
        {isEditingQuote ? <>
          <button type="button" className="mobile-app-back-button mobile-quote-back"
            onClick={backFromQuote} aria-label={betaQuoteLocation.page==='area'?'Back to quote':'Back to Documents'} title="Back">‹</button>
          <button type="button" className="mobile-quote-history-button" disabled={!canEditQuote||quoteUndoDepth===0}
            aria-label="Undo quote edit" title="Undo" onClick={()=>{if(activeQuote)useQuoteStore.getState().undoQuote(activeQuote.id);}}>↶</button>
          <button type="button" className="mobile-quote-history-button" disabled={!canEditQuote||quoteRedoDepth===0}
            aria-label="Redo quote edit" title="Redo" onClick={()=>{if(activeQuote)useQuoteStore.getState().redoQuote(activeQuote.id);}}>↷</button>
          <span className="mobile-quote-toolbar-spacer" aria-hidden="true"/>
        </> : <>
          {canGoBack&&<button type="button" className="mobile-app-back-button"
            onClick={goBack} aria-label="Back to previous SalesShop tab" title="Go back">‹</button>}
          <div className="mobile-app-current">
            {view!=='quotes'&&<strong>{contextTitle}</strong>}
          </div>
        </>}
        <button type="button" className="mobile-app-menu-button" onClick={openNavigation}
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
      {open && <div className="mobile-app-drawer-backdrop" onPointerDown={() => setOpen(false)}>
        <aside ref={drawerRef} className="mobile-app-drawer" role="dialog" aria-modal="true" aria-label="SalesShop navigation" onPointerDown={(event) => event.stopPropagation()}>
          <header>
            <div><span>SalesShop</span><strong>{viewLabel(view)}</strong></div>
            <button type="button" data-dialog-initial-focus onClick={() => setOpen(false)} aria-label="Close navigation">×</button>
          </header>

          <nav className="mobile-app-drawer-nav" aria-label="SalesShop sections">
            {APP_DESTINATIONS.map((item) => (
              <button type="button" key={item.view}
                className={`${view === item.view ? 'active' : ''} ${item.view === 'catalog' && catalogExpanded ? 'is-expanded' : ''}`.trim()}
                onClick={() => chooseView(item.view)}
                aria-expanded={item.view === 'catalog' ? catalogExpanded : undefined}
                aria-controls={item.view === 'catalog' ? 'mobile-catalog-destinations' : undefined}
              >
                {item.short}{item.view === 'catalog' && <span className="mobile-app-catalog-chevron" aria-hidden="true">{catalogExpanded ? '⌃' : '⌄'}</span>}
              </button>
            ))}
          </nav>

          {view === 'notebook' && !catalogExpanded && !preview && <section className="mobile-app-context-section">
            <header>
              <div><strong>Notebook pages</strong><small>{visibleEntries.length} visible</small></div>
              <button type="button" onClick={() => { createEntry(); setOpen(false); }}>+ New</button>
            </header>
            <div className="mobile-notebook-page-list">
              {visibleEntries.map((entry) => (
                <button type="button" key={entry.id} className={entry.id === activeEntryId ? 'active' : ''} onClick={() => { selectEntry(entry.id); setOpen(false); }}>
                  <span>{entry.favorite ? '★' : 'PAGE'}</span>
                  <strong>{entry.title || 'Untitled page'}</strong>
                  <small>{new Date(entry.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
                </button>
              ))}
            </div>
          </section>}

          {view === 'board' && !viewer && !preview && !(scopedMember && !canEditTeamArea(effectiveRole, effectiveDepartment, 'crm')) && !catalogExpanded && <section className="mobile-app-context-section mobile-board-context-section">
            <header><div><strong>Board view</strong><small>One CRM, two lenses</small></div></header>
            <div className="mobile-board-mode-list">
              <button type="button" className={boardMode === 'projects' ? 'active' : ''} onClick={() => {
                setBoardMode('projects');
                window.dispatchEvent(new CustomEvent('sales-shop:board-mode-request', { detail: { mode: 'projects' } }));
                setOpen(false);
              }}>
                <strong>Deals</strong><small>Work we are trying to win or perform</small>
              </button>
              <button type="button" className={boardMode === 'accounts' ? 'active' : ''} onClick={() => {
                setBoardMode('accounts');
                window.dispatchEvent(new CustomEvent('sales-shop:board-mode-request', { detail: { mode: 'accounts' } }));
                setOpen(false);
              }}>
                <strong>Accounts</strong><small>Customer relationship health</small>
              </button>
            </div>
          </section>}

          {catalogExpanded && <section id="mobile-catalog-destinations" className="mobile-app-context-section mobile-catalog-destinations">
            <header><div><strong>Choose a Catalog section</strong><small>Select a destination to open it</small></div></header>
            <div className="mobile-catalog-section-list">
              {CATALOG_SECTIONS.map((item) => (
                <button type="button" key={item.id} className={view === 'catalog' && catalogSection === item.id ? 'active' : ''}
                  aria-current={view === 'catalog' && catalogSection === item.id ? 'page' : undefined}
                  onClick={() => { setCatalogSection(item.id); setCatalogExpanded(false); setOpen(false); }}>
                  {item.label}
                </button>
              ))}
            </div>
          </section>}


        </aside>
      </div>}
    </>
  );
}
