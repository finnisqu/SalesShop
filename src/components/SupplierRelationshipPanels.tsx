import { useMemo, useState } from 'react';
import type { SupplierImportPublicationHistoryRow } from '../services/supplierImportPublisher';
import {
  createSupplierActivity,
  createSupplierCommitment,
  updateSupplierCommitment,
} from '../services/supplierRelationship';
import type {
  SupplierActivity,
  SupplierActivityType,
  SupplierCommitment,
  SupplierCommitmentKind,
  SupplierCommitmentStatus,
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

const commitmentKindLabels: Record<SupplierCommitmentKind, string> = {
  'price-reduction-sf': '$ / SF reduction',
  'percent-discount': 'Percent discount',
  rebate: 'Rebate',
  freight: 'Freight',
  custom: 'Custom',
};

const commitmentStatusLabels: Record<SupplierCommitmentStatus, string> = {
  proposed: 'Proposed',
  negotiating: 'Negotiating',
  confirmed: 'Confirmed',
  achieved: 'Achieved',
  expired: 'Expired',
  cancelled: 'Cancelled',
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
  if (!value) return 'No deadline';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function compactAmount(commitment: SupplierCommitment) {
  if (commitment.amount === undefined) return commitmentKindLabels[commitment.kind];
  if (commitment.kind === 'price-reduction-sf') return `−$${commitment.amount.toFixed(2)}/SF`;
  if (commitment.kind === 'percent-discount') return `${commitment.amount.toFixed(commitment.amount % 1 ? 1 : 0)}% discount`;
  if (commitment.kind === 'rebate') return `$${commitment.amount.toLocaleString()} rebate`;
  if (commitment.kind === 'freight') return `$${commitment.amount.toLocaleString()} ${commitment.unit || 'freight'}`;
  return `${commitment.amount.toLocaleString()} ${commitment.unit || ''}`.trim();
}

function targetLabel(commitment: SupplierCommitment) {
  if (commitment.targetValue === undefined) return commitment.conditionText || 'No trigger recorded';
  const unit = commitment.targetUnit ?? '';
  const value = unit.includes('$')
    ? `$${commitment.targetValue.toLocaleString()}`
    : commitment.targetValue.toLocaleString();
  return [value, unit.replace('$', '').trim(), commitment.conditionText].filter(Boolean).join(' · ');
}

type ActivityDraft = {
  activityType: SupplierActivityType;
  occurredAt: string;
  summary: string;
  details: string;
  contactName: string;
};

type CommitmentDraft = {
  title: string;
  kind: SupplierCommitmentKind;
  amount: string;
  unit: string;
  conditionText: string;
  targetValue: string;
  targetUnit: string;
  deadline: string;
  status: SupplierCommitmentStatus;
  notes: string;
  sourceActivityId: string;
};

const emptyActivity = (): ActivityDraft => ({
  activityType: 'pricing-discussion',
  occurredAt: localDateTimeValue(),
  summary: '',
  details: '',
  contactName: '',
});

const emptyCommitment = (): CommitmentDraft => ({
  title: '',
  kind: 'price-reduction-sf',
  amount: '',
  unit: '$/SF',
  conditionText: '',
  targetValue: '',
  targetUnit: '$ annual POs',
  deadline: '',
  status: 'negotiating',
  notes: '',
  sourceActivityId: '',
});

export function SupplierRelationshipPanels({
  supplier,
  activities,
  commitments,
  publications,
  onActivityCreated,
  onCommitmentChanged,
}: {
  supplier: SupplierProfile;
  activities: SupplierActivity[];
  commitments: SupplierCommitment[];
  publications: SupplierImportPublicationHistoryRow[];
  onActivityCreated: (activity: SupplierActivity) => void;
  onCommitmentChanged: (commitment: SupplierCommitment) => void;
}) {
  const [activityDraft, setActivityDraft] = useState<ActivityDraft>(emptyActivity);
  const [commitmentDraft, setCommitmentDraft] = useState<CommitmentDraft>(emptyCommitment);
  const [savingActivity, setSavingActivity] = useState(false);
  const [savingCommitment, setSavingCommitment] = useState(false);
  const [updatingCommitmentId, setUpdatingCommitmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCommitments = commitments.filter((commitment) => ['proposed', 'negotiating', 'confirmed'].includes(commitment.status));
  const closedCommitments = commitments.filter((commitment) => !['proposed', 'negotiating', 'confirmed'].includes(commitment.status));

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
    return [...manual, ...published].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
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

  const saveCommitment = async () => {
    if (!commitmentDraft.title.trim() || savingCommitment) return;
    setSavingCommitment(true);
    setError(null);
    try {
      const created = await createSupplierCommitment({
        supplierId: supplier.id,
        title: commitmentDraft.title,
        kind: commitmentDraft.kind,
        amount: commitmentDraft.amount === '' ? undefined : Number(commitmentDraft.amount),
        unit: commitmentDraft.unit,
        conditionText: commitmentDraft.conditionText,
        targetValue: commitmentDraft.targetValue === '' ? undefined : Number(commitmentDraft.targetValue),
        targetUnit: commitmentDraft.targetUnit,
        deadline: commitmentDraft.deadline || undefined,
        status: commitmentDraft.status,
        notes: commitmentDraft.notes,
        sourceActivityId: commitmentDraft.sourceActivityId || undefined,
      });
      onCommitmentChanged(created);
      setCommitmentDraft(emptyCommitment());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Supplier commitment could not be saved.');
    } finally {
      setSavingCommitment(false);
    }
  };

  const setCommitmentStatus = async (commitment: SupplierCommitment, status: SupplierCommitmentStatus) => {
    setUpdatingCommitmentId(commitment.id);
    setError(null);
    try {
      const saved = await updateSupplierCommitment(commitment, { status });
      onCommitmentChanged(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Commitment status could not be updated.');
    } finally {
      setUpdatingCommitmentId(null);
    }
  };

  return (
    <section className="supplier-relationship-workspace">
      {error && <div className="supplier-directory-error">{error}</div>}

      <div className="supplier-relationship-grid">
        <section className="supplier-commitment-panel">
          <header>
            <div>
              <span className="board-eyebrow">Commercial commitments</span>
              <strong>{openCommitments.length ? `${openCommitments.length} open` : 'No open commitments'}</strong>
            </div>
            <details className="supplier-add-menu">
              <summary>Add commitment</summary>
              <div className="supplier-add-form commitment-form">
                <label className="wide"><span>Commitment</span><input value={commitmentDraft.title} onChange={(event) => setCommitmentDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. $0.85/SF reduction at $3M annual POs" /></label>
                <label><span>Kind</span><select value={commitmentDraft.kind} onChange={(event) => setCommitmentDraft((current) => ({ ...current, kind: event.target.value as SupplierCommitmentKind }))}>{Object.entries(commitmentKindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label><span>Value</span><input type="number" step="0.01" value={commitmentDraft.amount} onChange={(event) => setCommitmentDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.85" /></label>
                <label><span>Unit</span><input value={commitmentDraft.unit} onChange={(event) => setCommitmentDraft((current) => ({ ...current, unit: event.target.value }))} placeholder="$/SF" /></label>
                <label><span>Status</span><select value={commitmentDraft.status} onChange={(event) => setCommitmentDraft((current) => ({ ...current, status: event.target.value as SupplierCommitmentStatus }))}>{Object.entries(commitmentStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label><span>Target / trigger</span><input type="number" step="0.01" value={commitmentDraft.targetValue} onChange={(event) => setCommitmentDraft((current) => ({ ...current, targetValue: event.target.value }))} placeholder="3000000" /></label>
                <label><span>Target unit</span><input value={commitmentDraft.targetUnit} onChange={(event) => setCommitmentDraft((current) => ({ ...current, targetUnit: event.target.value }))} placeholder="$ annual POs" /></label>
                <label><span>Deadline</span><input type="date" value={commitmentDraft.deadline} onChange={(event) => setCommitmentDraft((current) => ({ ...current, deadline: event.target.value }))} /></label>
                <label className="wide"><span>Condition</span><input value={commitmentDraft.conditionText} onChange={(event) => setCommitmentDraft((current) => ({ ...current, conditionText: event.target.value }))} placeholder="If World Stone reaches the annual PO threshold" /></label>
                <label className="wide"><span>Source activity</span><select value={commitmentDraft.sourceActivityId} onChange={(event) => setCommitmentDraft((current) => ({ ...current, sourceActivityId: event.target.value }))}><option value="">Not linked</option>{activities.slice(0, 20).map((activity) => <option value={activity.id} key={activity.id}>{displayDateTime(activity.occurredAt)} · {activity.summary}</option>)}</select></label>
                <label className="wide"><span>Notes</span><textarea value={commitmentDraft.notes} onChange={(event) => setCommitmentDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Any details, exclusions, brands, or confirmation context…" /></label>
                <button type="button" onClick={() => void saveCommitment()} disabled={!commitmentDraft.title.trim() || savingCommitment}>{savingCommitment ? 'Saving…' : 'Save commitment'}</button>
              </div>
            </details>
          </header>

          <div className="supplier-commitment-list">
            {openCommitments.map((commitment) => {
              const sourceActivity = activities.find((activity) => activity.id === commitment.sourceActivityId);
              return (
                <article className="supplier-commitment-card" key={commitment.id}>
                  <div className="supplier-commitment-top">
                    <div>
                      <span className="supplier-commitment-value">{compactAmount(commitment)}</span>
                      <strong>{commitment.title}</strong>
                    </div>
                    <select
                      value={commitment.status}
                      disabled={updatingCommitmentId === commitment.id}
                      onChange={(event) => void setCommitmentStatus(commitment, event.target.value as SupplierCommitmentStatus)}
                    >
                      {Object.entries(commitmentStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  </div>
                  <dl>
                    <div><dt>Trigger</dt><dd>{targetLabel(commitment)}</dd></div>
                    <div><dt>Deadline</dt><dd>{displayDate(commitment.deadline)}</dd></div>
                  </dl>
                  {commitment.notes && <p>{commitment.notes}</p>}
                  {sourceActivity && <small>Linked to {activityLabels[sourceActivity.activityType].toLowerCase()} · {displayDateTime(sourceActivity.occurredAt)}</small>}
                </article>
              );
            })}
            {!openCommitments.length && <div className="supplier-directory-empty compact">No active pricing commitments or commercial opportunities recorded.</div>}
          </div>

          {closedCommitments.length > 0 && (
            <details className="supplier-closed-commitments">
              <summary>{closedCommitments.length} closed commitment{closedCommitments.length === 1 ? '' : 's'}</summary>
              <div>{closedCommitments.map((commitment) => <article key={commitment.id}><strong>{commitment.title}</strong><span>{compactAmount(commitment)} · {commitmentStatusLabels[commitment.status]}</span></article>)}</div>
            </details>
          )}
        </section>

        <section className="supplier-activity-panel">
          <header>
            <div>
              <span className="board-eyebrow">Relationship timeline</span>
              <strong>Recent activity</strong>
            </div>
            <details className="supplier-add-menu">
              <summary>Log activity</summary>
              <div className="supplier-add-form activity-form">
                <label><span>Type</span><select value={activityDraft.activityType} onChange={(event) => setActivityDraft((current) => ({ ...current, activityType: event.target.value as SupplierActivityType }))}>{Object.entries(activityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label><span>Date / time</span><input type="datetime-local" value={activityDraft.occurredAt} onChange={(event) => setActivityDraft((current) => ({ ...current, occurredAt: event.target.value }))} /></label>
                <label className="wide"><span>Summary</span><input value={activityDraft.summary} onChange={(event) => setActivityDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="What happened?" /></label>
                <label className="wide"><span>Supplier contact</span><input value={activityDraft.contactName} onChange={(event) => setActivityDraft((current) => ({ ...current, contactName: event.target.value }))} placeholder="Optional name" /></label>
                <label className="wide"><span>Details</span><textarea value={activityDraft.details} onChange={(event) => setActivityDraft((current) => ({ ...current, details: event.target.value }))} placeholder="Pricing terms, follow-up, context, promises, concerns…" /></label>
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
            {!timeline.length && <div className="supplier-directory-empty compact">No activity yet. Log the first meeting, call, email, or pricing conversation.</div>}
          </div>
        </section>
      </div>
    </section>
  );
}
