import { useEffect } from 'react';
import './object-layer.css';
import { DrawingCanvas } from './components/DrawingCanvas';
import { NotebookObjectLayer } from './components/NotebookObjectLayer';
import { Sidebar } from './components/Sidebar';
import { TextEditor } from './components/TextEditor';
import { Toolbar } from './components/Toolbar';
import { useNotebookStore } from './store/notebookStore';

function App() {
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
          <button className="app-tab active">Notebook</button>
          <button className="app-tab" disabled title="Migrates in a later batch">Board</button>
          <button className="app-tab" disabled title="Migrates in a later batch">Quotes</button>
          <button className="app-tab" disabled title="Migrates in a later batch">Memory</button>
        </nav>
        <div className="migration-chip">React foundation</div>
      </header>

      <main className="notebook-workspace">
        <Sidebar />

        <section className="binder-stage">
          <Toolbar entryId={entry.id} paperStyle={entry.paperStyle} />

          <div className="desk-surface">
            <article className={`paper-sheet paper-${entry.paperStyle}`}>
              <div className="paper-edge" aria-hidden="true" />
              <header className="paper-heading">
                <input
                  className="paper-title"
                  value={entry.title}
                  onChange={(event) => renameEntry(entry.id, event.target.value)}
                  aria-label="Page title"
                />
                <div className="paper-date">
                  {new Date(entry.updatedAt).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
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
    </div>
  );
}

export default App;
