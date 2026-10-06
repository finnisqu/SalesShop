import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { createPricingScheduleData } from '../services/pricingSchedule';
import { useCrmStore } from '../store/crmStore';
import { useNavigationStore } from '../store/navigationStore';
import { useNotebookStore } from '../store/notebookStore';
import { useQuoteStore } from '../store/quoteStore';

type NamedCreateMode = 'project' | 'account' | null;

export function QuickCreate() {
  const [open, setOpen] = useState(false);
  const [namedMode, setNamedMode] = useState<NamedCreateMode>(null);
  const [name, setName] = useState('');

  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const createQuote = useQuoteStore((state) => state.createQuote);
  const updateQuote = useQuoteStore((state) => state.updateQuote);
  const createProject = useCrmStore((state) => state.createProject);
  const resolveCompany = useCrmStore((state) => state.resolveCompany);
  const createEntry = useNotebookStore((state) => state.createEntry);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const openProject = useNavigationStore((state) => state.openProject);
  const openCompany = useNavigationStore((state) => state.openCompany);
  const setView = useNavigationStore((state) => state.setView);

  const close = () => {
    setOpen(false);
    setNamedMode(null);
    setName('');
  };

  const makeQuote = (pricingSchedule = false) => {
    hydrateQuotes();
    const quoteId = createQuote({
      documentType: pricingSchedule ? 'pricing-schedule' : 'quote',
      title: pricingSchedule ? 'Untitled pricing schedule' : 'Untitled quote',
    });
    if (pricingSchedule) {
      updateQuote(quoteId, { pricingSchedule: createPricingScheduleData(quoteId) });
    }
    close();
    openQuote(quoteId);
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
          <div><span>Quick create</span><strong>{namedMode ? `New ${namedMode}` : 'What are you working on?'}</strong></div>
          <button type="button" onClick={close} aria-label="Close quick create">×</button>
        </header>

        {namedMode ? (
          <form className="quick-create-name-form" onSubmit={submitNamedCreate}>
            <label>
              <span>{namedMode === 'project' ? 'Project name' : 'Account / company name'}</span>
              <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={namedMode === 'project' ? 'e.g. Parkside Apartments' : 'e.g. DeVane Builders'} />
            </label>
            <div>
              <button type="button" className="quick-create-secondary" onClick={() => { setNamedMode(null); setName(''); }}>Back</button>
              <button type="submit" className="quick-create-primary" disabled={!name.trim()}>Create & open</button>
            </div>
          </form>
        ) : (
          <div className="quick-create-options">
            <button type="button" className="quick-create-option quick-create-option-primary" onClick={() => makeQuote(false)}>
              <span className="quick-create-icon">Q</span>
              <span><strong>New Quote</strong><small>Start selling. CRM fills in underneath.</small></span>
              <b>›</b>
            </button>
            <button type="button" className="quick-create-option" onClick={() => makeQuote(true)}>
              <span className="quick-create-icon">$</span>
              <span><strong>New Pricing Schedule</strong><small>Simple Rates, Plan Pricing, or Spreadsheet.</small></span>
              <b>›</b>
            </button>
            <div className="quick-create-divider" />
            <button type="button" className="quick-create-option compact" onClick={() => setNamedMode('project')}><span className="quick-create-icon">P</span><span><strong>New Project</strong><small>Add an opportunity or job.</small></span><b>›</b></button>
            <button type="button" className="quick-create-option compact" onClick={() => setNamedMode('account')}><span className="quick-create-icon">A</span><span><strong>New Account</strong><small>Add a builder, customer, or prospect.</small></span><b>›</b></button>
            <button type="button" className="quick-create-option compact" onClick={makeNotebookPage}><span className="quick-create-icon">N</span><span><strong>New Notebook Page</strong><small>Capture the thought first.</small></span><b>›</b></button>
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
