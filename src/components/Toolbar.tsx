import { setNotebookProject } from '../services/notebookProjectContext';
import { useCrmStore } from '../store/crmStore';
import { useNotebookInputStore } from '../store/notebookInputStore';
import { useNotebookStore } from '../store/notebookStore';
import type { ActiveNotebookTool, NotebookEntry, PageTone, PaperStyle } from '../types/notebook';
import { StationeryInsertMenu } from './StationeryInsertMenu';

interface ToolbarProps { entry: NotebookEntry; }

export function Toolbar({ entry }: ToolbarProps) {
  const activeTool = useNotebookStore((state) => state.activeTool);
  const setActiveTool = useNotebookStore((state) => state.setActiveTool);
  const clearInk = useNotebookStore((state) => state.clearInk);
  const setPaperStyle = useNotebookStore((state) => state.setPaperStyle);
  const setPageTone = useNotebookStore((state) => state.setPageTone);
  const toggleFavorite = useNotebookStore((state) => state.toggleFavorite);
  const duplicateEntry = useNotebookStore((state) => state.duplicateEntry);
  const inputMode = useNotebookInputStore((state) => state.inputMode);
  const setInputMode = useNotebookInputStore((state) => state.setInputMode);
  const projects = useCrmStore((state) => state.projects);
  const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name));

  const tools: ReadonlyArray<[ActiveNotebookTool, string]> = [
    ['select', 'Select'], ['text', 'Text'], ['pen', 'Pen'], ['marker', 'Marker'],
    ['highlighter', 'Highlighter'], ['eraser', 'Eraser'], ['lasso', 'Lasso'],
  ];

  return (
    <div className="paper-toolbar" aria-label="Notebook tools">
      <div className="tool-group">
        {tools.map(([tool, label]) => (
          <button key={tool} className={`tool-button ${activeTool === tool ? 'active' : ''}`}
            onClick={() => setActiveTool(tool)} aria-pressed={activeTool === tool}
            title={tool === 'eraser' ? 'Stroke eraser' : tool === 'lasso' ? 'Select and move handwriting' : undefined}>
            {label}
          </button>
        ))}
      </div>

      <div className="tool-divider" aria-hidden="true" />
      <StationeryInsertMenu entryId={entry.id} />
      <div className="tool-spacer" />

      <div className="project-context-control" title="Attach this notebook page to a project">
        <span>Project</span>
        <select className="paper-select project-context-select" value={entry.context?.projectId ?? ''}
          onChange={(event) => setNotebookProject(entry.id, event.target.value || undefined)} aria-label="Linked project">
          <option value="">Unlinked</option>
          {sortedProjects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}{project.companyName ? ` · ${project.companyName}` : ''}</option>
          ))}
        </select>
      </div>

      <div className="ink-input-toggle" aria-label="Drawing input">
        <span>Draw</span>
        <button type="button" className={inputMode === 'pencil' ? 'active' : ''}
          onClick={() => setInputMode('pencil')} aria-pressed={inputMode === 'pencil'}
          title="Only pen or stylus draws; finger gestures can move the page">Pencil</button>
        <button type="button" className={inputMode === 'finger' ? 'active' : ''}
          onClick={() => setInputMode('finger')} aria-pressed={inputMode === 'finger'}
          title="Draw with a finger or pen">Finger</button>
      </div>

      <select className="paper-select" value={entry.paperStyle}
        onChange={(event) => setPaperStyle(entry.id, event.target.value as PaperStyle)} aria-label="Paper style">
        <option value="lined">Lined</option><option value="grid">Grid</option><option value="dotted">Dotted</option>
        <option value="cornell">Cornell</option><option value="two-column">Two column</option><option value="blank">Blank</option>
      </select>

      <div className="page-meta-controls" aria-label="Page options">
        <button className={`tool-button page-favorite-button ${entry.favorite ? 'is-favorite' : ''}`}
          onClick={() => toggleFavorite(entry.id)} aria-pressed={entry.favorite}
          title={entry.favorite ? 'Remove from favorites' : 'Favorite page'}>{entry.favorite ? '★' : '☆'}</button>
        <select className="paper-select page-tone-select" value={entry.tone}
          onChange={(event) => setPageTone(entry.id, event.target.value as PageTone)} aria-label="Paper tone">
          <option value="cream">Cream</option><option value="white">White</option><option value="blue">Blue</option>
          <option value="green">Green</option><option value="rose">Rose</option>
        </select>
        <button className="tool-button page-duplicate-button" onClick={() => duplicateEntry(entry.id)} title="Duplicate page">Duplicate</button>
      </div>
      <button className="tool-button quiet" onClick={() => clearInk(entry.id)}>Clear ink</button>
    </div>
  );
}
