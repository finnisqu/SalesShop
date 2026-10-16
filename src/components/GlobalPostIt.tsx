import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNotebookStore } from '../store/notebookStore';
import { useNavigationStore } from '../store/navigationStore';
import type { PostItObject, PostItTone } from '../types/notebook';
import '../global-postit.css';

const tones: PostItTone[] = ['yellow', 'pink', 'blue', 'green'];
type Note = { entryId: string; entryTitle: string; object: PostItObject };
const quickNoteEvent = 'sales-shop:global-post-it';
export const newQuickNoteEvent = 'sales-shop:new-quick-note';

/** Render a launcher in any toolbar; one shared layer stays mounted through navigation. */
export function GlobalPostItLauncher() {
  return <button type="button" className="global-postit-launcher"
    aria-label="Quick Note" aria-keyshortcuts="Alt+Shift+N" title="Open private Quick Notes · Alt+Shift+N"
    onClick={() => window.dispatchEvent(new Event(quickNoteEvent))}>
    <span aria-hidden="true">▧</span>
  </button>;
}

export function GlobalPostItLayer() {
  const entries = useNotebookStore(s => s.entries);
  const createGlobalPostIt = useNotebookStore(s => s.createGlobalPostIt);
  const updateTextObject = useNotebookStore(s => s.updateTextObject);
  const updatePostItTone = useNotebookStore(s => s.updatePostItTone);
  const deleteObject = useNotebookStore(s => s.deleteObject);
  const selectEntry = useNotebookStore(s => s.selectEntry);
  const setView = useNavigationStore(s => s.setView);
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [position, setPosition] = useState(() => ({
    x: Math.max(20, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 370), y: 90,
  }));
  const drag = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const notes: Note[] = entries.flatMap(entry => entry.objects
    .filter((object): object is PostItObject => object.type === 'post-it')
    .map(object => ({ entryId: entry.id, entryTitle: entry.title, object })));
  const selected = notes.find(note => note.object.id === selectedId) ?? notes[0];

  // These objects are saved in the per-user Notebook document, not shared CRM or quotes.
  useEffect(() => {
    const openNotes = () => {
      if (open) { setOpen(false); return; }
      const current = useNotebookStore.getState().entries
        .flatMap(entry => entry.objects.filter(object => object.type === 'post-it'));
      const id = current[0]?.id ?? useNotebookStore.getState().createGlobalPostIt();
      setSelectedId(id);
      setOpen(true);
    };
    const onShortcut = (event: KeyboardEvent) => {
      if (!(event.altKey && event.shiftKey && event.key.toLowerCase() === 'n')) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      openNotes();
    };
    const onTrigger = () => openNotes();
    const onCreate = () => {
      const id=useNotebookStore.getState().createGlobalPostIt();
      setSelectedId(id);setOpen(true);
    };
    window.addEventListener(quickNoteEvent, onTrigger);
    window.addEventListener(newQuickNoteEvent,onCreate);
    window.addEventListener('keydown', onShortcut);
    return () => {
      window.removeEventListener(quickNoteEvent, onTrigger);
      window.removeEventListener(newQuickNoteEvent,onCreate);
      window.removeEventListener('keydown', onShortcut);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open]);

  const addNote = () => {
    const id = createGlobalPostIt();
    setSelectedId(id);
    setOpen(true);
  };
  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (docked || window.matchMedia('(max-width: 700px), (orientation: landscape) and (max-height: 520px) and (pointer: coarse)').matches) return;
    if (event.target instanceof Element && event.target.closest('button')) return;
    drag.current = { pointerId:event.pointerId, x:position.x,y:position.y,
      startX:event.clientX,startY:event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const source = drag.current;
    if (!source || source.pointerId !== event.pointerId) return;
    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - 120, source.x + event.clientX - source.startX)),
      y: Math.max(8, Math.min(window.innerHeight - 75, source.y + event.clientY - source.startY)),
    });
  };
  const endDrag = () => {drag.current = null;};
  const openInNotebook = () => {
    if (!selected) return;
    selectEntry(selected.entryId);
    setView('notebook');
    setOpen(false);
  };
  return open ? createPortal(<>
    <div className="global-postit-mobile-backdrop" onPointerDown={() => setOpen(false)} />
    <section className={'global-postit-panel'+(docked?' is-docked':'')} role="region"
      aria-label="Private Quick Notes" style={docked?undefined:{left:position.x,top:position.y}}>
      <header className="global-postit-heading" onPointerDown={startDrag} onPointerMove={moveDrag}
        onPointerUp={endDrag} onPointerCancel={endDrag}>
        <div><strong>Quick Notes</strong><small>Private · saved to Notebook</small></div>
        <div className="global-postit-heading-actions">
          <button type="button" onClick={addNote} aria-label="New Quick Note" title="New Quick Note">+</button>
          <button type="button" onClick={() => setDocked(value => !value)}
            aria-label={docked?'Undock Post-its':'Dock Post-its'} title={docked?'Float':'Dock'}>
            {docked?'◩':'⇥'}
          </button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Collapse Post-its" title="Collapse Post-its">−</button>
        </div>
      </header>
      <nav className="global-postit-list" aria-label="Post-it collection">
        {notes.map(note => <button type="button" key={note.object.id}
          className={'global-postit-item'+(selected?.object.id===note.object.id?' is-selected':'')}
          onClick={() => setSelectedId(note.object.id)}>
          <span className={'global-postit-dot tone-'+note.object.tone} />
          <span>{note.object.text.trim().slice(0,44)||'New note'}</span>
        </button>)}
      </nav>
      {selected ? <>
        <div className={'global-postit-paper tone-'+selected.object.tone}>
          <textarea aria-label="Private Post-it text" autoFocus
            placeholder="Jot something down…" value={selected.object.text}
            onChange={event => updateTextObject(selected.entryId,selected.object.id,event.target.value)}/>
          <div className="global-postit-colors" aria-label="Post-it color">
            {tones.map(tone => <button type="button" key={tone}
              className={'global-postit-tone tone-'+tone}
              aria-label={tone+' Post-it'} aria-pressed={selected.object.tone===tone}
              onClick={() => updatePostItTone(selected.entryId,selected.object.id,tone)} />)}
          </div>
        </div>
        <footer className="global-postit-foot">
          <button type="button" onClick={openInNotebook}>Open in Notebook ↗</button>
          <button type="button" className="is-danger" onClick={() => {
            if (!window.confirm('Delete this private Post-it? You can undo from Notebook.')) return;
            deleteObject(selected.entryId,selected.object.id);
            setSelectedId(null);
          }}>Delete note</button>
        </footer>
      </> : <div className="global-postit-empty">No Quick Notes yet. <button onClick={addNote}>Create one</button></div>}
    </section>
  </>,document.body) : null;
}
