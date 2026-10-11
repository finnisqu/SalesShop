import { useMemo, useState, type DragEvent } from 'react';
import { useNotebookStore } from '../store/notebookStore';
import type { NotebookEntry, NotebookObject } from '../types/notebook';

type PageFilter = 'all' | 'favorites' | 'project';

function plainHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/s+/g, ' ').trim();
}

function objectSearchText(object: NotebookObject) {
  if (object.type === 'paper-card' || object.type === 'post-it' || object.type === 'paper-scrap') return object.text;
  if (object.type === 'business-card') return [object.name, object.company, object.title, object.email, object.phone].filter(Boolean).join(' ');
  if (object.type === 'image') return [object.alt, object.caption].filter(Boolean).join(' ');
  if (object.type === 'attachment') return object.name;
  if (object.type === 'shape') return object.text ?? '';
  return '';
}

function entrySearchText(entry: NotebookEntry) {
  return [
    entry.title,
    plainHtml(entry.contentHtml),
    ...entry.objects.map(objectSearchText),
  ].join(' ').toLowerCase();
}

export function Sidebar() {
  const entries = useNotebookStore((state) => state.entries);
  const activeEntryId = useNotebookStore((state) => state.activeEntryId);
  const createEntry = useNotebookStore((state) => state.createEntry);
  const selectEntry = useNotebookStore((state) => state.selectEntry);
  const deleteEntry = useNotebookStore((state) => state.deleteEntry);
  const reorderEntry = useNotebookStore((state) => state.reorderEntry);
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PageFilter>('all');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: 'before' | 'after' } | null>(null);

  const hiddenCount = entries.filter((entry) => entry.hidden).length;
  const reorderEnabled = !query.trim() && filter === 'all';

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entry.hidden && !showHidden && entry.id !== activeEntryId) return false;
      if (filter === 'favorites' && !entry.favorite) return false;
      if (filter === 'project' && !entry.context?.projectId) return false;
      if (needle && !entrySearchText(entry).includes(needle)) return false;
      return true;
    });
  }, [activeEntryId, entries, filter, query, showHidden]);

  const onDragOver = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    if (!draggingId || draggingId === targetId || !reorderEnabled) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropTarget({ id: targetId, placement });
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === targetId || !dropTarget || !reorderEnabled) return;
    reorderEntry(draggingId, targetId, dropTarget.placement);
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <aside className="notebook-sidebar">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">Binder</span>
          <h2>Notebook</h2>
        </div>
        <div className="sidebar-heading-actions">
          {hiddenCount > 0 && (
            <button
              className={`square-button sidebar-hidden-toggle ${showHidden ? 'active' : ''}`}
              onClick={() => setShowHidden((current) => !current)}
              title={showHidden ? 'Hide private sheets again' : `Show ${hiddenCount} hidden private sheet${hiddenCount === 1 ? '' : 's'}`}
              aria-label={showHidden ? 'Hide private sheets' : 'Show hidden private sheets'}
            >
              {showHidden ? '◉' : '○'}
            </button>
          )}
          <button className="square-button" onClick={createEntry} title="New page" aria-label="New page">
            +
          </button>
        </div>
      </div>

      <div className="notebook-page-search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notebook…"
          aria-label="Search notebook pages"
        />
        <div className="notebook-page-filters" aria-label="Notebook page filters">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button type="button" className={filter === 'favorites' ? 'active' : ''} onClick={() => setFilter('favorites')}>★</button>
          <button type="button" className={filter === 'project' ? 'active' : ''} onClick={() => setFilter('project')}>Project</button>
        </div>
        {!reorderEnabled && <small>Clear search/filter to reorder pages.</small>}
      </div>

      <div className="page-list">
        {visibleEntries.map((entry) => {
          const active = entry.id === activeEntryId;
          const text = plainHtml(entry.contentHtml);
          const before = dropTarget?.id === entry.id && dropTarget.placement === 'before';
          const after = dropTarget?.id === entry.id && dropTarget.placement === 'after';
          return (
            <button
              key={entry.id}
              className={`page-tab tone-${entry.tone} ${active ? 'active' : ''} ${entry.favorite ? 'is-favorite' : ''} ${entry.hidden ? 'is-hidden-page' : ''} ${draggingId === entry.id ? 'is-dragging' : ''} ${before ? 'drop-before' : ''} ${after ? 'drop-after' : ''}`}
              onClick={() => selectEntry(entry.id)}
              draggable={reorderEnabled}
              onDragStart={(event) => {
                if (!reorderEnabled) return;
                setDraggingId(entry.id);
                setDropTarget(null);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', entry.id);
              }}
              onDragOver={(event) => onDragOver(event, entry.id)}
              onDrop={(event) => onDrop(event, entry.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTarget(null);
              }}
              title={[
                entry.title,
                entry.favorite ? 'Favorite' : '',
                entry.openAtStart ? 'Opens at start' : '',
                entry.hidden ? 'Hidden private sheet' : '',
                entry.deletionLocked ? 'Deletion locked' : '',
                reorderEnabled ? 'Drag to reorder' : '',
              ].filter(Boolean).join(' · ')}
            >
              {reorderEnabled && <span className="page-tab-drag" aria-hidden="true">⋮⋮</span>}
              <span className="page-tab-title">{entry.title}</span>
              <span className="page-tab-preview">{text || `${entry.paperStyle.replace('-', ' ')} sheet`}</span>
              <span className="page-tab-status" aria-hidden="true">
                {entry.openAtStart && <span title="Opens at start">⌂</span>}
                {entry.hidden && <span title="Hidden private sheet">◌</span>}
                {entry.deletionLocked && <span title="Deletion locked">▣</span>}
              </span>
              <span className="page-tab-favorite" aria-hidden="true">★</span>
              {!entry.deletionLocked && (
                <span
                  className="page-tab-delete"
                  role="button"
                  tabIndex={0}
                  title="Delete page"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (window.confirm(`Delete “${entry.title || 'Untitled page'}”? This can be undone.`)) deleteEntry(entry.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      if (window.confirm(`Delete “${entry.title || 'Untitled page'}”? This can be undone.`)) deleteEntry(entry.id);
                    }
                  }}
                >
                  ×
                </span>
              )}
            </button>
          );
        })}
        {!visibleEntries.length && (
          <div className="notebook-page-empty">
            <strong>No pages found</strong>
            <span>Try another search or filter.</span>
          </div>
        )}
      </div>
    </aside>
  );
}
