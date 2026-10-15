import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RecordPageLayout, RecordCard, RecordProperty } from './RecordPageLayout';
import { personRecordView } from '../services/personRecordView';
import { useCrmStore } from '../store/crmStore';
import { useNavigationStore } from '../store/navigationStore';

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

export function PersonRecordPage({ contactId, onBack }: { contactId: string; onBack: () => void }) {
  const hydrated = useCrmStore((state) => state.hydrated);
  const people = useCrmStore((state) => state.contacts);
  const companies = useCrmStore((state) => state.companies);
  const activities = useCrmStore((state) => state.activities);
  const updateContact = useCrmStore((state) => state.updateContact);
  const openCompany = useNavigationStore((state) => state.openCompany);
  const openProject = useNavigationStore((state) => state.openProject);
  const openQuote = useNavigationStore((state) => state.openQuote);

  const person = people.find((candidate) => candidate.id === contactId);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: person?.name ?? '', email: person?.email ?? '', phone: person?.phone ?? '',
    title: person?.title ?? '', companyId: person?.companyId ?? '',
  });
  const related = useMemo(
    () => person ? personRecordView(person, companies, activities) : null,
    [person, companies, activities],
  );

  useEffect(() => {
    setEditing(false);
    setHistoryOpen(false);
  }, [contactId]);
  useEffect(() => {
    if (!editing && person) setDraft({
      name: person.name, email: person.email ?? '', phone: person.phone ?? '',
      title: person.title ?? '', companyId: person.companyId ?? '',
    });
  }, [person, editing]);

  if (!hydrated) return <section className="connections-record-missing" role="status">Loading person record…</section>;
  if (!person || !related) return <section className="connections-record-missing" role="status">
    <h1>Person not available</h1>
    <p>This record may have been removed or you may not have access to it.</p>
    <button type="button" onClick={onBack}>Back to People</button>
  </section>;

  const save = (event: FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim() || draft.email.trim();
    if (!name) return;
    updateContact(person.id, {
      name, email: draft.email.trim(), phone: draft.phone.trim(),
      title: draft.title.trim(), companyId: draft.companyId || undefined,
    });
    setEditing(false);
  };
  const displayName = person.name || person.email || 'Unnamed contact';

  return <RecordPageLayout entityType="person" title={displayName} onBack={onBack}
    subtitle={[person.title, related.company?.name].filter(Boolean).join(' · ') || 'Contact'}
    badge={<span>{related.company ? 'Associated company' : 'Unassigned'}</span>}
    actions={<button type="button" onClick={() => setEditing((value) => !value)}>
      {editing ? 'Cancel editing' : 'Edit person'}
    </button>}
    left={<>
      <RecordCard title="About this person">
        {editing ? <form className="connections-record-edit-form" onSubmit={save}>
          <label>Name<input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Email<input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
          <label>Phone<input type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
          <label>Job title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Company<select value={draft.companyId} onChange={(event) => setDraft({ ...draft, companyId: event.target.value })}>
            <option value="">Unassigned company</option>
            {companies.slice().sort((a,b) => a.name.localeCompare(b.name)).map((item) =>
              <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <div className="connections-record-form-actions">
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="connections-record-primary" disabled={!draft.name.trim() && !draft.email.trim()}>Save changes</button>
          </div>
        </form> : <div className="connections-record-properties-list">
          <RecordProperty label="Name">{displayName}</RecordProperty>
          <RecordProperty label="Job title">{person.title || 'Not set'}</RecordProperty>
          <RecordProperty label="Email">{person.email || 'Not set'}</RecordProperty>
          <RecordProperty label="Phone">{person.phone || 'Not set'}</RecordProperty>
          <RecordProperty label="Company">{related.company?.name || 'Not assigned'}</RecordProperty>
          <RecordProperty label="Created">{dateLabel(person.createdAt)}</RecordProperty>
          <RecordProperty label="Updated">{dateLabel(person.updatedAt)}</RecordProperty>
        </div>}
      </RecordCard>
    </>}
    center={<>
      <RecordCard title="Company">
        {related.company ? <div className="connections-record-entity-list">
          <button type="button" onClick={() => openCompany(related.company!.id)}>
            <strong>{related.company.name}</strong>
            <small>{related.company.kind === 'customer' ? 'Customer / prospect' : 'Partner / other'} · View company record →</small>
          </button>
        </div> : <p className="connections-record-empty">No company is assigned. Select Edit person to associate one.</p>}
      </RecordCard>
    </>}
    right={<>
      <RecordCard title="Contact details">
        <div className="connections-person-contact-actions">
          {person.email ? <a href={'mailto:' + person.email}>✉ Email</a> : <span>Email not provided</span>}
          {person.phone ? <a href={'tel:' + person.phone}>☎ Call</a> : <span>Phone not provided</span>}
        </div>
        <p className="connections-record-helper">Opening your email or phone app does not automatically log an activity.</p>
      </RecordCard>
      <section className="connections-record-panel connections-record-history">
        <button type="button" className="connections-history-toggle" aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((value) => !value)}>
          <span>Activity history</span><small>{historyOpen ? 'Hide' : 'View'} <span aria-hidden="true">{historyOpen ? '▴' : '▾'}</span></small>
        </button>
        {historyOpen && <div className="connections-record-panel-body">
          <p className="connections-record-helper">Only events explicitly linked to this person appear here.</p>
          <ol className="connections-record-timeline">
            {related.directActivities.map((activity) => <li key={activity.id}>
              <div><strong>{activity.summary}</strong><time dateTime={activity.occurredAt}>{dateLabel(activity.occurredAt)}</time></div>
              <small>{activity.type.replaceAll('-', ' ')}</small>
              {activity.quoteId && <button type="button" onClick={() => openQuote(activity.quoteId!)}>Open linked quote →</button>}
              {!activity.quoteId && activity.projectId && <button type="button" onClick={() => openProject(activity.projectId!)}>Open linked deal →</button>}
            </li>)}
          </ol>
          {!related.directActivities.length && <p className="connections-record-empty">No directly linked history on this contact.</p>}
        </div>}
      </section>
    </>}
  />;
}
