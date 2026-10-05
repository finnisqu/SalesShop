import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { useCrmStore } from '../store/crmStore';
import { PROJECT_STAGES, type Project, type ProjectPatch, type ProjectStage } from '../types/crm';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ProjectCard({ project, onOpen, onDragStart }: {
  project: Project;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
}) {
  return (
    <article
      className="project-card"
      draggable
      onDragStart={onDragStart}
      onDoubleClick={onOpen}
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === 'Enter') onOpen(); }}
      title="Double-click to edit"
    >
      <div className="project-card-pin" aria-hidden="true" />
      <div className="project-card-company">{project.companyName || 'Unassigned company'}</div>
      <h3>{project.name}</h3>
      {(project.amount || project.dueDate) && (
        <div className="project-card-facts">
          {Boolean(project.amount) && <strong>{money.format(project.amount ?? 0)}</strong>}
          {project.dueDate && <span>Due {formatDate(project.dueDate)}</span>}
        </div>
      )}
      {project.nextAction && <div className="project-next-action">→ {project.nextAction}</div>}
      {project.lastTouchpoint && <div className="project-last-touch">Last touch {formatDate(project.lastTouchpoint)}</div>}
      <button type="button" className="project-card-open" onClick={(event) => { event.stopPropagation(); onOpen(); }}>Edit</button>
    </article>
  );
}

function ProjectEditor({ project, onClose }: { project: Project; onClose: () => void }) {
  const updateProject = useCrmStore((state) => state.updateProject);
  const deleteProject = useCrmStore((state) => state.deleteProject);
  const [draft, setDraft] = useState({
    name: project.name,
    companyName: project.companyName ?? '',
    stage: project.stage,
    amount: project.amount?.toString() ?? '',
    dueDate: project.dueDate ?? '',
    nextAction: project.nextAction ?? '',
    lastTouchpoint: project.lastTouchpoint ?? '',
  });

  useEffect(() => {
    setDraft({
      name: project.name,
      companyName: project.companyName ?? '',
      stage: project.stage,
      amount: project.amount?.toString() ?? '',
      dueDate: project.dueDate ?? '',
      nextAction: project.nextAction ?? '',
      lastTouchpoint: project.lastTouchpoint ?? '',
    });
  }, [project]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const patch: ProjectPatch = {
      name: draft.name,
      companyName: draft.companyName,
      stage: draft.stage,
      amount: draft.amount.trim() ? Number(draft.amount) : undefined,
      dueDate: draft.dueDate || undefined,
      nextAction: draft.nextAction.trim() || undefined,
      lastTouchpoint: draft.lastTouchpoint || undefined,
    };
    updateProject(project.id, patch);
    onClose();
  };

  return (
    <div className="project-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="project-editor" aria-label="Edit project">
        <header>
          <div>
            <span className="board-eyebrow">Project card</span>
            <h2>{project.name}</h2>
          </div>
          <button type="button" className="editor-close" onClick={onClose} aria-label="Close editor">×</button>
        </header>

        <form onSubmit={submit}>
          <label>
            <span>Project name</span>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus />
          </label>
          <label>
            <span>Company</span>
            <input value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} placeholder="Optional" />
          </label>
          <div className="editor-two-up">
            <label>
              <span>Stage</span>
              <select value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value as ProjectStage })}>
                {PROJECT_STAGES.map((stage) => <option key={stage}>{stage}</option>)}
              </select>
            </label>
            <label>
              <span>Amount</span>
              <input type="number" min="0" step="1" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="$0" />
            </label>
          </div>
          <div className="editor-two-up">
            <label>
              <span>Due date</span>
              <input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
            </label>
            <label>
              <span>Last touch</span>
              <input type="date" value={draft.lastTouchpoint} onChange={(event) => setDraft({ ...draft, lastTouchpoint: event.target.value })} />
            </label>
          </div>
          <label>
            <span>Next action</span>
            <textarea value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} placeholder="What should happen next?" />
          </label>

          <div className="editor-actions">
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                if (window.confirm(`Delete ${project.name}?`)) {
                  deleteProject(project.id);
                  onClose();
                }
              }}
            >
              Delete
            </button>
            <div className="editor-action-spacer" />
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button">Save project</button>
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
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragStage, setDragStage] = useState<ProjectStage | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  const projectsByStage = useMemo(() => {
    const grouped = new Map<ProjectStage, Project[]>();
    PROJECT_STAGES.forEach((stage) => grouped.set(stage, []));
    projects.forEach((project) => grouped.get(project.stage)?.push(project));
    grouped.forEach((items) => items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    return grouped;
  }, [projects]);

  const editingProject = projects.find((project) => project.id === editingId) ?? null;

  const quickAdd = (event: FormEvent) => {
    event.preventDefault();
    const projectId = createProject(newName);
    if (projectId) {
      setNewName('');
      setEditingId(projectId);
    }
  };

  const dropOnStage = (event: DragEvent<HTMLElement>, stage: ProjectStage) => {
    event.preventDefault();
    const projectId = draggedId || event.dataTransfer.getData('text/plain');
    if (projectId) moveProject(projectId, stage);
    setDraggedId(null);
    setDragStage(null);
  };

  if (!hydrated) return <div className="board-loading">Opening project board…</div>;

  return (
    <main className="board-view">
      <section className="board-header-panel">
        <div>
          <span className="board-eyebrow">Sales pipeline</span>
          <h1>Projects</h1>
          <p>Start with a name. Add detail only when it becomes useful.</p>
        </div>
        <form className="board-quick-add" onSubmit={quickAdd}>
          <label htmlFor="new-project-name">Quick project</label>
          <div>
            <input id="new-project-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Type a project name…" />
            <button type="submit" disabled={!newName.trim()}>Add</button>
          </div>
        </form>
      </section>

      <section className="project-board" aria-label="Project pipeline board">
        {PROJECT_STAGES.map((stage) => {
          const stageProjects = projectsByStage.get(stage) ?? [];
          const stageTotal = stageProjects.reduce((sum, project) => sum + (project.amount ?? 0), 0);
          return (
            <section
              key={stage}
              className={`board-column ${dragStage === stage ? 'is-drag-over' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragStage(stage); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragStage(null); }}
              onDrop={(event) => dropOnStage(event, stage)}
            >
              <header className="board-column-header">
                <div>
                  <h2>{stage}</h2>
                  <span>{stageProjects.length} {stageProjects.length === 1 ? 'project' : 'projects'}</span>
                </div>
                {stageTotal > 0 && <strong>{money.format(stageTotal)}</strong>}
              </header>
              <div className="board-column-rule" aria-hidden="true" />
              <div className="board-card-stack">
                {stageProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => setEditingId(project.id)}
                    onDragStart={(event) => {
                      setDraggedId(project.id);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', project.id);
                    }}
                  />
                ))}
                {!stageProjects.length && <div className="board-empty-card">Drop a project here</div>}
              </div>
            </section>
          );
        })}
      </section>

      {editingProject && <ProjectEditor project={editingProject} onClose={() => setEditingId(null)} />}
    </main>
  );
}
