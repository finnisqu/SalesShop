import { useNotebookStore } from '../store/notebookStore';

export function Sidebar() {
  const entries = useNotebookStore((state) => state.entries);
  const activeEntryId = useNotebookStore((state) => state.activeEntryId);
  const createEntry = useNotebookStore((state) => state.createEntry);
  const selectEntry = useNotebookStore((state) => state.selectEntry);
  const deleteEntry = useNotebookStore((state) => state.deleteEntry);

  return (
    <aside className="notebook-sidebar">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">Binder</span>
          <h2>Notebook</h2>
        </div>
        <button className="square-button" onClick={createEntry} title="New page" aria-label="New page">
          +
        </button>
      </div>

      <div className="page-list">
        {entries.map((entry) => {
          const active = entry.id === activeEntryId;
          const text = entry.contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          return (
            <button
              key={entry.id}
              className={`page-tab tone-${entry.tone} ${active ? 'active' : ''} ${entry.favorite ? 'is-favorite' : ''}`}
              onClick={() => selectEntry(entry.id)}
              title={entry.favorite ? `${entry.title} · Favorite` : entry.title}
            >
              <span className="page-tab-title">{entry.title}</span>
              <span className="page-tab-preview">{text || `${entry.paperStyle.replace('-', ' ')} sheet`}</span>
              <span className="page-tab-favorite" aria-hidden="true">★</span>
              <span
                className="page-tab-delete"
                role="button"
                tabIndex={0}
                title="Delete page"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteEntry(entry.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteEntry(entry.id);
                  }
                }}
              >
                ×
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
