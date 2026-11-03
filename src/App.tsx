import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import './object-layer.css';
import './spreadsheet-object.css';
import './binder-page.css';
import './notebook-patch.css';
import './board.css';
import './board-groups.css';
import './accounts.css';
import './connections-record-pages.css';
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
import './catalog-light-materials.css';
import './notebook-sidebar-compact.css';
import './viewer-workspace.css';
import './role-perspective.css';
import './appearance-themes.css';
import './appearance-picker.css';

import { DeveloperPlaygroundToolbar } from './components/DeveloperPlaygroundToolbar';
import { isDeveloperPlaygroundRoute } from './lib/developerPlayground';
import './developer-playground.css';
import { SalesShopShell, WorkspaceViewport } from './design-system/shell';
import {TaskModalHost} from './components/TaskModalHost';
import { ViewerWorkspace } from './components/ViewerWorkspace';
import { RolePerspectiveBanner, RolePerspectiveSettings } from './components/RolePerspectiveControls';
import { resolveOwnerPerspective } from './services/rolePerspective';
import { useRolePerspectiveStore } from './store/rolePerspectiveStore';
import { useQuoteLibraryStore } from './store/quoteLibraryStore';
import { useAuthStore } from './store/authStore';
import { useAppearanceStore } from './store/appearanceStore';
import { canEditTeamArea } from './services/teamDepartments';
import { Board } from './components/Board';
import { CompanySettings } from './components/CompanySettings';
import { Connections } from './components/Connections';
import {HomeWorkspace} from './components/HomeWorkspace';
import {taskScope,usePersonalTaskStore} from './store/personalTaskStore';
import {startPersonalTaskCloudSync} from './services/personalTaskCloudSync';
import {TasksWorkspace} from './components/TasksWorkspace';
import {SalesCalendarLauncher} from './components/SalesCalendarLauncher';
import {NotebookPromotionDialog} from './components/NotebookPromotionDialog';
import {NotebookCompanionPage} from './components/NotebookCompanionPage';
import {readNotebookSplitPreference,writeNotebookSplitPreference} from './services/notebookSplitPreference';
import './notebook-split-folders.css';
import './catalog-collections.css';
import { DrawingCanvas } from './components/DrawingCanvas';
import { GlobalSearch } from './components/GlobalSearch';
import { MobileAppChrome } from './components/MobileAppChrome';
import { NotebookObjectLayer } from './components/NotebookObjectLayer';
import { QuickCreate } from './components/QuickCreate';
import { AccountMenu } from './components/AccountMenu';
import { BuildBadge } from './components/BuildBadge';
import { GlobalPostItLauncher, GlobalPostItLayer } from './components/GlobalPostIt';
import { Quotes } from './components/Quotes';
import { QuotesMobileBeta } from './components/QuotesMobileBeta';
import { useQuotesMobileBetaStore } from './store/quotesMobileBetaStore';
import { CatalogWorkspace } from './components/CatalogWorkspace';
import { Sidebar } from './components/Sidebar';
import { TextEditor } from './components/TextEditor';
import { Toolbar } from './components/Toolbar';
import { useCompanySettingsStore } from './store/companySettingsStore';
import { useCrmStore } from './store/crmStore';
import { useNavigationStore } from './store/navigationStore';
import { useNotebookStore } from './store/notebookStore';
import {useQuoteStore} from './store/quoteStore';

