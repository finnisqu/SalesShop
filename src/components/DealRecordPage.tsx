import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RecordPageLayout, RecordCard, RecordProperty } from './RecordPageLayout';
import { ProjectNotebookLinks } from './ProjectNotebookLinks';
import { dealRecordView } from '../services/dealRecordView';
import { PROJECT_STAGES, type ProjectStage } from '../types/crm';
import { quoteTotal, displayQuoteNumber } from '../types/quote';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { useNavigationStore } from '../store/navigationStore';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const displayDate = (value?: string) => {
  if (!value) return 'Not set';
  const date = new Date(value.includes('T') ? value : value + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
};

export function DealRecordPage({ dealId, onBack }: { dealId: string; onBack: () => void }) {
  const hydrated = useCrmStore(state => state.hydrated);
  const deals = useCrmStore(state => state.projects);
  const companies = useCrmStore(state => state.companies);
  const contacts = useCrmStore(state => state.contacts);
  const activities = useCrmStore(state => state.activities);
  const updateDeal = useCrmStore(state => state.updateProject);
  const relinkCompany = useCrmStore(state => state.relinkProjectCompany);
  const quotes = useQuoteStore(state => state.quotes);
  const hydrateQuotes = useQuoteStore(state => state.hydrate);
  const createQuote = useQuoteStore(state => state.createQuote);
  const openQuote = useNavigationStore(state => state.openQuote);
  const openCompany = useNavigationStore(state => state.openCompany);
  const openPerson = useNavigationStore(state => state.openPerson);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const deal = deals.find(item => item.id === dealId);
  const [draft, setDraft] = useState({
    name: deal?.name ?? '', stage: deal?.stage ?? 'Discovery' as ProjectStage,
    companyId: deal?.companyId ?? '',
    amount: deal?.amount?.toString() ?? '',
    dueDate: deal?.dueDate ?? '',
    nextAction: deal?.nextAction ?? '',
    lastTouchpoint: deal?.lastTouchpoint ?? '',
  });

  useEffect(() => { hydrateQuotes(); }, [hydrateQuotes]);
  useEffect(() => { setEditing(false); setHistoryOpen(false); }, [dealId]);
  useEffect(() => {
    if (!editing && deal) setDraft({
      name: deal.name, stage: deal.stage, companyId: deal.companyId ?? '',
      amount: deal.amount?.toString() ?? '', dueDate: deal.dueDate ?? '',
      nextAction: deal.nextAction ?? '', lastTouchpoint: deal.lastTouchpoint ?? '',
    });
  }, [deal, editing]);
  const related = useMemo(
    () => deal ? dealRecordView(deal, companies, contacts, quotes, activities) : null,
    [deal, companies, contacts, quotes, activities],
  );

  if (!hydrated) return <section className="connections-record-missing" role="status">Loading deal record…</section>;
  if (!deal || !related) return <section className="connections-record-missing" role="status">
    <h1>Deal not available</h1>
    <p>This record may have been removed or you may not have access to it.</p>
    <button type="button" onClick={onBack}>Back to Deals</button>
  </section>;

  const saveDeal = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const amount = draft.amount.trim() ? Number(draft.amount) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) return;
    updateDeal(deal.id, {
      name: draft.name.trim(), stage: draft.stage, amount,
      dueDate: draft.dueDate || undefined,
      nextAction: draft.nextAction.trim() || undefined,
      lastTouchpoint: draft.lastTouchpoint || undefined,
      ...(!draft.companyId && deal.companyId ? { companyName: '' } : {}),
    });
    if (draft.companyId && draft.companyId !== deal.companyId) relinkCompany(deal.id, draft.companyId);
    setEditing(false);
  };
  const newQuote = () => {
    const id = createQuote({ title: deal.name, projectId: deal.id, companyId: deal.companyId, companyName: deal.companyName });
    openQuote(id);
  };

  return <RecordPageLayout entityType="project" recordTypeLabel="Deal" collectionLabel="Deals" title={deal.name} onBack={onBack}
    subtitle={related.company?.name || deal.companyName || 'No associated company'}
    badge={<><span className="connections-record-stage">{deal.stage}</span><span>{related.linkedQuotes.length} linked quotes</span></>}
    actions={<>
      <button type="button" onClick={() => setEditing(value => !value)}>{editing ? 'Cancel editing' : 'Edit deal'}</button>
      <button type="button" className="connections-record-primary" onClick={newQuote}>+ New quote</button>
    </>}
    left={<>
      <RecordCard title="About this deal">
        {editing ? <form className="connections-record-edit-form" onSubmit={saveDeal}>
          <label>Deal name<input required autoFocus value={draft.name} onChange={event => setDraft({...draft,name:event.target.value})} /></label>
          <label>Stage<select value={draft.stage} onChange={event => setDraft({...draft,stage:event.target.value as ProjectStage})}>
            {PROJECT_STAGES.map(stage => <option key={stage} value={stage}>{stage}</option>)}
          </select></label>
          <label>Amount<input type="number" min="0" step="0.01" value={draft.amount} onChange={event => setDraft({...draft,amount:event.target.value})} /></label>
          <label>Bid due date<input type="date" value={draft.dueDate} onChange={event => setDraft({...draft,dueDate:event.target.value})} /></label>
          <label>Company<select value={draft.companyId} onChange={event => setDraft({...draft,companyId:event.target.value})}>
            <option value="">No company selected</option>
            {companies.slice().sort((a,b) => a.name.localeCompare(b.name)).map(company =>
              <option key={company.id} value={company.id}>{company.name}</option>)}
          </select></label>
          <label>Next action<textarea rows={3} value={draft.nextAction} onChange={event => setDraft({...draft,nextAction:event.target.value})} /></label>
          <label>Last touchpoint<input type="date" value={draft.lastTouchpoint} onChange={event => setDraft({...draft,lastTouchpoint:event.target.value})} /></label>
          <div className="connections-record-form-actions">
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            <button className="connections-record-primary" type="submit" disabled={!draft.name.trim()}>Save changes</button>
          </div>
        </form> : <div className="connections-record-properties-list">
          <RecordProperty label="Stage">{deal.stage}</RecordProperty>
          <RecordProperty label="Amount">{deal.amount === undefined ? 'Not set' : money.format(deal.amount)}</RecordProperty>
          <RecordProperty label="Bid due date">{displayDate(deal.dueDate)}</RecordProperty>
          <RecordProperty label="Next action">{deal.nextAction || 'Not set'}</RecordProperty>
          <RecordProperty label="Last touchpoint">{displayDate(deal.lastTouchpoint)}</RecordProperty>
          <RecordProperty label="Created">{displayDate(deal.createdAt)}</RecordProperty>
        </div>}
      </RecordCard>
    </>}
    center={<>
      <RecordCard title="Quotes" extra={<span>{related.linkedQuotes.length}</span>}>
        <div className="connections-record-entity-list">
          {related.linkedQuotes.map(quote => <button type="button" key={quote.id} onClick={() => openQuote(quote.id)}>
            <strong>{quote.title || displayQuoteNumber(quote)}</strong>
            <small>{displayQuoteNumber(quote)} · {quote.status} · {money.format(quoteTotal(quote))}</small>
          </button>)}
          {!related.linkedQuotes.length && <p className="connections-record-empty">No quotes explicitly linked to this deal.</p>}
        </div>
      </RecordCard>
      <RecordCard title="Notebook">
        <ProjectNotebookLinks project={deal} />
      </RecordCard>
    </>}
    right={<>
      <RecordCard title="Company">
        {related.company ? <div className="connections-record-entity-list">
          <button type="button" onClick={() => openCompany(related.company!.id)}>
            <strong>{related.company.name}</strong><small>Open company →</small>
          </button>
        </div> : <p className="connections-record-empty">No associated company. Edit the deal to select one.</p>}
      </RecordCard>
      <RecordCard title="Quote contacts" extra={<span>{related.quoteContacts.length}</span>}>
        <p className="connections-record-helper">People explicitly linked to this deal's quotes. Deal-specific contact roles have not been assigned.</p>
        <div className="connections-record-entity-list">
          {related.quoteContacts.map(person => <button type="button" key={person.id} onClick={() => openPerson(person.id)}>
            <strong>{person.name || person.email || 'Unnamed contact'}</strong>
            <small>{person.title || person.email || 'Open person'} →</small>
          </button>)}
          {!related.quoteContacts.length && <p className="connections-record-empty">No quote contacts linked yet.</p>}
        </div>
      </RecordCard>
      <section className="connections-record-panel connections-record-history">
        <button type="button" className="connections-history-toggle" aria-expanded={historyOpen}
          onClick={() => setHistoryOpen(value => !value)}>
          <span>Activity history</span><small>{historyOpen ? 'Hide' : 'View'} <span aria-hidden="true">{historyOpen ? '▴' : '▾'}</span></small>
        </button>
        {historyOpen && <div className="connections-record-panel-body">
          <p className="connections-record-helper">Only events explicitly linked to this deal or its quotes.</p>
          <ol className="connections-record-timeline">
            {related.directHistory.map(activity => <li key={activity.id}>
              <div><strong>{activity.summary}</strong><time dateTime={activity.occurredAt}>{displayDate(activity.occurredAt)}</time></div>
              <small>{activity.type.replaceAll('-', ' ')}</small>
              {activity.quoteId && related.linkedQuotes.some(quote => quote.id === activity.quoteId) &&
                <button type="button" onClick={() => openQuote(activity.quoteId!)}>Open linked quote →</button>}
            </li>)}
          </ol>
          {!related.directHistory.length && <p className="connections-record-empty">No directly linked history available.</p>}
        </div>}
      </section>
    </>}
  />;
}
