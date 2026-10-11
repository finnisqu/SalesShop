import { useMemo, useState } from 'react';
import type { SupplierImportPublicationHistoryRow } from '../services/supplierImportPublisher';
import { createSupplierActivity } from '../services/supplierRelationship';
import type {
  SupplierActivity,
  SupplierActivityType,
  SupplierProfile,
} from '../types/supplier';

const activityLabels: Record<SupplierActivityType, string> = {
  meeting: 'Meeting',
  call: 'Call',
  email: 'Email',
  'pricing-discussion': 'Pricing discussion',
  'term-change': 'Term change',
  'general-note': 'General note',
  issue: 'Issue',
};

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function displayDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function displayDate(value?: string) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type ActivityDraft = {
  activityType: SupplierActivityType;
  occurredAt: string;
  summary: string;
  details: string;
  contactName: string;
};

const emptyActivity = (): ActivityDraft => ({
  activityType: 'general-note',
  occurredAt: localDateTimeValue(),
  summary: '',
  details: '',
  contactName: '',
});

export function SupplierRelationshipPanels({
  supplier,
  activities,
  publications,
  onActivityCreated,
}: {
  supplier: SupplierProfile;
  activities: SupplierActivity[];
  publications: SupplierImportPublicationHistoryRow[];
  onActivityCreated: (activity: SupplierActivity) => void;
}) {
  const [activityDraft, setActivityDraft] = useState<ActivityDraft>(emptyActivity);
  const [savingActivity, setSavingActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeline = useMemo(() => {
    const manual = activities.map((activity) => ({
      id: activity.id,
      at: activity.occurredAt,
      kind: 'activity' as const,
      activity,
    }));
    const published = publications.map((publication) => ({
      id: `publication-${publication.id}`,
      at: publication.publishedAt,
      kind: 'publication' as const,
      publication,
    }));
    return [...manual, ...published].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
  }, [activities, publications]);

  const saveActivity = async () => {
    if (!activityDraft.summary.trim() || savingActivity) return;
    setSavingActivity(true);
    setError(null);
    try {
      const created = await createSupplierActivity({
        supplierId: supplier.id,
        activityType: activityDraft.activityType,
        occurredAt: new Date(activityDraft.occurredAt).toISOString(),
        summary: activityDraft.summary,
        details: activityDraft.details,
        contactName: activityDraft.contactName,
      });
      onActivityCreated(created);
      setActivityDraft(emptyActivity());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Supplier activity could not be saved.');
    } finally {
      setSavingActivity(false);
    }
  };

  return (
    <section className="supplier-relationship-workspace">
      {error && <div className="supplier-directory-error">{error}</div>}
      <section className="supplier-activity-panel">
        <header>
          <div>
            <span className="board-eyebrow">Relationship log</span>
            <strong>Notes & activity</strong>
          </div>
          <details className="supplier-add-menu">
            <summary>Log activity</summary>
            <div className="supplier-add-form activity-form">
              <label><span>Type</span><select value={activityDraft.activityType} onChange={(event) => setActivityDraft((current) => ({ ...current, activityType: event.target.value as SupplierActivityType }))}>{Object.entries(activityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>Date / time</span><input type="datetime-local" value={activityDraft.occurredAt} onChange={(event) => setActivityDraft((current) => ({ ...current, occurredAt: event.target.value }))} /></label>
              <label className="wide"><span>Summary</span><input value={activityDraft.summary} onChange={(event) => setActivityDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="What should the salesperson remember?" /></label>
              <label className="wide"><span>Supplier contact</span><input value={activityDraft.contactName} onChange={(event) => setActivityDraft((current) => ({ ...current, contactName: event.target.value }))} placeholder="Optional name" /></label>
              <label className="wide"><span>Details</span><textarea value={activityDraft.details} onChange={(event) => setActivityDraft((current) => ({ ...current, details: event.target.value }))} placeholder="Inventory note, pricing conversation, follow-up, lead time, terms, or anything useful later…" /></label>
              <button type="button" onClick={() => void saveActivity()} disabled={!activityDraft.summary.trim() || savingActivity}>{savingActivity ? 'Saving…' : 'Log activity'}</button>
            </div>
          </details>
        </header>

        <div className="supplier-activity-timeline">
          {timeline.map((item) => item.kind === 'activity' ? (
            <article className={`supplier-activity-entry activity-${item.activity.activityType}`} key={item.id}>
              <div className="supplier-activity-marker" />
              <div>
                <header><span>{activityLabels[item.activity.activityType]}</span><time>{displayDateTime(item.activity.occurredAt)}</time></header>
                <strong>{item.activity.summary}</strong>
                {item.activity.contactName && <small>With {item.activity.contactName}</small>}
                {item.activity.details && <p>{item.activity.details}</p>}
              </div>
            </article>
          ) : (
            <article className="supplier-activity-entry activity-publication" key={item.id}>
              <div className="supplier-activity-marker" />
              <div>
                <header><span>Pricing published</span><time>{displayDateTime(item.publication.publishedAt)}</time></header>
                <strong>{item.publication.priceListLabel || item.publication.sourceFileName}</strong>
                <small>Effective {displayDate(item.publication.effectiveDate)} · {item.publication.summary.publishedCount ?? 0} records published</small>
              </div>
            </article>
          ))}
          {!timeline.length && <div className="supplier-directory-empty compact">No notes or activity yet. Log the first useful supplier note, call, email, or pricing conversation.</div>}
        </div>
      </section>
    </section>
  );
}