function App() {
  const view = useNavigationStore((state) => state.view);
  const mode = useAuthStore((state) => state.mode);
  const organizationId = useAuthStore((state) => state.organizationId);
  const loadCompanyPalette = useAppearanceStore((state) => state.loadCompanyPalette);
  const teamRole = useAuthStore((state) => state.teamRole);
  const department = useAuthStore((state) => state.teamDepartment);
  const catalogSection = useNavigationStore((state) => state.catalogSection);
  const previewId = useRolePerspectiveStore((state) => state.activePerspective);
  const preview = resolveOwnerPerspective(previewId, teamRole, mode);
  const effectiveRole = preview?.role ?? teamRole;
  const effectiveDepartment = preview?.department ?? department;
  const inRolePreview = Boolean(preview);
  const quoteLibraryMode = useQuoteLibraryStore((state) => state.mode);
  const mobileQuotesBetaEnabled = useQuotesMobileBetaStore((state) => state.enabled);
  const teamQuotesOverview = view === 'quotes' && quoteLibraryMode === 'team' && mode === 'cloud' && (teamRole === 'owner' || teamRole === 'admin') && !inRolePreview;
  const viewer = mode === 'cloud' && effectiveRole === 'viewer';
  const scopedMember = mode === 'cloud' && effectiveRole === 'member' && effectiveDepartment !== 'general';
  const readOnlyArea = viewer || (scopedMember && (
    ((view === 'board' || view === 'dashboard') && !canEditTeamArea(effectiveRole, effectiveDepartment, 'crm')) ||
    (view === 'quotes' && !canEditTeamArea(effectiveRole, effectiveDepartment, 'quotes')) ||
    (view === 'catalog' && !(catalogSection === 'suppliers' && canEditTeamArea(effectiveRole, effectiveDepartment, 'supplier')))
  ));
  const setView = useNavigationStore((state) => state.setView);
  const syncFromBrowser = useNavigationStore((state)=>state.syncFromBrowser);
  const routeQuoteId=useNavigationStore((state)=>state.focusedQuoteId);
  const quotesHydrated=useQuoteStore((state)=>state.hydrated);
  const openProject = useNavigationStore((state) => state.openProject);
  const hydrate = useNotebookStore((state) => state.hydrate);
  const hydrateCrm = useCrmStore((state) => state.hydrate);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const hydrated = useNotebookStore((state) => state.hydrated);
  const entries = useNotebookStore((state) => state.entries);
  const activeEntryId = useNotebookStore((state) => state.activeEntryId);
  const renameEntry = useNotebookStore((state) => state.renameEntry);
  const projects = useCrmStore((state) => state.projects);
  const crmHydrated = useCrmStore((state) => state.hydrated);
  const loadedTaskScope=usePersonalTaskStore((state)=>state.scope);
  const personalSyncStatus=usePersonalTaskStore((state)=>state.syncStatus);
  const syncDealSubmissionTasks=usePersonalTaskStore((state)=>state.syncDealSubmissionTasks);
  const taskUserId=useAuthStore(s=>s.user?.id);
  const [notebookEditor, setNotebookEditor] = useState<Editor | null>(null);
  const [companionId,setCompanionId]=useState<string|null>(null);
  const [focusedPane,setFocusedPane]=useState<'left'|'right'>('left');
  const [splitStacked,setSplitStacked]=useState(false);
  const splitScope=mode==='cloud'
    ?(organizationId&&taskUserId?'org:'+organizationId+':user:'+taskUserId:null):'local';
  const [restoredSplitScope,setRestoredSplitScope]=useState<string|null>(null);
  const tasksScope=taskScope(mode,organizationId,taskUserId);
  useEffect(()=>{
    usePersonalTaskStore.getState().load(tasksScope);
    if(mode!=='cloud'||!taskUserId||!tasksScope)return;
    return startPersonalTaskCloudSync(tasksScope,taskUserId);
  },[mode,organizationId,taskUserId,tasksScope]);

  useEffect(() => {
    hydrate();
    hydrateCrm();
    void hydrateSettings();
  }, [hydrate, hydrateCrm, hydrateSettings]);
  useEffect(()=>{
    // In cloud mode wait for private Task reconciliation before creating
    // deterministic deal-submission tasks. No duplicate after reload/sync.
    if(!crmHydrated||!tasksScope||loadedTaskScope!==tasksScope||inRolePreview)return;
    if(mode==='cloud'&&(personalSyncStatus!=='saved'||teamRole==='viewer'))return;
    syncDealSubmissionTasks(projects);
  },[crmHydrated,tasksScope,loadedTaskScope,inRolePreview,mode,personalSyncStatus,teamRole,
    projects,syncDealSubmissionTasks]);


  // Browser back/forward updates the same store used by internal navigation.
  useEffect(()=>{
    window.addEventListener('popstate',syncFromBrowser);
    return()=>window.removeEventListener('popstate',syncFromBrowser);
  },[syncFromBrowser]);

  // Deep-linked quotes are selected only after the user's own authorized
  // quote store has hydrated. Missing or inaccessible IDs stay unselected.
  useEffect(()=>{
    if(view!=='quotes'||!routeQuoteId)return;
    const store=useQuoteStore.getState();
    if(!store.hydrated)store.hydrate();
    const current=useQuoteStore.getState();
    const linked=current.quotes.find(q=>q.id===routeQuoteId);
    if(linked?.archivedAt){
      // A stale URL must not silently reopen an archived document on reload.
      // Archived records remain accessible through the appropriate history UI.
      useNavigationStore.getState().setView('quotes');
      return;
    }
    if(linked&&current.activeQuoteId!==routeQuoteId)current.selectQuote(routeQuoteId);
  },[view,routeQuoteId,quotesHydrated]);

  // Appearance is per device, but the default palette follows the active company.
  // The membership RLS lets all teammates read the default; only admins update it.
  useEffect(() => { void loadCompanyPalette(mode === 'cloud' ? organizationId : null); }, [mode, organizationId, loadCompanyPalette]);

  // Split arrangement is device-local, scoped by signed-in account. Neither pane's content is duplicated.
  useEffect(()=>{
    if(!hydrated||!activeEntryId||!splitScope)return;
    const saved=readNotebookSplitPreference(splitScope,activeEntryId,entries.map(e=>e.id));
    setCompanionId(saved.rightId);setSplitStacked(saved.stacked);
    setFocusedPane('left');setRestoredSplitScope(splitScope);
  // Restore only at hydration/account boundaries; selecting another page must not reset the group.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[hydrated,splitScope]);
  useEffect(()=>{
    if(!hydrated||!splitScope||restoredSplitScope!==splitScope)return;
    writeNotebookSplitPreference(splitScope,{rightId:companionId,stacked:splitStacked});
  },[hydrated,splitScope,restoredSplitScope,companionId,splitStacked]);
  const entry = entries.find((candidate) => candidate.id === activeEntryId) ?? null;
  const companion = entries.find(candidate=>candidate.id===companionId&&candidate.id!==activeEntryId)??null;
  const companionOptions=entries.filter(candidate=>candidate.id!==activeEntryId&&(!candidate.hidden||candidate.id===companionId));
  const openCompanion=(id:string)=>{
    if(id!==activeEntryId&&entries.some(candidate=>candidate.id===id)){
      setCompanionId(id);setFocusedPane('right');
    }
  };
  const openPrimary=(id:string)=>{
    if(id===activeEntryId){setFocusedPane('left');return;}
    if(!entries.some(candidate=>candidate.id===id))return;
    if(id===companionId)setCompanionId(activeEntryId);
    useNotebookStore.getState().selectEntry(id);
    setFocusedPane('left');
  };
  const swapPanes=()=>{
    if(!companion)return;
    useNotebookStore.getState().selectEntry(companion.id);
    setCompanionId(entry?.id??null);
    setFocusedPane('left');
  };
  const closeLeftPane=()=>{
    if(!companion)return;
    useNotebookStore.getState().selectEntry(companion.id);
    setCompanionId(null);setFocusedPane('left');
  };
  const closeRightPane=()=>{setCompanionId(null);setFocusedPane('left');};
  const linkedProject = entry?.context?.projectId
    ? projects.find((project) => project.id === entry.context?.projectId) ?? null
    : null;

  // Notebook state should not block Home, Tasks, Catalog or Quotes from opening.
  // Only the Notebook branch depends on its selected entry.
  return (
    <SalesShopShell mode="legacy" className={`sales-app view-${view}${readOnlyArea ? ' sales-app-viewer' : ''}${inRolePreview ? ' owner-perspective-active' : ''}${teamQuotesOverview ? ' team-quotes-overview-active' : ''}`}>
      {isDeveloperPlaygroundRoute() && <DeveloperPlaygroundToolbar />}
      <RolePerspectiveBanner />
      <header className="app-header">
        <div className="brand-lockup"><span className="brand-mark">S</span><strong>SalesShop</strong></div>
        <nav className="app-tabs" aria-label="SalesShop sections">
          <button className={`app-tab ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>Home</button>
          <button className={`app-tab ${view === 'quotes' ? 'active' : ''}`} onClick={() => setView('quotes')}>Quotes</button>
          <button className={`app-tab ${view === 'tasks' ? 'active' : ''}`} onClick={() => setView('tasks')}>Tasks</button>
          <button className={`app-tab ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>Board</button>
          <button className={`app-tab ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>Connections</button>
          <button className={`app-tab ${view === 'notebook' ? 'active' : ''}`} onClick={() => setView('notebook')}>Notebook</button>
          <button className={`app-tab ${view === 'catalog' ? 'active' : ''}`} onClick={() => setView('catalog')}>Catalog</button>
        </nav>
        {!inRolePreview&&<div className="sales-calendar-global"><SalesCalendarLauncher compact /></div>}
        {!viewer && !inRolePreview && <GlobalSearch />}
        {!viewer && !scopedMember && !inRolePreview && <QuickCreate />}
        {!inRolePreview && <GlobalPostItLauncher />}
        <div className="app-account-zone">
          <BuildBadge />
          <AccountMenu />
        </div>
      </header>
      <MobileAppChrome />
      {!inRolePreview && <GlobalPostItLayer />}

      <WorkspaceViewport mode="legacy" className="role-perspective-content" inert={inRolePreview && !readOnlyArea && view !== 'settings'}>
      {inRolePreview && view === 'settings' ? (
        <RolePerspectiveSettings />
      ) : readOnlyArea && view !== 'notebook' && view !== 'settings' && view !== 'tasks' ? (
        <ViewerWorkspace section={view} previewRole={effectiveRole} previewDepartment={effectiveDepartment} />
      ) : view === 'home' ? (
        <HomeWorkspace />
      ) : view === 'tasks' ? (
        <TasksWorkspace />
      ) : view === 'board' ? (
        <Board />
      ) : view === 'quotes' ? (
        mobileQuotesBetaEnabled ? <QuotesMobileBeta /> : <Quotes />
      ) : view === 'catalog' ? (
        <CatalogWorkspace />
      ) : view === 'dashboard' ? (
        <Connections />
      ) : view === 'settings' ? (
        <CompanySettings />
      ) : !hydrated || !entry ? (
        <div className="loading-screen" role="status">Opening Notebook…</div>
      ) : (
        <main className={`notebook-workspace ${companion?'is-side-by-side':''}`}>
          <Sidebar onOpenBeside={openCompanion} onOpenLeft={openPrimary}
            companionId={companion?.id??null} activePane={companion?focusedPane:'left'}
            stacked={splitStacked} onToggleStack={()=>setSplitStacked(s=>!s)}
            onSwap={swapPanes} onCloseLeft={closeLeftPane} onCloseRight={closeRightPane}
            onFocusPane={setFocusedPane}/>
          <section className="binder-stage">
            <div className="notebook-split-controls">
              <strong>{companion?(splitStacked?'Stacked pages':'Split pages'):'Single page'}</strong>
              <SalesCalendarLauncher compact />
              {companion&&<select aria-label="Choose second Notebook page" value={companion.id}
                onChange={event=>openCompanion(event.target.value)}>
                {companionOptions.map(page=><option key={page.id} value={page.id}>{page.title||'Untitled page'}</option>)}
              </select>}
              {companion&&<button type="button" onClick={()=>setSplitStacked(s=>!s)}
                aria-pressed={splitStacked}>{splitStacked?'◫ Side by side':'▤ Stack'}</button>}
              <button type="button" disabled={!companion&&companionOptions.length===0}
                aria-pressed={!!companion} onClick={()=>{
                  if(companion)closeRightPane();
                  else if(companionOptions[0])openCompanion(companionOptions[0].id);
                }}>{companion?'Close split':'▥ Side by side'}</button>
            </div>
            <div className={`notebook-panes ${companion?'is-split':''} ${splitStacked?'is-stacked':''}`}>
            <div data-notebook-pane="left"
              className={`notebook-primary-pane ${focusedPane==='left'||!companion?'is-focused-pane':''}`}
              onPointerDownCapture={()=>setFocusedPane('left')}
              onFocusCapture={()=>setFocusedPane('left')}>
              <Toolbar entry={entry} editor={notebookEditor} enableShortcuts splitMode={!!companion}
                activePane={focusedPane==='left'||!companion}/>
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
                  <DrawingCanvas key={`ink-${entry.id}`} entry={entry} activePane={focusedPane==='left'||!companion} />
                  <NotebookObjectLayer key={`objects-${entry.id}`} entry={entry}
                    activePane={focusedPane==='left'||!companion} />
                </div>
              </article>
              </div>
            </div>
            {companion&&<NotebookCompanionPage entry={companion} onMakePrimary={swapPanes}
              onClose={closeRightPane} active={focusedPane==='right'}
              onFocus={()=>setFocusedPane('right')}/>}
            </div>
          </section>
        </main>
      )}
      </WorkspaceViewport>
      {!inRolePreview&&<TaskModalHost/>}
      {!inRolePreview&&<NotebookPromotionDialog/>}
    </SalesShopShell>
  );
}

export default App;
