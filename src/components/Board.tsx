import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import '../project-activity.css';
import '../board-integrity.css';
import { projectAttentionFlags } from '../services/boardIntegrity';
import { quotesForProject } from '../services/quoteCrmLinks';
import { displayQuoteNumber, quoteTotal } from '../types/quote';
import { useQuoteStore } from '../store/quoteStore';
import { AccountsBoard } from './AccountsBoard';
import {RecordPreviewDrawer,type PreviewRecord} from './RecordPreviewDrawer';
import { Button, PageHeader } from '../design-system/components';
import {BoardQuickCreate} from './BoardQuickCreate';
import {useDismissiblePopover} from './useDismissibleDetails';
import { useDismissibleLayer } from '../lib/useDismissibleLayer';
import { MobileBoardStagePicker } from './MobileBoardStagePicker';
import { WorkspaceLoadingState } from './WorkspaceLoadingState';
import { detachNotebookPagesForProject, ProjectNotebookLinks } from './ProjectNotebookLinks';
import {
  isMobileBoardInteraction,
  rememberMobileBoardStage,
  rememberMobileColumnScroll,
  restoreMobileBoardState,
} from '../lib/mobileBoardState';
import { useCrmStore } from '../store/crmStore';
import { useNavigationStore } from '../store/navigationStore';
import {DEAL_PIPELINES,PROJECT_STAGES,dealPipelineLabel,matchesDealPipeline,
  type DealPipeline,type DealPipelineFilter,type Project,type ProjectPatch,type ProjectStage} from '../types/crm';
import {DealAssigneeSelect} from '../services/dealAssignees';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const PROJECT_BOARD_POSITION_KEY = 'salesshop-mobile-board-projects-v1';
const BOARD_MODE_KEY = 'salesshop-board-mode-v1';
const BOARD_COMPACT_KEY = 'salesshop-board-compact-v1';
const BOARD_COLLAPSED_KEY = 'salesshop-board-collapsed-v1';
const BOARD_PIPELINE_KEY = 'salesshop-board-pipeline-v1';
function initialPipelineView():DealPipelineFilter {
  try{
    const key=window.localStorage.getItem(BOARD_PIPELINE_KEY);
    if(key==='all'||key==='unassigned'||DEAL_PIPELINES.some(item=>item.id===key))return key as DealPipelineFilter;
  }catch{/* no browser storage */}
  return 'all';
}

function savedCollapsedStages():string[] {
  try {
    const value=JSON.parse(window.localStorage.getItem(BOARD_COLLAPSED_KEY)||'[]');
    return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];
  }catch{return [];}
}

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function initialBoardMode(): 'projects' | 'accounts' {
  if (typeof window === 'undefined') return 'projects';
  return window.sessionStorage.getItem(BOARD_MODE_KEY) === 'accounts' ? 'accounts' : 'projects';
}

function ProjectCard({ project, onOpen, onDragStart, mobileInteraction }: {
  project: Project;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  mobileInteraction: boolean;
}) {
  const attention = projectAttentionFlags(project).slice(0, 2);
  return (
    <article
      className="project-card"
      draggable={!mobileInteraction}
      onDragStart={mobileInteraction ? undefined : onDragStart}
      onClick={mobileInteraction ? onOpen : undefined}
      tabIndex={0}
      onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }}
      title={mobileInteraction ? 'Tap name to preview' : 'Drag card to move · click name to preview'}
    >
      <div className="project-card-pin" aria-hidden="true" />
      <div className="project-card-company">{project.companyName || 'Unassigned company'}</div>
      <div className="project-card-title-row">
        <h3><button type="button" className="board-entity-name"
          aria-label={'Preview deal '+project.name}
          onClick={event=>{event.stopPropagation();onOpen();}}>{project.name}</button></h3>
        {Boolean(project.amount) && <strong className="project-card-title-value">{money.format(project.amount ?? 0)}</strong>}
      </div>
      {(project.amount || project.dueDate) && (
        <div className="project-card-facts">
          {Boolean(project.amount) && <strong>{money.format(project.amount ?? 0)}</strong>}
          {project.dueDate && <span>Due {formatDate(project.dueDate)}</span>}
        </div>
      )}
      {project.nextAction && <div className="project-next-action">→ {project.nextAction}</div>}
      {attention.length > 0 && <div className="project-attention-flags" aria-label="Deal attention">
        {attention.map((flag) => <span key={flag.kind} className={`attention-${flag.kind}`}>{flag.label}</span>)}
      </div>}
      {project.lastTouchpoint && <div className="project-last-touch">Last touch {formatDate(project.lastTouchpoint)}</div>}
      <button type="button" className="project-card-open" onClick={(event) => { event.stopPropagation(); onOpen(); }}>Edit</button>
    </article>
  );
}

