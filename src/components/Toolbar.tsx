import { useNotebookStore } from '../store/notebookStore';
import type { ActiveNotebookTool, NotebookEntry, PageTone, PaperStyle } from '../types/notebook';
import { StationeryInsertMenu } from './StationeryInsertMenu';

interface ToolbarProps {
  entry: NotebookEntry;
}

export function Toolbar({ entry }: ToolbarProps) {
  const activeTool = useNotebookStore((state) => state.activeTool);
  const setActiveTool = useNotebookStore((state) => state.setActiveTool);
  const clearInk = useNotebookStore((state) => state.clearInk);
  const setPaperStyle = useNotebookStore((state) => state.setPaperStyle);
  const setPageTone = useNotebookStore((state) => state.setPageTone);
  const toggleFavorite = useNotebookStore((state) => state.toggleFavorite);
  const duplicateEntry = useNotebookStore((state) => state.duplicateEntry);

  const tools: ReadonlyArray<[ActiveNotebookTool, string]> = [
    ['select', 'Select'],
    ['text', 'Text'],
    ['pen', 'Pen'],
    ['marker', 'Marker'],
    ['highlighter', 'Highlighter'],
    ['eraser', 'Eraser'],
    ['lasso', 'Lasso'],
  ];

  return (
    <div className="paper-toolbar" aria-label="Notebook tools">
      <div className="tool-group">
        {tools.map(([tool, label]) => (
          <button
            key={tool}
            className={`tool-button ${activeTool === tool ? 'active' : ''}`}
            onClick={() => setActiveTool(tool)}
            aria-pressed={activeTool === tool}
            title={tool === 'eraser' ? 'Stroke eraser' : tool === 'lasso' ? 'Select and move handwriting' : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tool-divider" aria-hidden="true" />
      <StationeryInsertMenu entryId={entry.id} />
      <div className="tool-spacer" />

      <span className="pencil-mode-hint" title="On touch devices, finger gestures navigate while Pencil writes">Pencil writes · finger moves</span>

      <select
        className="paper-select"
        value={entry.paperStyle}
        onChange={(event) => setPaperStyle(entry.id, event.target.value as PaperStyle)}
        aria-label="Paper style"
      >
        <option value="lined">Lined</option>
        <option value="grid">Grid</option>
        <option value="dotted">Dotted</option>
        <option value="cornell">Cornell</option>
        <option value="two-column">Two column</option>
        <option value="blank">Blank</option>
      </select>

      <div className="page-meta-controls" aria-label="Page options">
        <button
          className={`tool-button page-favorite-button ${entry.favorite ? 'is-favorite' : ''}`}
          onClick={() => toggleFavorite(entry.id)}
          aria-pressed={entry.favorite}
          title={entry.favorite ? 'Remove from favorites' : 'Favorite page'}
        >
          {entry.favorite ? '★' : '☆'}
        </button>
        <select
          className="paper-select page-tone-select"
          value={entry.tone}
          onChange={(event) => setPageTone(entry.id, event.target.value as PageTone)}
          aria-label="Paper tone"
        >
          <option value="cream">Cream</option>
          <option value="white">White</option>
          <option value="blue">Blue</option>
          <option value="green">Green</option>
          <option value="rose">Rose</option>
        </select>
        <button className="tool-button page-duplicate-button" onClick={() => duplicateEntry(entry.id)} title="Duplicate page">
          Duplicate
        </button>
      </div>

      <button className="tool-button quiet" onClick={() => clearInk(entry.id)}>
        Clear ink
      </button>
    </div>
  );
}
