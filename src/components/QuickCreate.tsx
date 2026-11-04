import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useCrmStore } from '../store/crmStore';
import { useNavigationStore } from '../store/navigationStore';
import { useNotebookStore } from '../store/notebookStore';
import { useQuoteLibraryStore } from '../store/quoteLibraryStore';
import {useQuotesMobileBetaStore} from '../store/quotesMobileBetaStore';
import {requestTaskModal} from './TaskModalHost';

type NamedCreateMode = 'project' | 'account' | null;
type QuickCreateGlyph = 'quote'|'task'|'deal'|'account'|'notebook';
function CreateGlyph({kind}:{kind:QuickCreateGlyph}){
 return <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
  stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
  strokeLinejoin="round" aria-hidden="true">
  {kind==='quote'?<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></>:
   kind==='task'?<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/></>:
   kind==='deal'?<><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>:
   kind==='account'?<><path d="M4 21V5l8-3 8 3v16M2 21h20M9 21v-5h6v5M8 8h1M15 8h1M8 12h1M15 12h1"/></>:
   <><rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18M12 8h5M12 12h5M12 16h3"/></>}
 </svg>;
}

export function QuickCreate() {
  const [open, setOpen] = useState(false);
  const [namedMode, setNamedMode] = useState<NamedCreateMode>(null);
  const [name, setName] = useState('');

  const createProject = useCrmStore((state) => state.createProject);
  const resolveCompany = useCrmStore((state) => state.resolveCompany);
  const createEntry = useNotebookStore((state) => state.createEntry);
  const openProject = useNavigationStore((state) => state.openProject);
  const openCompany = useNavigationStore((state) => state.openCompany);
  const setView = useNavigationStore((state) => state.setView);

  const close = () => {
    setOpen(false);
    setNamedMode(null);
    setName('');
  };

  const openDocumentPicker = () => {
    close();
    // Quote creation always starts with the guided template picker.
    useQuoteLibraryStore.getState().setMode('mine');
    useQuotesMobileBetaStore.getState().setEnabled(true);
    useQuotesMobileBetaStore.getState().setLocation({
      page:'library',quoteTab:'build',areaTab:'measure',areaId:null,
    });
    try{window.sessionStorage.setItem('salesshop-open-document-picker-v1','1');}catch{/* optional */}
    setView('quotes');
    window.dispatchEvent(new Event('salesshop:open-document-picker'));
  };

  const startTask = () => {
    close();
    requestTaskModal({mode:'create'});
  };

  const makeNotebookPage = () => {
    createEntry();
    close();
    setView('notebook');
  };

  const submitNamedCreate = (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean || !namedMode) return;

    if (namedMode === 'project') {
      const projectId = createProject(clean);
      close();
      if (projectId) openProject(projectId);
      return;
    }

    const companyId = resolveCompany(clean, 'customer');
    close();
    if (companyId) openCompany(companyId);
  };

  const sheet = open ? createPortal(
    <div className="quick-create-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="quick-create-sheet" role="dialog" aria-modal="true" aria-label="Create in SalesShop">
        <div className="quick-create-handle" aria-hidden="true" />
        <header className="quick-create-header">
          <div><span>Quick create</span><strong>{namedMode ? `New ${namedMode === 'project' ? 'deal' : 'account'}` : 'What are you working on?'}</strong></div>
          <button type="button" onClick={close} aria-label="Close quick create">×</button>
        </header>

        {namedMode ? (
          <form className="quick-create-name-form" onSubmit={submitNamedCreate}>
            <label>
              <span>{namedMode === 'project' ? 'Deal name' : 'Account / company name'}</span>
              <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={namedMode === 'project' ? 'e.g. Parkside Apartments' : 'e.g. DeVane Builders'} />
            </label>
            <div>
              <button type="button" className="quick-create-secondary" onClick={() => { setNamedMode(null); setName(''); }}>Back</button>
              <button type="submit" className="quick-create-primary" disabled={!name.trim()}>Create & open</button>
            </div>
          </form>
        ) : (
          <div className="quick-create-options">
            <button type="button" className="quick-create-option quick-create-option-primary" onClick={openDocumentPicker}>
              <span className="quick-create-icon"><CreateGlyph kind="quote"/></span>
              <span><strong>New Quote / Schedule</strong><small>Choose a template, then follow the guided editor.</small></span>
              <b>›</b>
            </button>
            <button type="button" className="quick-create-option compact" onClick={startTask}>
              <span className="quick-create-icon"><CreateGlyph kind="task"/></span>
              <span><strong>New Task</strong><small>Open the task editor immediately.</small></span><b>›</b>
            </button>
            <div className="quick-create-divider" />
            <button type="button" className="quick-create-option compact" onClick={() => setNamedMode('project')}><span className="quick-create-icon"><CreateGlyph kind="deal"/></span><span><strong>New Deal</strong><small>Add an opportunity or job.</small></span><b>›</b></button>
            <button type="button" className="quick-create-option compact" onClick={() => setNamedMode('account')}><span className="quick-create-icon"><CreateGlyph kind="account"/></span><span><strong>New Account</strong><small>Add a builder, customer, or prospect.</small></span><b>›</b></button>
            <button type="button" className="quick-create-option compact" onClick={makeNotebookPage}><span className="quick-create-icon"><CreateGlyph kind="notebook"/></span><span><strong>New Notebook Page</strong><small>Capture the thought first.</small></span><b>›</b></button>
          </div>
        )}
      </section>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button type="button" className="quick-create-launcher" onClick={() => setOpen(true)} aria-label="Quick create" title="Quick create">+</button>
      {sheet}
    </>
  );
}