function ProjectEditor({ project, onClose }: { project: Project; onClose: () => void }) {
  const updateProject = useCrmStore((state) => state.updateProject);
  const assignProject = useCrmStore((state) => state.assignProject);
  const deleteProject = useCrmStore((state) => state.deleteProject);
  const activities = useCrmStore((state) => state.activities);
  const quotes = useQuoteStore((state) => state.quotes);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const createQuote = useQuoteStore((state) => state.createQuote);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const openDeal = useNavigationStore((state) => state.openProject);
  useEffect(() => { hydrateQuotes(); }, [hydrateQuotes]);
  const linkedQuotes = quotesForProject(project, quotes).filter((quote) => !quote.archivedAt);
  const dialogRef = useDismissibleLayer<HTMLElement>(true, onClose);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [draft, setDraft] = useState({
    name: project.name,
    companyName: project.companyName ?? '',
    assignedUserId: project.assignedUserId ?? '',
    stage: project.stage,
    pipeline: (project.pipeline ?? '') as DealPipeline | '',
    amount: project.amount?.toString() ?? '',
    dueDate: project.dueDate ?? '',
    nextAction: project.nextAction ?? '',
    lastTouchpoint: project.lastTouchpoint ?? '',
  });

  useEffect(() => {
    setDraft({
      name: project.name,
      companyName: project.companyName ?? '',
      assignedUserId: project.assignedUserId ?? '',
      stage: project.stage,
      pipeline: (project.pipeline ?? '') as DealPipeline | '',
      amount: project.amount?.toString() ?? '',
      dueDate: project.dueDate ?? '',
      nextAction: project.nextAction ?? '',
      lastTouchpoint: project.lastTouchpoint ?? '',
    });
  }, [project]);

  const projectActivities = useMemo(() => activities
    .filter((activity) => activity.projectId === project.id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 10), [activities, project.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if(saving)return;
    setSaving(true);setSaveError('');
    try{
    if((project.assignedUserId??'')!==draft.assignedUserId)
      await assignProject(project.id,draft.assignedUserId||undefined);
    const patch: ProjectPatch = {
      name: draft.name,
      companyName: draft.companyName,
      stage: draft.stage,
      pipeline: draft.pipeline || undefined,
      amount: draft.amount.trim() ? Number(draft.amount) : undefined,
      dueDate: draft.dueDate || undefined,
      nextAction: draft.nextAction.trim() || undefined,
      lastTouchpoint: draft.lastTouchpoint || undefined,
    };
    updateProject(project.id, patch);
    onClose();
    }catch(reason){setSaveError(reason instanceof Error?reason.message:'Unable to save Deal assignment.');}
    finally{setSaving(false);}
  };

  return (
    <div className="project-editor-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialogRef} role="dialog" aria-modal="true" className="project-editor" aria-label="Edit deal">
        <header>
          <div><span className="board-eyebrow">Deal card</span><h2>{project.name}</h2></div>
          <button type="button" className="editor-close" data-dialog-initial-focus onClick={onClose} aria-label="Close editor">×</button>
        </header>

        <form onSubmit={submit}>
          <label><span>Deal name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}  /></label>
          <label><span>Company</span><input value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} placeholder="Optional" /></label>
          <div className="editor-two-up">
            <label><span>Stage</span><select value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value as ProjectStage })}>{PROJECT_STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
            <label><span>Amount</span><input type="number" min="0" step="0.01" inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="$0" /></label>
          </div>
          <label><span>Pipeline</span><select value={draft.pipeline}
            onChange={event=>setDraft({...draft,pipeline:event.target.value as DealPipeline | ''})}>
            <option value="">Unassigned</option>
            {DEAL_PIPELINES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <div className="editor-two-up">
            <label><span>Due date</span><input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label>
            <label><span>Last touch</span><input type="date" value={draft.lastTouchpoint} onChange={(event) => setDraft({ ...draft, lastTouchpoint: event.target.value })} /></label>
          </div>
          <label><span>Assigned salesperson</span><DealAssigneeSelect
            value={draft.assignedUserId} onChange={value=>setDraft({...draft,assignedUserId:value})}
            disabled={saving}/></label>
          <label><span>Next action</span><textarea value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} placeholder="What should happen next?" /></label>

          <section className="crm-linked-quotes" aria-label="Deal quotes">
            <header><div><span className="board-eyebrow">Quotes and pipeline</span><h3>Linked quotes</h3></div><span>{linkedQuotes.length}</span></header>
            <p>Drafts stay in progress. Sending a quote records activity and updates the sales pipeline using the existing status rules.</p>
            <div className="crm-linked-quote-list">
              {linkedQuotes.map((quote) => <button type="button" key={quote.id} className="crm-linked-quote-row" onClick={() => openQuote(quote.id)}>
                <strong>{quote.title || 'Untitled quote'}</strong>
                <span>{displayQuoteNumber(quote)} · {quote.status}{quoteTotal(quote) ? ` · ${money.format(quoteTotal(quote))}` : ''}</span>
              </button>)}
              {!linkedQuotes.length && <small>No quotes explicitly linked yet.</small>}
            </div>
            <button type="button" className="crm-linked-create" onClick={() => {
              const id = createQuote({
                title: project.name,
                projectId: project.id,
                companyId: project.companyId,
                companyName: project.companyName,
              });
              openQuote(id);
            }}>+ New quote for deal</button>
          </section>

          <button type="button" className="crm-linked-create" onClick={() => { onClose(); openDeal(project.id); }}>Open full deal page →</button>
          <ProjectNotebookLinks project={project} />

          <details className="project-activity-panel" aria-label="Deal activity history">
            <summary><span className="board-eyebrow">Activity history</span></summary>
            <header>
              <div><span className="board-eyebrow">Recorded history</span><h3>Activity</h3></div>
              <span>{projectActivities.length ? `${projectActivities.length} recent` : 'No activity yet'}</span>
            </header>
            <div className="project-activity-list">
              {projectActivities.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  className={`project-activity-row activity-${activity.type}`}
                  onClick={() => activity.quoteId ? openQuote(activity.quoteId) : undefined}
                  disabled={!activity.quoteId}
                  title={activity.quoteId ? 'Open quote' : undefined}
                >
                  <span className="activity-dot" aria-hidden="true" />
                  <span className="activity-copy">
                    <strong>{activity.summary}</strong>
                    {activity.metadata?.source && <small>{activity.metadata.source === 'quote' ? 'From quote workflow' : 'Board update'}</small>}
                  </span>
                  <time>{formatActivityTime(activity.occurredAt)}</time>
                </button>
              ))}
              {!projectActivities.length && <div className="project-activity-empty">No recorded history for this deal.</div>}
            </div>
          </details>

          {saveError&&<p role="alert" className="project-editor-save-error">{saveError}</p>}
          <div className="editor-actions">
            <button type="button" className="danger-button" onClick={() => {
              if (window.confirm(`Delete ${project.name}?`)) {
                detachNotebookPagesForProject(project.id);
                deleteProject(project.id);
                onClose();
              }
            }}>Delete</button>
            <div className="editor-action-spacer" />
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>{saving?'Saving…':'Save deal'}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export function Board() {
  const hydrate = useCrmStore((state) => state.hydrate);
  const hydrated = useCrmStore((state) => state.hydrated);
  const projects = useCrmStore((state) => state.projects);
  const createProject = useCrmStore((state) => state.createProject);
  const moveProject = useCrmStore((state) => state.moveProject);
  const focusedProjectId = useNavigationStore((state) => state.focusedProjectId);
  const focusedCompanyId = useNavigationStore((state) => state.focusedCompanyId);
  const clearFocusedProject = useNavigationStore((state) => state.clearFocusedProject);
  const [boardMode, setBoardModeState] = useState<'projects' | 'accounts'>(initialBoardMode);
  const [boardSearch,setBoardSearch]=useState('');
  const [pipelineView,setPipelineView]=useState<DealPipelineFilter>(initialPipelineView);
  const [pipelineMenuOpen,setPipelineMenuOpen]=useState(false);
  const pipelineMenuRef=useRef<HTMLDivElement>(null);
  useDismissiblePopover(pipelineMenuRef,pipelineMenuOpen,()=>setPipelineMenuOpen(false),'.board-pipeline-more-trigger');
  const [compactCards,setCompactCards]=useState(()=>{
    try{return window.localStorage.getItem(BOARD_COMPACT_KEY)==='true';}
    catch{return false;}
  });
  const [collapsedStages,setCollapsedStages]=useState<string[]>(savedCollapsedStages);
  const toggleCompact=()=>setCompactCards(current=>!current);
  const isStageCollapsed=(mode:'projects'|'accounts',stage:string)=>
    collapsedStages.includes(mode+':'+stage);
  const toggleStage=(mode:'projects'|'accounts',stage:string)=>{
    const key=mode+':'+stage;
    setCollapsedStages(current=>current.includes(key)?
      current.filter(item=>item!==key):[...current,key]);
  };
  useEffect(()=>{try{window.localStorage.setItem(BOARD_COMPACT_KEY,String(compactCards));}catch{}},[compactCards]);
  useEffect(()=>{try{window.localStorage.setItem(BOARD_PIPELINE_KEY,pipelineView);}catch{}},[pipelineView]);
  useEffect(()=>{try{window.localStorage.setItem(BOARD_COLLAPSED_KEY,JSON.stringify(collapsedStages));}catch{}},[collapsedStages]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview,setPreview]=useState<PreviewRecord|null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragStage, setDragStage] = useState<ProjectStage | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const mobileInteraction = isMobileBoardInteraction();

  const setBoardMode = (mode: 'projects' | 'accounts') => {
    if (mobileInteraction && mode !== boardMode) {
      // The two Board modes have different header heights. Do not inherit the
      // old mode's vertical offset or lift the shared command bar offscreen.
      const oldBoard=document.querySelector<HTMLElement>('.sales-app.view-board .board-view');
      if(oldBoard)oldBoard.scrollTop=0;
      document.querySelectorAll<HTMLElement>('.sales-app.view-board .role-perspective-content, .sales-app.view-board .project-board')
        .forEach(node=>{node.scrollTop=0;});
    }
    setBoardModeState(mode);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(BOARD_MODE_KEY, mode);
      window.dispatchEvent(new CustomEvent('sales-shop:board-mode-changed', { detail: { mode } }));
    }
  };

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    const handleBoardModeRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: 'projects' | 'accounts' }>).detail;
      if (detail?.mode) setBoardMode(detail.mode);
    };
    window.addEventListener('sales-shop:board-mode-request', handleBoardModeRequest);
    return () => window.removeEventListener('sales-shop:board-mode-request', handleBoardModeRequest);
  }, []);

  useEffect(() => {
    if (focusedProjectId && projects.some((project) => project.id === focusedProjectId)) {
      setBoardMode('projects');
      setEditingId(focusedProjectId);
      // Keep this focus until the detail is closed so the URL and open
      // editor agree, including when navigating Back/Forward.
    }
  }, [focusedProjectId, projects, clearFocusedProject]);
  useEffect(() => {
    if (focusedCompanyId) setBoardMode('accounts');
  }, [focusedCompanyId]);

  useEffect(() => {
    if (!hydrated || boardMode !== 'projects' || !mobileInteraction) return;
    const frame = window.requestAnimationFrame(() => restoreMobileBoardState(PROJECT_BOARD_POSITION_KEY, boardRef.current));
    return () => window.cancelAnimationFrame(frame);
  }, [hydrated, boardMode, mobileInteraction, projects.length]);

  const projectsByStage = useMemo(() => {
    const grouped = new Map<ProjectStage, Project[]>();
    PROJECT_STAGES.forEach((stage) => grouped.set(stage, []));
    projects.filter(project=>matchesDealPipeline(project,pipelineView)&&
      [project.name,project.companyName,project.nextAction].some(value=>
        (value??'').toLowerCase().includes(boardSearch.trim().toLowerCase())))
      .forEach((project) => grouped.get(project.stage)?.push(project));
    grouped.forEach((items) => items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    return grouped;
  }, [projects,pipelineView,boardSearch]);

  const editingProject = projects.find((project) => project.id === editingId) ?? null;

  const dropOnStage = (event: DragEvent<HTMLElement>, stage: ProjectStage) => {
    event.preventDefault();
    const projectId = draggedId || event.dataTransfer.getData('text/plain');
    if (projectId) moveProject(projectId, stage);
    setDraggedId(null); setDragStage(null);
  };

  if (!hydrated) return <WorkspaceLoadingState title="Opening Board" detail="Loading deals and accounts…" />;
  if (boardMode === 'accounts') return <AccountsBoard
    onShowProjects={() => setBoardMode('projects')}
    searchQuery={boardSearch} onSearchChange={setBoardSearch}
    compactCards={compactCards} onToggleCompact={toggleCompact}
    isStageCollapsed={stage=>isStageCollapsed('accounts',stage)}
    onToggleStage={stage=>toggleStage('accounts',stage)} />;

  return (
    <main className={'board-view'+(compactCards?' is-compact':'')}>
      <PageHeader className="board-header-panel board-foundation-header ss-workspace-header"
        eyebrow="Sales pipeline" title="Deals"
        description="Move deals from opportunity to completion."
        actions={<>
          <div className="board-view-toggle" role="group" aria-label="Board type">
            <Button variant="quiet" className="active" aria-pressed={true}>Deals</Button>
            <Button variant="quiet" aria-pressed={false} onClick={() => setBoardMode('accounts')}>Accounts</Button>
          </div>
          <div className="board-header-tools">
            <div className="board-pipeline-more" ref={pipelineMenuRef}>
               <button type="button" className="board-pipeline-more-trigger"
                 aria-controls="board-pipeline-menu" aria-expanded={pipelineMenuOpen}
                 aria-haspopup="true"
                 aria-label={'Choose pipeline, currently '+(pipelineView==='all'?'All pipelines':dealPipelineLabel(pipelineView))}
                 onClick={()=>setPipelineMenuOpen(open=>!open)}>
                 More <span aria-hidden="true">⋯</span>
               </button>
               {pipelineMenuOpen&&<div id="board-pipeline-menu" className="board-pipeline-menu" role="group" aria-label="Filter deal pipelines">
                 <span className="board-pipeline-menu-label">SHOW PIPELINE</span>
                 <button type="button" aria-pressed={pipelineView==='all'} onClick={()=>{
                   setPipelineView('all');setPipelineMenuOpen(false);boardRef.current?.scrollTo({left:0});
                 }}>All pipelines {pipelineView==='all'&&<span aria-hidden="true">✓</span>}</button>
                 {DEAL_PIPELINES.map(item=><button type="button" key={item.id}
                   aria-pressed={pipelineView===item.id} onClick={()=>{
                     setPipelineView(item.id);setPipelineMenuOpen(false);boardRef.current?.scrollTo({left:0});
                   }}>{item.label}{pipelineView===item.id&&<span aria-hidden="true">✓</span>}</button>)}
                 <button type="button" aria-pressed={pipelineView==='unassigned'} onClick={()=>{
                   setPipelineView('unassigned');setPipelineMenuOpen(false);boardRef.current?.scrollTo({left:0});
                 }}>Unassigned {pipelineView==='unassigned'&&<span aria-hidden="true">✓</span>}</button>
                 <button type="button" className="board-density-toggle" aria-pressed={compactCards}
                   onClick={()=>{toggleCompact();setPipelineMenuOpen(false);}}>
                   {compactCards?'Standard cards':'Compact cards'} {compactCards&&<span aria-hidden="true">✓</span>}
                 </button>
               </div>}
             </div>
             <div className="board-header-search"><input type="search"
              aria-label="Search Board deals" placeholder="Search deals…"
              value={boardSearch} onChange={event=>setBoardSearch(event.target.value)}/></div>
            <BoardQuickCreate kind="Deal" onCreate={name=>createProject(name,'Discovery',{
               pipeline:pipelineView==='all'||pipelineView==='unassigned'?undefined:pipelineView,
             })} />
          </div>
        </>}
      />

      <MobileBoardStagePicker
        boardRef={boardRef}
        stages={PROJECT_STAGES}
        counts={PROJECT_STAGES.map((stage) => (projectsByStage.get(stage) ?? []).length)}
      />
      <section
        ref={boardRef}
        className="project-board"
        aria-label={pipelineView==='all'?'All deal pipelines':dealPipelineLabel(pipelineView)+' deal pipeline'}
        onScroll={(event) => rememberMobileBoardStage(PROJECT_BOARD_POSITION_KEY, event.currentTarget)}
      >
        {PROJECT_STAGES.map((stage, stageIndex) => {
          const stageProjects = projectsByStage.get(stage) ?? [];
          const stageTotal = stageProjects.reduce((sum, project) => sum + (project.amount ?? 0), 0);
          const collapsed=isStageCollapsed('projects',stage);
          return (
            <section
              key={stage}
              data-board-stage={stage}
              className={`board-column ${collapsed?'is-collapsed':''} ${dragStage === stage ? 'is-drag-over' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragStage(stage); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragStage(null); }}
              onDrop={(event) => dropOnStage(event, stage)}
            >
              <header className="board-column-header">
                <button type="button" className="board-column-toggle"
                  aria-expanded={mobileInteraction || !collapsed}
                  aria-label={(collapsed?'Expand ':'Collapse ')+stage+' column'}
                  title={collapsed?'Expand column':'Collapse column'}
                  disabled={mobileInteraction}
                  onClick={()=>toggleStage('projects',stage)}>
                  <span className="board-column-title">
                    <span className="board-column-stage-name">{stage}</span>
                    <span className="board-column-count">{stageProjects.length}<span className="board-column-count-suffix"> {stageProjects.length === 1 ? 'deal' : 'deals'}</span></span>
                  </span>
                  <span className="board-column-trailing">
                    {stageTotal > 0 && <strong>{money.format(stageTotal)}</strong>}
                    <span className="board-carousel-position" aria-hidden="true">{stageIndex + 1} / {PROJECT_STAGES.length}</span>
                    <span className="board-column-hint" aria-hidden="true">{collapsed?'›':'‹'}</span>
                  </span>
                </button>
              </header>
              <div className="board-column-rule" aria-hidden="true" />
              <div
                className="board-card-stack"
                onScroll={(event) => rememberMobileColumnScroll(PROJECT_BOARD_POSITION_KEY, stage, event.currentTarget.scrollTop)}
              >
                {stageProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    mobileInteraction={mobileInteraction}
                    onOpen={() => setPreview({kind:'deal',id:project.id})}
                    onDragStart={(event) => { setDraggedId(project.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', project.id); }}
                  />
                ))}
                {!stageProjects.length && <div className="board-empty-card">{mobileInteraction ? "No deals in this stage yet" : "Drop a deal here"}</div>}
              </div>
            </section>
          );
        })}
      </section>

      {preview&&<RecordPreviewDrawer record={preview} onClose={()=>setPreview(null)}
        onSelect={setPreview} onEditBoard={preview.kind==='deal'?record=>setEditingId(record.id):undefined}/>}
      {editingProject && <ProjectEditor project={editingProject} onClose={() => {
        setEditingId(null);
        if(focusedProjectId===editingProject.id)clearFocusedProject();
      }} />}
    </main>
  );
}
