import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import './object-layer.css';
import './spreadsheet-object.css';
import './binder-page.css';
import './notebook-patch.css';
import './board.css';
import './board-groups.css';
import './accounts.css';
import './notebook-project-links.css';
import './quotes.css';
import './customer-document-brand.css';
import './quote-integrity.css';
import './dashboard.css';
import './company-settings.css';
import './rate-book.css';
import './rate-book-spreadsheet-qc.css';
import './material-level-guide.css';
import './supplier-import.css';
import './supplier-import-v2.css';
import './sinks-workspace.css';
import './quote-sink-lines.css';
import './quote-area-scope.css';
import './quote-database-results.css';
import './quote-clean-sheet.css';
import './quote-select-leave.css';
import './quote-popover-polish.css';
import './quote-mobile-pass.css';
import './catalog-workspace.css';
import './viewer-workspace.css';
import { AuthStatus } from './components/AuthGate';
import { ViewerWorkspace } from './components/ViewerWorkspace';
import { useAuthStore } from './store/authStore';
import { canEditTeamArea } from './services/teamDepartments';
import { Board } from './components/Board';
import { CompanySettings } from './components/CompanySettings';
import { Connections } from './components/Connections';
import { DrawingCanvas } from './components/DrawingCanvas';
import { GlobalSearch } from './components/GlobalSearch';
import { MobileAppChrome } from './components/MobileAppChrome';
import { NotebookObjectLayer } from './components/NotebookObjectLayer';
import { QuickCreate } from './components/QuickCreate';
import { Quotes } from './components/Quotes';
import { CatalogWorkspace } from './components/CatalogWorkspace';
import { Sidebar } from './components/Sidebar';
import { TextEditor } from './components/TextEditor';
import { Toolbar } from './components/Toolbar';
import { useCompanySettingsStore } from './store/companySettingsStore';
import { useCrmStore } from './store/crmStore';
import { useNavigationStore } from './store/navigationStore';
import { useNotebookStore } from './store/notebookStore';

