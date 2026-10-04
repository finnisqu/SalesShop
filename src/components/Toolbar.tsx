import { useNotebookStore } from '../store/notebookStore';
import type { ActiveNotebookTool, PaperStyle } from '../types/notebook';
import { StationeryInsertMenu } from './StationeryInsertMenu';

interface ToolbarProps {
  entryId: string;
  paperStyle: PaperStyle;
}

export function Toolbar({ entryId, paperStyle }: ToolbarProps) {
  const activeTool = useNotebookStore((state) => state.activeTool);
  const setActiveTool = useNotebookStore((state) => state.setActiveTool);
  const clearInk = useNotebookStore((state) => state.clearInk);
  const setPaperStyle = useNotebookStore((state) => state.setPaperStyle);

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
      <StationeryInsertMenu entryId={entryId} />
      <div className="tool-spacer" />

      <span className="pencil-mode-hint" title="On touch devices, finger gestures navigate while Pencil writes">Pencil writes · finger moves</span>

      <select
        className="paper-select"
        value={paperStyle}
        onChange={(event) => setPaperStyle(entryId, event.target.value as PaperStyle)}
        aria-label="Paper style"
      >
        <option value="lined">Lined</option>
        <option value="grid">Grid</option>
        <option value="blank">Blank</option>
      </select>

      <button className="tool-button quiet" onClick={() => clearInk(entryId)}>
        Clear ink
      </button>
    </div>
  );
}
