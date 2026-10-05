import { useEffect, useState } from 'react';
import './object-layer.css';
import './spreadsheet-object.css';
import './binder-page.css';
import './board.css';
import './board-groups.css';
import { Board } from './components/Board';
import { DrawingCanvas } from './components/DrawingCanvas';
import { NotebookObjectLayer } from './components/NotebookObjectLayer';
import { Sidebar } from './components/Sidebar';
import { TextEditor } from './components/TextEditor';
import { Toolbar } from './components/Toolbar';
import { useNotebookStore } from './store/notebookStore';

type AppView = 'notebook' | 'board';

function App() {
  const [view, setView] = useState<AppView>('notebook');
  const hydrate = useNotebookStore((state) => state.hydrate);
  const hydrated = useNotebookStore((state) => state.hydrated);
  const entries = useNotebookStore((state) => state.entries);
  const activeEntryId = useNotebookStore((state) => state.activeEntryId);
  const renameEntry = useNotebookStore((state) => state.renameEntry);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const entry = entries.find((candidate) => candidate.id === activeEntryId) ?? null;

  if (!hydrated || !entry) {
    return <div className="loading-screen">Opening SalesShop…</div>;
  }

  return (
    <div className="sales-app">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark">S</span>
          <strong>SalesShop</strong>
        </div>
        <nav className="app-tabs" aria-label="SalesShop sections">
          <button className={`app-tab ${view === 'notebook' ? 'active' : ''}`} onClick={() => setView('notebook')}>Notebook</button>
          <button className={`app-tab ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>Board</button>
          <button className="app-tab" disabled title="Migrates in a later batch">Quotes</button>
          <button className="app-tab" disabled title="Migrates in a later batch">Memory</button>
        </nav>
        <div className="migration-chip">React foundation</div>
      </header>

      {view === 'board' ? (
        <Board />
      ) : (
        <main className="notebook-workspace">
          <Sidebar />

          <section className="binder-stage">
            <Toolbar entry={entry} />

            <div className="desk-surface">
              <article className={`paper-sheet paper-${entry.paperStyle} tone-${entry.tone}`}>
                <div className="paper-edge" aria-hidden="true" />
                <header className="paper-heading">
                  <input
                    className="paper-title"
                    value={entry.title}
                    onChange={(event) => renameEntry(entry.id, event.target.value)}
                    aria-label="Page title"
                  />
                  <div className="paper-meta-line">
                    {entry.favorite && <span className="paper-favorite-mark" title="Favorite page">★</span>}
                    <span>
                      {new Date(entry.updatedAt).toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="paper-meta-separator">·</span>
                    <span className="paper-meta-extra">{entry.paperStyle.replace('-', ' ')}</span>
                    <span className="paper-meta-separator paper-meta-extra">·</span>
                    <span className="paper-meta-extra">Created {new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>
                </header>

                <div className="paper-writing-surface">
                  <TextEditor key={`text-${entry.id}`} entry={entry} />
                  <DrawingCanvas key={`ink-${entry.id}`} entry={entry} />
                  <NotebookObjectLayer key={`objects-${entry.id}`} entry={entry} />
                </div>
              </article>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
