import { useEffect, useMemo, useState } from 'react';
import { useNavigationStore, type AppView, type CatalogSection } from '../store/navigationStore';
import { useNotebookStore } from '../store/notebookStore';
import { useDismissibleLayer } from '../lib/useDismissibleLayer';
import { resolveMobileDrawerChoice } from '../lib/mobileDrawerNavigation';
import { AuthStatus } from './AuthGate';
import { GlobalSearch } from './GlobalSearch';
import { QuickCreate } from './QuickCreate';
import { useAuthStore } from '../store/authStore';
import { canEditTeamArea } from '../services/teamDepartments';
import { resolveOwnerPerspective } from '../services/rolePerspective';
import { useRolePerspectiveStore } from '../store/rolePerspectiveStore';
import { RolePerspectivePicker } from './RolePerspectiveControls';

const APP_DESTINATIONS: Array<{ view: AppView; label: string; short: string }> = [
  { view: 'notebook', label: 'Notebook', short: 'Notebook' },
  { view: 'board', label: 'Board', short: 'Board' },
  { view: 'quotes', label: 'Quotes', short: 'Quotes' },
  { view: 'catalog', label: 'Catalog', short: 'Catalog' },
  { view: 'dashboard', label: 'Connections', short: 'Connections' },
  { view: 'settings', label: 'Settings', short: 'Settings' },
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
  const teamRole = useAuthStore((state) => state.teamRole);
  const department = useAuthStore((state) => state.teamDepartment);
  const previewId = useRolePerspectiveStore((state) => state.activePerspective);
  const preview = resolveOwnerPerspective(previewId, teamRole, mode);
  const effectiveRole = preview?.role ?? teamRole;
  const effectiveDepartment = preview?.department ?? department;
  const viewer = mode === 'cloud' && effectiveRole === 'viewer';
  const scopedMember = mode === 'cloud' && effectiveRole === 'member' && effectiveDepartment !== 'general';
  const quoteReadOnly = viewer || (scopedMember && !canEditTeamArea(effectiveRole, effectiveDepartment, 'quotes'));
  const setView = useNavigationStore((state) => state.setView);
  const catalogSection = useNavigationStore((state) => state.catalogSection);
  const setCatalogSection = useNavigationStore((state) => state.setCatalogSection);

  const entries = useNotebookStore((state) => state.entries);
  const activeEntryId = useNotebookStore((state) => state.activeEntryId);
  const selectEntry = useNotebookStore((state) => state.selectEntry);
  const createEntry = useNotebookStore((state) => state.createEntry);

  const [open, setOpen] = useState(false);
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const openNavigation = () => {
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

  if (view === 'quotes' && !quoteReadOnly && !preview) return null;

  const contextTitle = view === 'notebook'
    ? activeEntry?.title || 'Notebook'
    : view === 'catalog'
      ? `Catalog · ${catalogLabel(catalogSection)}`
      : view === 'board'
        ? `Board · ${boardMode === 'accounts' ? 'Accounts' : 'Projects'}`
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
      <header className="mobile-app-commandbar">
        <button type="button" className="mobile-app-menu-button" onClick={openNavigation} aria-label="Open SalesShop navigation">☰</button>
        <div className="mobile-app-current">
          <span>SalesShop</span>
          <strong>{contextTitle}</strong>
        </div>
        <RolePerspectivePicker compact />
        {!viewer && !preview && <GlobalSearch />}
        {!viewer && !scopedMember && !preview && <QuickCreate />}
      </header>

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

          {view === 'notebook' && !catalogExpanded && <section className="mobile-app-context-section">
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
                <strong>Projects</strong><small>Work we are trying to win or perform</small>
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

          <footer><AuthStatus /></footer>
        </aside>
      </div>}
    </>
  );
}
