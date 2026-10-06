import { useState } from 'react';
import { useNotebookStore } from '../store/notebookStore';

export function Sidebar() {
  const entries = useNotebookStore((state) => state.entries);
  const activeEntryId = useNotebookStore((state) => state.activeEntryId);
  const createEntry = useNotebookStore((state) => state.createEntry);
  const selectEntry = useNotebookStore((state) => state.selectEntry);
  const deleteEntry = useNotebookStore((state) => state.deleteEntry);
  const [showHidden, setShowHidden] = useState(false);

  const hiddenCount = entries.filter((entry) => entry.hidden).length;
  const visibleEntries = entries.filter((entry) => !entry.hidden || showHidden || entry.id === activeEntryId);

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

      <div className="page-list">
        {visibleEntries.map((entry) => {
          const active = entry.id === activeEntryId;
          const text = entry.contentHtml.replace(/<[^>]+>/g, ' ').replace(/s+/g, ' ').trim();
          return (
            <button
              key={entry.id}
              className={`page-tab tone-${entry.tone} ${active ? 'active' : ''} ${entry.favorite ? 'is-favorite' : ''} ${entry.hidden ? 'is-hidden-page' : ''}`}
              onClick={() => selectEntry(entry.id)}
              title={[
                entry.title,
                entry.favorite ? 'Favorite' : '',
                entry.openAtStart ? 'Opens at start' : '',
                entry.hidden ? 'Hidden private sheet' : '',
                entry.deletionLocked ? 'Deletion locked' : '',
              ].filter(Boolean).join(' · ')}
            >
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
      </div>
    </aside>
  );
}
