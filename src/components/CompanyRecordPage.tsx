import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RecordPageLayout, RecordCard, RecordProperty } from './RecordPageLayout';
import { companyRecordView } from '../services/companyRecordView';
import { companyAnnualPotential, companyEstimatedAnnualWork, type CompanyKind } from '../types/crm';
import { displayQuoteNumber, quoteTotal } from '../types/quote';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { useNavigationStore } from '../store/navigationStore';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const optionalNumber = (value: string) => value.trim() === '' ? undefined : Number(value);
type ActivityFilter = 'all' | 'quote' | 'project' | 'contact';

export function CompanyRecordPage({ companyId, onBack }: { companyId: string; onBack: () => void }) {
  const companies = useCrmStore((state) => state.companies);
  const crmHydrated = useCrmStore((state) => state.hydrated);
  const contacts = useCrmStore((state) => state.contacts);
  const projects = useCrmStore((state) => state.projects);
  const activities = useCrmStore((state) => state.activities);
  const updateCompany = useCrmStore((state) => state.updateCompany);
  const createContact = useCrmStore((state) => state.createContact);
  const quotes = useQuoteStore((state) => state.quotes);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const createQuote = useQuoteStore((state) => state.createQuote);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const openProject = useNavigationStore((state) => state.openProject);
  const openPerson = useNavigationStore((state) => state.openPerson);
  const [editing, setEditing] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [historyOpen, setHistoryOpen] = useState(false);
  const company = companies.find((candidate) => candidate.id === companyId);
  const [draft, setDraft] = useState({
    name: company?.name ?? '', kind: company?.kind ?? 'customer' as CompanyKind,
    annualUnits: company?.annualUnits?.toString() ?? '',
    averageUnitValue: company?.averageUnitValue?.toString() ?? '',
    expectedSharePct: company?.expectedSharePct?.toString() ?? '',
  });

  useEffect(() => { hydrateQuotes(); }, [hydrateQuotes]);
  useEffect(() => {
    setEditing(false);
    setAddingContact(false);
    setActivityFilter('all');
    setHistoryOpen(false);
    setContactName(''); setContactEmail(''); setNewAlias('');
  }, [companyId]);
  useEffect(() => {
    if (!editing && company) setDraft({
      name: company.name, kind: company.kind,
      annualUnits: company.annualUnits?.toString() ?? '',
      averageUnitValue: company.averageUnitValue?.toString() ?? '',
      expectedSharePct: company.expectedSharePct?.toString() ?? '',
    });
  }, [company, editing]);

  const related = useMemo(
    () => company ? companyRecordView(company, contacts, projects, activities, quotes) : null,
    [company, contacts, projects, activities, quotes],
  );
  if (!crmHydrated) return <section className="connections-record-missing" role="status">Loading company record…</section>;
  if (!company || !related) return <section className="connections-record-missing" role="status">
    <h1>Company not available</h1>
    <p>This record may have been removed or you may not have access to it.</p>
    <button type="button" onClick={onBack}>Back to Companies</button>
  </section>;

  const filteredActivities = related.relatedActivities.filter((activity) => {
    if (activityFilter === 'all') return true;
    if (activityFilter === 'contact') return activity.type.startsWith('contact-');
    if (activityFilter === 'project') return activity.type.startsWith('project-');
    return activity.type.startsWith('quote-') || activity.type.startsWith('change-order-');
  });
  const saveCompany = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const nums = [draft.annualUnits, draft.averageUnitValue, draft.expectedSharePct];
    if (nums.some((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0))) return;
    if (draft.expectedSharePct.trim() && Number(draft.expectedSharePct) > 100) return;
    updateCompany(company.id, {
      name: draft.name.trim(), kind: draft.kind,
      annualUnits: optionalNumber(draft.annualUnits),
      averageUnitValue: optionalNumber(draft.averageUnitValue),
      expectedSharePct: optionalNumber(draft.expectedSharePct),
    });
    setEditing(false);
  };
  const addContact = (event: FormEvent) => {
    event.preventDefault();
    if (!contactName.trim() && !contactEmail.trim()) return;
    const id = createContact({ companyId: company.id, name: contactName, email: contactEmail, source: 'manual' });
    if (id) {
      setContactName(''); setContactEmail(''); setAddingContact(false);
    }
  };
  const newQuote = () => {
    const quoteId = createQuote({ title: 'Quote · ' + company.name, companyId: company.id, companyName: company.name });
    openQuote(quoteId);
  };
  const addAlias = (event: FormEvent) => {
    event.preventDefault();
    const alias = newAlias.trim();
    if (!alias || company.aliases?.some((existing) => existing.toLowerCase() === alias.toLowerCase())) return;
    updateCompany(company.id, { aliases: [...(company.aliases ?? []), alias] });
    setNewAlias('');
  };

  return <RecordPageLayout entityType="company" title={company.name} onBack={onBack}
    subtitle={company.kind === 'non-customer' ? 'Partner / non-customer relationship' : 'Customer / prospect'}
    badge={<><span className="connections-record-stage">{company.kind === 'customer' ? 'Customer / prospect' : 'Partner / other'}</span><span>{related.relatedProjects.length} deals</span><span>{related.relatedQuotes.length} linked quotes</span></>}
    actions={<>
      <button type="button" onClick={() => setEditing((current) => !current)}>{editing ? 'Cancel editing' : 'Edit company'}</button>
      {company.kind === 'customer' && <button type="button" className="connections-record-primary" onClick={newQuote}>+ New quote</button>}
    </>}
    left={<>
      <RecordCard title="About this company">
        {editing ? <form className="connections-record-edit-form" onSubmit={saveCompany}>
          <label>Company name<input autoFocus required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Relationship<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as CompanyKind })}>
            <option value="customer">Customer / prospect</option><option value="non-customer">Partner / non-customer</option>
          </select></label>
          <label>Annual units<input type="number" min="0" step="1" value={draft.annualUnits} onChange={(event) => setDraft({ ...draft, annualUnits: event.target.value })} /></label>
          <label>Average revenue / unit<input type="number" min="0" step="0.01" value={draft.averageUnitValue} onChange={(event) => setDraft({ ...draft, averageUnitValue: event.target.value })} /></label>
          <label>Expected share (%)<input type="number" min="0" max="100" step="0.1" value={draft.expectedSharePct} onChange={(event) => setDraft({ ...draft, expectedSharePct: event.target.value })} /></label>
          <div className="connections-record-form-actions">
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="connections-record-primary" disabled={!draft.name.trim()}>Save changes</button>
          </div>
        </form> : <div className="connections-record-properties-list">
          <RecordProperty label="Relationship">{company.kind === 'customer' ? 'Customer / prospect' : 'Partner / other'}</RecordProperty>
          <RecordProperty label="Created">{dateLabel(company.createdAt)}</RecordProperty>
          <RecordProperty label="Last updated">{dateLabel(company.updatedAt)}</RecordProperty>
        </div>}
      </RecordCard>
      {company.kind === 'customer' && <RecordCard title="Account forecast">
        <div className="connections-record-properties-list">
          <RecordProperty label="Annual units">{company.annualUnits ?? 'Not set'}</RecordProperty>
          <RecordProperty label="Revenue / unit">{company.averageUnitValue === undefined ? 'Not set' : money.format(company.averageUnitValue)}</RecordProperty>
          <RecordProperty label="Expected share">{company.expectedSharePct === undefined ? 'Not set' : company.expectedSharePct + '%'}</RecordProperty>
          <RecordProperty label="Annual potential">{companyAnnualPotential(company) === undefined ? 'Not set' : money.format(companyAnnualPotential(company)!)}</RecordProperty>
          <RecordProperty label="Expected annual work">{companyEstimatedAnnualWork(company) === undefined ? 'Not set' : money.format(companyEstimatedAnnualWork(company)!)}</RecordProperty>
        </div>
      </RecordCard>}
      <RecordCard title="Known aliases">
        <div className="connections-record-aliases">
          {(company.aliases ?? []).map((alias) => <span key={alias}>{alias}
            <button type="button" aria-label={'Remove alias ' + alias} onClick={() => updateCompany(company.id, { aliases: (company.aliases ?? []).filter((item) => item !== alias) })}>×</button>
          </span>)}
          {!company.aliases?.length && <p className="connections-record-helper">No alternate names saved.</p>}
        </div>
        <form className="connections-record-alias-form" onSubmit={addAlias}>
          <input value={newAlias} onChange={(event) => setNewAlias(event.target.value)} aria-label="New company alias" placeholder="Add an alternate name" />
          <button type="submit" disabled={!newAlias.trim()}>Add</button>
        </form>
      </RecordCard>
    </>}
    center={<>
      <RecordCard title="Deals" extra={<span>{related.relatedProjects.length}</span>}>
        <div className="connections-record-entity-list">
          {related.relatedProjects.map((project) => <button type="button" key={project.id} onClick={() => openProject(project.id)}>
            <strong>{project.name}</strong><small>{project.stage}{project.dueDate ? ' · Due ' + dateLabel(project.dueDate) : ''}</small>
          </button>)}
          {!related.relatedProjects.length && <p className="connections-record-empty">No deals linked yet.</p>}
        </div>
      </RecordCard>
      <RecordCard title="Quotes" extra={<span>{related.relatedQuotes.length}</span>}>
        <div className="connections-record-entity-list">
          {related.relatedQuotes.map((quote) => <button type="button" key={quote.id} onClick={() => openQuote(quote.id)}>
            <strong>{quote.title || displayQuoteNumber(quote)}</strong>
            <small>{displayQuoteNumber(quote)} · {quote.status} · {money.format(quoteTotal(quote))}</small>
          </button>)}
          {!related.relatedQuotes.length && <p className="connections-record-empty">No quotes explicitly linked to this company or its deals.</p>}
        </div>
      </RecordCard>

    </>}
    right={<>
      <RecordCard title="People" extra={<span>{related.relatedContacts.length}</span>}>
        <div className="connections-record-entity-list">
          {related.relatedContacts.map((person) => <article key={person.id}>
            <button type="button" className="connections-person-entity-open" onClick={() => openPerson(person.id)}>
              <strong>{person.name || person.email || 'Unnamed contact'}</strong>
              <small>Open person →</small>
            </button>
            {person.title && <small>{person.title}</small>}
            {person.email && <a href={'mailto:' + person.email}>{person.email}</a>}
            {person.phone && <a href={'tel:' + person.phone}>{person.phone}</a>}
          </article>)}
          {!related.relatedContacts.length && <p className="connections-record-empty">No people linked yet.</p>}
        </div>
        <button type="button" className="connections-record-add" onClick={() => setAddingContact((value) => !value)}>{addingContact ? 'Cancel' : '+ Add person'}</button>
        {addingContact && <form className="connections-record-edit-form" onSubmit={addContact}>
          <label>Name<input autoFocus value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
          <label>Email<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label>
          <div className="connections-record-form-actions">
            <button type="button" onClick={() => setAddingContact(false)}>Cancel</button>
            <button type="submit" className="connections-record-primary" disabled={!contactName.trim() && !contactEmail.trim()}>Save person</button>
          </div>
        </form>}
      </RecordCard>

      <section className="connections-record-panel connections-record-history">
        <button type="button" className="connections-history-toggle" aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((value) => !value)}>
          <span>Activity history</span><small>{historyOpen ? 'Hide' : 'View'} <span aria-hidden="true">{historyOpen ? '▴' : '▾'}</span></small>
        </button>
        {historyOpen && <div className="connections-record-panel-body">

        <div className="connections-record-filter" role="group" aria-label="Filter company activities">
          {(['all', 'quote', 'project', 'contact'] as const).map((filter) =>
            <button type="button" key={filter} aria-pressed={activityFilter === filter} onClick={() => setActivityFilter(filter)}>
              {filter === 'all' ? 'All' : filter === 'quote' ? 'Quotes' : filter === 'project' ? 'Deals' : 'Contacts'}
            </button>)}
        </div>
        <ol className="connections-record-timeline">
          {filteredActivities.map((activity) => <li key={activity.id}>
            <div><strong>{activity.summary}</strong><time dateTime={activity.occurredAt}>{dateLabel(activity.occurredAt)}</time></div>
            <small>{activity.type.replaceAll('-', ' ')}</small>
            {activity.quoteId && related.relatedQuotes.some((quote) => quote.id === activity.quoteId) &&
              <button type="button" onClick={() => openQuote(activity.quoteId!)}>Open linked quote →</button>}
            {!activity.quoteId && activity.projectId && related.relatedProjects.some((project) => project.id === activity.projectId) &&
              <button type="button" onClick={() => openProject(activity.projectId!)}>Open linked deal →</button>}
          </li>)}
        </ol>
        {!filteredActivities.length && <p className="connections-record-empty">No activity history matches these filters.</p>}


        </div>}
      </section>
    </>}
  />;
}
