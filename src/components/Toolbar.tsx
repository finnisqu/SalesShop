import { useEffect, useRef, useState } from 'react';
import { setNotebookProject } from '../services/notebookProjectContext';
import { useCrmStore } from '../store/crmStore';
import { useNotebookInputStore } from '../store/notebookInputStore';
import { useNotebookStore } from '../store/notebookStore';
import type { ActiveNotebookTool, NotebookEntry, PageTone, PaperStyle } from '../types/notebook';
import { StationeryInsertMenu } from './StationeryInsertMenu';

interface ToolbarProps { entry: NotebookEntry; }
type ToolbarMenu = 'drawing' | 'page' | null;

type IconName = ActiveNotebookTool | 'tools' | 'settings' | 'pencil-input' | 'finger-input' | 'favorite' | 'duplicate' | 'clear';

function ToolbarIcon({ name }: { name: IconName }) {
  switch (name) {
    case 'select':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5 18.2 12l-6.1 1.4-2.8 6.1L5 3.5Z" /></svg>;
    case 'text':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6V4.5h14V6M12 4.5v15M8.5 19.5h7" /></svg>;
    case 'pen':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 18 1.5-5L16 3.5l4.5 4.5-9.5 9.5L5 18Z" /><path d="m6.5 13 4.5 4.5M15 4.5l4.5 4.5" /></svg>;
    case 'marker':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 17 7.8-12.2 5.5 3.5L10.5 20.5 5 17Z" /><path d="m5 17-1.5 3.5 4-.2M11.5 6.8l5.5 3.5" /></svg>;
    case 'highlighter':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 16 7.7-11.5 4.8 3.2L10.8 19.2 6 16Z" /><path d="M4 20h15M8.5 12.3l4.8 3.2" /></svg>;
    case 'eraser':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.5 15.5 8.8-10a2 2 0 0 1 2.8-.2l2.6 2.3a2 2 0 0 1 .2 2.8l-7.4 8.4a2 2 0 0 1-2.8.2l-4-3.5a.9.9 0 0 1-.2-1.3Z" /><path d="m10.2 9 5.5 4.8M10 19h9" /></svg>;
    case 'lasso':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 10.5c0 3.6-3.4 6.5-7.5 6.5s-7.5-2.9-7.5-6.5S7.9 4 12 4s7.5 2.9 7.5 6.5Z" strokeDasharray="2.6 2.2" /><path d="M12 17c0 2.6 1.6 3.5 3.4 2.7 1.3-.6 1.6-1.8.7-2.5" /></svg>;
    case 'tools':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.5 18.5 8.9-13 4.9 3.4-8.9 13-4.9-3.4Z" /><path d="m13.4 5.5 4.9 3.4M5 18l-1 3 3.2-.8" /></svg>;
    case 'settings':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></svg>;
    case 'pencil-input':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 18 1-4 9.8-9.8 4 4L10 18l-5 1Z" /><path d="m14.5 5.5 4 4" /></svg>;
    case 'finger-input':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 11V5.5a1.6 1.6 0 0 1 3.2 0V10M12.4 9V4.7a1.6 1.6 0 0 1 3.2 0v5.8M15.6 9V6a1.6 1.6 0 0 1 3.2 0v7.2c0 4.6-2.4 7.3-6.6 7.3-2.2 0-3.6-.8-4.8-2.5l-2.2-3.1a1.7 1.7 0 0 1 2.6-2.1l1.4 1.5V11Z" /></svg>;
    case 'favorite':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3Z" /></svg>;
    case 'duplicate':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg>;
    case 'clear':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V4.5h6V7M8 10v8M12 10v8M16 10v8M6.5 7l.8 13h9.4l.8-13" /></svg>;
  }
}

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
  const [openMenu, setOpenMenu] = useState<ToolbarMenu>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const tools: ReadonlyArray<[ActiveNotebookTool, string]> = [
    ['select', 'Select'], ['text', 'Text'], ['pen', 'Pen'], ['marker', 'Marker'],
    ['highlighter', 'Highlighter'], ['eraser', 'Eraser'], ['lasso', 'Lasso'],
  ];
  const activeToolLabel = tools.find(([tool]) => tool === activeTool)?.[1] ?? 'Drawing tools';

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (openMenu && toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  return (
    <div className="paper-toolbar" aria-label="Notebook tools" ref={toolbarRef}>
      <div className="notebook-toolbar-menu">
        <button type="button" className={`notebook-toolbar-icon ${openMenu === 'drawing' ? 'active' : ''}`}
          onClick={() => setOpenMenu((current) => current === 'drawing' ? null : 'drawing')}
          aria-label={`Drawing tools. Current tool: ${activeToolLabel}`} aria-expanded={openMenu === 'drawing'} title={`Drawing tools · ${activeToolLabel}`}>
          <ToolbarIcon name={activeTool} />
        </button>
        {openMenu === 'drawing' && (
          <div className="notebook-toolbar-popover drawing-tools-popover" role="dialog" aria-label="Drawing tools">
            <div className="notebook-toolbar-popover-heading">
              <div><span>Notebook</span><strong>Drawing tools</strong></div>
              <button type="button" className="notebook-popover-close" onClick={() => setOpenMenu(null)} aria-label="Close drawing tools">×</button>
            </div>
            <div className="drawing-tool-grid">
              {tools.map(([tool, label]) => (
                <button type="button" key={tool} className={`drawing-tool-choice ${activeTool === tool ? 'active' : ''}`}
                  onClick={() => { setActiveTool(tool); setOpenMenu(null); }} aria-pressed={activeTool === tool} title={label}>
                  <ToolbarIcon name={tool} /><span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <StationeryInsertMenu entryId={entry.id} />

      <div className="ink-input-toggle notebook-input-toggle" aria-label="Drawing input">
        <span>Draw</span>
        <button type="button" className={inputMode === 'pencil' ? 'active' : ''}
          onClick={() => setInputMode('pencil')} aria-pressed={inputMode === 'pencil'} aria-label="Pencil only"
          title="Only pen or stylus draws; finger gestures can move the page"><ToolbarIcon name="pencil-input" /></button>
        <button type="button" className={inputMode === 'finger' ? 'active' : ''}
          onClick={() => setInputMode('finger')} aria-pressed={inputMode === 'finger'} aria-label="Finger drawing"
          title="Draw with a finger or pen"><ToolbarIcon name="finger-input" /></button>
      </div>

      <div className="tool-spacer" />

      <div className="notebook-toolbar-menu">
        <button type="button" className={`notebook-toolbar-icon ${openMenu === 'page' ? 'active' : ''}`}
          onClick={() => setOpenMenu((current) => current === 'page' ? null : 'page')}
          aria-label="Page options" aria-expanded={openMenu === 'page'} title="Page options">
          <ToolbarIcon name="settings" />
        </button>
        {openMenu === 'page' && (
          <div className="notebook-toolbar-popover page-options-popover" role="dialog" aria-label="Page options">
            <div className="notebook-toolbar-popover-heading">
              <div><span>Page</span><strong>{entry.title || 'Untitled page'}</strong></div>
              <button type="button" className="notebook-popover-close" onClick={() => setOpenMenu(null)} aria-label="Close page options">×</button>
            </div>
            <div className="notebook-page-fields">
              <label className="notebook-page-field project-field"><span>Project</span>
                <select className="paper-select project-context-select" value={entry.context?.projectId ?? ''}
                  onChange={(event) => setNotebookProject(entry.id, event.target.value || undefined)} aria-label="Linked project">
                  <option value="">Unlinked</option>
                  {sortedProjects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}{project.companyName ? ` · ${project.companyName}` : ''}</option>
                  ))}
                </select>
              </label>
              <label className="notebook-page-field"><span>Paper</span>
                <select className="paper-select" value={entry.paperStyle}
                  onChange={(event) => setPaperStyle(entry.id, event.target.value as PaperStyle)} aria-label="Paper style">
                  <option value="lined">Lined</option><option value="grid">Grid</option><option value="dotted">Dotted</option>
                  <option value="cornell">Cornell</option><option value="two-column">Two column</option><option value="blank">Blank</option>
                </select>
              </label>
              <label className="notebook-page-field"><span>Tone</span>
                <select className="paper-select page-tone-select" value={entry.tone}
                  onChange={(event) => setPageTone(entry.id, event.target.value as PageTone)} aria-label="Paper tone">
                  <option value="cream">Cream</option><option value="white">White</option><option value="blue">Blue</option>
                  <option value="green">Green</option><option value="rose">Rose</option>
                </select>
              </label>
            </div>
            <div className="notebook-page-actions">
              <button type="button" className={`notebook-page-action ${entry.favorite ? 'active' : ''}`}
                onClick={() => toggleFavorite(entry.id)} aria-pressed={entry.favorite}>
                <ToolbarIcon name="favorite" />{entry.favorite ? 'Favorited' : 'Favorite'}
              </button>
              <button type="button" className="notebook-page-action" onClick={() => { duplicateEntry(entry.id); setOpenMenu(null); }}>
                <ToolbarIcon name="duplicate" />Duplicate
              </button>
              <button type="button" className="notebook-page-action danger" onClick={() => {
                if (!entry.strokes.length || window.confirm('Clear all handwriting from this page?')) clearInk(entry.id);
              }}>
                <ToolbarIcon name="clear" />Clear ink
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
