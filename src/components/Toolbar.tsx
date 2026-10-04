import { useNotebookStore } from '../store/notebookStore';
import type { PaperStyle } from '../types/notebook';

interface ToolbarProps {
  entryId: string;
  paperStyle: PaperStyle;
}

export function Toolbar({ entryId, paperStyle }: ToolbarProps) {
  const activeTool = useNotebookStore((state) => state.activeTool);
  const setActiveTool = useNotebookStore((state) => state.setActiveTool);
  const clearInk = useNotebookStore((state) => state.clearInk);
  const setPaperStyle = useNotebookStore((state) => state.setPaperStyle);

  return (
    <div className="paper-toolbar" aria-label="Notebook tools">
      <div className="tool-group">
        {([
          ['text', 'Text'],
          ['pen', 'Pen'],
          ['marker', 'Marker'],
          ['highlighter', 'Highlighter'],
        ] as const).map(([tool, label]) => (
          <button
            key={tool}
            className={`tool-button ${activeTool === tool ? 'active' : ''}`}
            onClick={() => setActiveTool(tool)}
            aria-pressed={activeTool === tool}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tool-spacer" />

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