function App() {
  const view = useNavigationStore((state) => state.view);
  const mode = useAuthStore((state) => state.mode);
  const teamRole = useAuthStore((state) => state.teamRole);
  const department = useAuthStore((state) => state.teamDepartment);
  const catalogSection = useNavigationStore((state) => state.catalogSection);
  const viewer = mode === 'cloud' && teamRole === 'viewer';
  const scopedMember = mode === 'cloud' && teamRole === 'member' && department !== 'general';
  const readOnlyArea = viewer || (scopedMember && (
    ((view === 'board' || view === 'dashboard') && !canEditTeamArea(teamRole, department, 'crm')) ||
    (view === 'quotes' && !canEditTeamArea(teamRole, department, 'quotes')) ||
    (view === 'catalog' && !(catalogSection === 'suppliers' && canEditTeamArea(teamRole, department, 'supplier')))
  ));
  const setView = useNavigationStore((state) => state.setView);
  const openProject = useNavigationStore((state) => state.openProject);
  const hydrate = useNotebookStore((state) => state.hydrate);
  const hydrateCrm = useCrmStore((state) => state.hydrate);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const hydrated = useNotebookStore((state) => state.hydrated);
  const entries = useNotebookStore((state) => state.entries);
  const activeEntryId = useNotebookStore((state) => state.activeEntryId);
  const renameEntry = useNotebookStore((state) => state.renameEntry);
  const projects = useCrmStore((state) => state.projects);
  const [notebookEditor, setNotebookEditor] = useState<Editor | null>(null);

  useEffect(() => {
    hydrate();
    hydrateCrm();
    void hydrateSettings();
  }, [hydrate, hydrateCrm, hydrateSettings]);

  const entry = entries.find((candidate) => candidate.id === activeEntryId) ?? null;
  const linkedProject = entry?.context?.projectId
    ? projects.find((project) => project.id === entry.context?.projectId) ?? null
    : null;

  if (!hydrated || !entry) return <div className="loading-screen">Opening SalesShop…</div>;

  return (
    <div className={`sales-app view-${view}${readOnlyArea ? ' sales-app-viewer' : ''}`}>
      <header className="app-header">
        <div className="brand-lockup"><span className="brand-mark">S</span><strong>SalesShop</strong></div>
        <nav className="app-tabs" aria-label="SalesShop sections">
          <button className={`app-tab ${view === 'notebook' ? 'active' : ''}`} onClick={() => setView('notebook')}>Notebook</button>
          <button className={`app-tab ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>Board</button>
          <button className={`app-tab ${view === 'quotes' ? 'active' : ''}`} onClick={() => setView('quotes')}>Quotes</button>
          <button className={`app-tab ${view === 'catalog' ? 'active' : ''}`} onClick={() => setView('catalog')}>Catalog</button>
          <button className={`app-tab ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>Connections</button>
          <button className={`app-tab ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>Settings</button>
          <button className="app-tab" disabled title="Migrates in a later batch">Memory</button>
        </nav>
        {!viewer && <GlobalSearch />}
        {!viewer && !scopedMember && <QuickCreate />}
        <div className="app-account-zone">
          <div className="migration-chip">React foundation</div>
          <AuthStatus />
        </div>
      </header>
      <MobileAppChrome />

      {readOnlyArea && view !== 'notebook' && view !== 'settings' ? (
        <ViewerWorkspace section={view} />
      ) : view === 'board' ? (
        <Board />
      ) : view === 'quotes' ? (
        <Quotes />
      ) : view === 'catalog' ? (
        <CatalogWorkspace />
      ) : view === 'dashboard' ? (
        <Connections />
      ) : view === 'settings' ? (
        <CompanySettings />
      ) : (
        <main className="notebook-workspace">
          <Sidebar />
          <section className="binder-stage">
            <Toolbar entry={entry} editor={notebookEditor} />
            <div className="desk-surface">
              <article className={`paper-sheet paper-${entry.paperStyle} tone-${entry.tone} texture-${entry.texture}`}>
                <div className="paper-edge" aria-hidden="true" />
                <header className="paper-heading">
                  <input className="paper-title" value={entry.title}
                    onChange={(event) => renameEntry(entry.id, event.target.value)} aria-label="Page title" />
                  <div className="paper-meta-line">
                    {entry.favorite && <span className="paper-favorite-mark" title="Favorite page">★</span>}
                    {entry.openAtStart && <span className="paper-start-mark" title="Favorite opens at start">⌂</span>}
                    {entry.hidden && <span className="paper-hidden-mark" title="Hidden private sheet">◌</span>}
                    {entry.deletionLocked && <span className="paper-lock-mark" title="Deletion locked">▣</span>}
                    <span>{new Date(entry.updatedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                    <span className="paper-meta-separator">·</span>
                    <span className="paper-meta-extra">{entry.paperStyle.replace('-', ' ')}</span>
                    {linkedProject && (
                      <>
                        <span className="paper-meta-separator">·</span>
                        <button type="button" className="paper-project-context" onClick={() => openProject(linkedProject.id)}
                          title={`Open ${linkedProject.name} on the Board`}>
                          {linkedProject.name}{linkedProject.companyName ? ` · ${linkedProject.companyName}` : ''}
                        </button>
                      </>
                    )}
                    <span className="paper-meta-separator paper-meta-extra">·</span>
                    <span className="paper-meta-extra">Created {new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>
                </header>
                <div className="paper-writing-surface">
                  <TextEditor key={`text-${entry.id}`} entry={entry} onEditorReady={setNotebookEditor} />
                  <DrawingCanvas key={`ink-${entry.id}`} entry={entry} />
                  <NotebookObjectLayer key={`objects-${entry.id}`} entry={entry} />
                </div>
              </article>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
