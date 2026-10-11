import { createProjectNotebookPage, detachProjectNotebookPages } from '../services/notebookProjectContext';
import { useNavigationStore } from '../store/navigationStore';
import { useNotebookStore } from '../store/notebookStore';
import type { Project } from '../types/crm';

export function ProjectNotebookLinks({ project }: { project: Project }) {
  const entries = useNotebookStore((state) => state.entries);
  const openNotebookPage = useNavigationStore((state) => state.openNotebookPage);
  const linkedPages = entries
    .filter((entry) => entry.context?.projectId === project.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const createPage = () => {
    const pageId = createProjectNotebookPage(project.id, `${project.name} notes`);
    openNotebookPage(pageId);
  };

  return (
    <section className="project-notebook-links" aria-label="Linked notebook pages">
      <header>
        <span className="project-notebook-links-title">Notebook pages · {linkedPages.length}</span>
        <button type="button" className="project-notebook-new" onClick={createPage}>+ New page</button>
      </header>
      {linkedPages.map((page) => (
        <button key={page.id} type="button" className="project-notebook-page" onClick={() => openNotebookPage(page.id)}>
          <strong>{page.title}</strong>
          <span>{new Date(page.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </button>
      ))}
      {!linkedPages.length && <div className="project-notebook-empty">No Notebook pages are linked to this project yet.</div>}
    </section>
  );
}

export function detachNotebookPagesForProject(projectId: string) {
  detachProjectNotebookPages(projectId);
}
