import { Fragment, useEffect, useMemo, useState } from 'react';
import { stageVicostoneFabricatorPdf } from '../services/vicostoneSupplierImport';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useSupplierImportStore } from '../store/supplierImportStore';
import { materialPurchaseCostPerSf, type MaterialVariant } from '../types/settings';
import type {
  SupplierImportCandidate,
  SupplierImportReviewDecision,
  SupplierImportSession,
  SupplierImportStatus,
} from '../types/supplierImport';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

type StatusFilter = 'all' | SupplierImportStatus | 'warnings';
type ReviewFilter = 'all' | SupplierImportReviewDecision;

const STATUS_LABELS: Record<SupplierImportStatus, string> = {
  new: 'New',
  changed: 'Changed',
  unchanged: 'Unchanged',
  'possible-duplicate': 'Possible duplicate',
};

const REVIEW_LABELS: Record<SupplierImportReviewDecision, string> = {
  pending: 'Pending',
  approved: 'Approved',
  'needs-review': 'Needs review',
  ignored: 'Ignored',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function specLabel(variant: MaterialVariant) {
  const size = variant.lengthIn && variant.widthIn ? `${variant.lengthIn} × ${variant.widthIn}` : '';
  return [variant.thickness, variant.finish, variant.formatName, size].filter(Boolean).join(' · ');
}

function programCount(candidate: SupplierImportCandidate) {
  return (candidate.material.variants ?? []).reduce((total, variant) => total + variant.purchaseOptions.length, 0);
}

function reviewDecision(candidate: SupplierImportCandidate) {
  return candidate.reviewDecision ?? 'pending';
}

function sessionReviewCounts(session: SupplierImportSession) {
  return {
    pending: session.candidates.filter((candidate) => reviewDecision(candidate) === 'pending').length,
    approved: session.candidates.filter((candidate) => reviewDecision(candidate) === 'approved').length,
    needsReview: session.candidates.filter((candidate) => reviewDecision(candidate) === 'needs-review').length,
    ignored: session.candidates.filter((candidate) => reviewDecision(candidate) === 'ignored').length,
  };
}

function ReviewSelect({
  value,
  onChange,
  label,
}: {
  value: SupplierImportReviewDecision;
  onChange: (decision: SupplierImportReviewDecision) => void;
  label: string;
}) {
  return (
    <select className={`supplier-import-review-select review-${value}`} value={value} onChange={(event) => onChange(event.target.value as SupplierImportReviewDecision)} aria-label={label}>
      <option value="pending">Pending</option>
      <option value="approved">Approve</option>
      <option value="needs-review">Needs review</option>
      <option value="ignored">Ignore</option>
    </select>
  );
}

function CandidateDetails({ candidate }: { candidate: SupplierImportCandidate }) {
  const setVariantDecision = useSupplierImportStore((state) => state.setVariantDecision);
  const setPriceDecision = useSupplierImportStore((state) => state.setPriceDecision);
  const setCandidateNote = useSupplierImportStore((state) => state.setCandidateNote);

  return (
    <div className="supplier-import-candidate-details">
      <div className="supplier-import-diff-panel">
        <div><strong>Comparison</strong>{candidate.changeSummary.map((change) => <span key={change}>{change}</span>)}</div>
        <div><strong>Import safety</strong><span>STOCK status, Level assignment, images, product URL and account pricing are management-owned and are not overwritten by supplier data.</span>{candidate.warnings.map((warning) => <span className="warning" key={warning}>{warning}</span>)}</div>
      </div>

      <label className="supplier-import-review-note">
        <span>Review note</span>
        <input value={candidate.reviewNote ?? ''} onChange={(event) => setCandidateNote(candidate.id, event.target.value)} placeholder="Why this needs review, supplier clarification, purchasing note…" />
      </label>

      <div className="supplier-import-variant-list">
        {(candidate.material.variants ?? []).map((variant) => {
          const variantDecision = candidate.variantDecisions?.[variant.id] ?? 'pending';
          return (
            <article className="supplier-import-variant" key={variant.id}>
              <header>
                <div><strong>{specLabel(variant)}</strong><span>{variant.sku || candidate.material.sku}</span></div>
                <ReviewSelect value={variantDecision} onChange={(decision) => setVariantDecision(candidate.id, variant.id, decision)} label={`Review ${specLabel(variant)}`} />
              </header>
              <div>
                {variant.purchaseOptions.map((option) => {
                  const evidence = candidate.priceEvidence?.[option.id];
                  const effective = materialPurchaseCostPerSf(variant, option);
                  const priceDecision = candidate.priceDecisions?.[option.id] ?? 'pending';
                  const provenance = evidence?.effectiveCostPerSf ?? (option.costPerSf !== undefined ? 'supplier-listed' : 'derived-from-listed-unit');
                  return (
                    <div className="supplier-import-program supplier-import-program-v2" key={option.id}>
                      <strong>{option.label}</strong>
                      <span>{option.minQuantity ? `${option.minQuantity}+` : 'Standard qty'}</span>
                      <span className="supplier-import-price-value">
                        {effective === undefined ? '—' : `${money.format(effective)}/SF`}
                        <small className={`supplier-import-provenance provenance-${provenance}`}>{provenance === 'supplier-listed' ? 'Supplier listed' : 'Derived from listed unit price'}</small>
                      </span>
                      <span className="supplier-import-price-value">
                        {option.costPerUnit === undefined ? '—' : `${money.format(option.costPerUnit)}/${option.pricingBasis.replace('-', ' ')}`}
                        {option.costPerUnit !== undefined && <small className="supplier-import-provenance provenance-supplier-listed">Supplier listed</small>}
                      </span>
                      <ReviewSelect value={priceDecision} onChange={(decision) => setPriceDecision(candidate.id, option.id, decision)} label={`Review ${option.label} price`} />
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SessionHistory({ currentId }: { currentId?: string }) {
  const history = useSupplierImportStore((state) => state.history);
  const openHistorySession = useSupplierImportStore((state) => state.openHistorySession);
  if (!history.length) return null;

  return (
    <details className="supplier-import-history">
      <summary>Import history · {history.length} session{history.length === 1 ? '' : 's'}</summary>
      <div className="supplier-import-history-list">
        {history.map((item) => {
          const counts = sessionReviewCounts(item);
          return (
            <div className="supplier-import-history-row" key={item.id}>
              <div>
                <strong>{item.source.brand} · {item.source.priceListLabel || item.source.fileName}</strong>
                <span>{new Date(item.createdAt).toLocaleString()} · {item.candidates.length} colors</span>
                <small>{counts.approved} approved · {counts.needsReview} needs review · {counts.ignored} ignored · {counts.pending} pending</small>
              </div>
              {currentId === item.id ? <span className="supplier-import-current-chip">Current</span> : <button type="button" onClick={() => openHistorySession(item.id)}>Open</button>}
            </div>
          );
        })}
      </div>
      <small className="supplier-import-history-note">Importer v2 keeps the five most recent review sessions in this browser while publishing remains disabled.</small>
    </details>
  );
}

function SupplierImportCenter({ onClose }: { onClose: () => void }) {
  const settings = useCompanySettingsStore((state) => state.settings);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const session = useSupplierImportStore((state) => state.session);
  const hydrated = useSupplierImportStore((state) => state.hydrated);
  const hydrate = useSupplierImportStore((state) => state.hydrate);
  const setSession = useSupplierImportStore((state) => state.setSession);
  const setEffectiveDate = useSupplierImportStore((state) => state.setEffectiveDate);
  const setCandidateDecision = useSupplierImportStore((state) => state.setCandidateDecision);
  const clearSession = useSupplierImportStore((state) => state.clearSession);
  const [file, setFile] = useState<File | null>(null);
  const [effectiveDateDraft, setEffectiveDateDraft] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    void hydrateSettings();
  }, [hydrate, hydrateSettings]);

  useEffect(() => {
    setEffectiveDateDraft(session?.source.effectiveDate ?? '');
  }, [session?.id, session?.source.effectiveDate]);

  const counts = useMemo(() => {
    const candidates = session?.candidates ?? [];
    return {
      all: candidates.length,
      new: candidates.filter((candidate) => candidate.status === 'new').length,
      changed: candidates.filter((candidate) => candidate.status === 'changed').length,
      unchanged: candidates.filter((candidate) => candidate.status === 'unchanged').length,
      duplicate: candidates.filter((candidate) => candidate.status === 'possible-duplicate').length,
      warnings: candidates.filter((candidate) => candidate.warnings.length).length,
    };
  }, [session]);

  const reviewCounts = useMemo(() => session ? sessionReviewCounts(session) : { pending: 0, approved: 0, needsReview: 0, ignored: 0 }, [session]);

  const visibleCandidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (session?.candidates ?? []).filter((candidate) => {
      if (filter === 'warnings' && !candidate.warnings.length) return false;
      if (filter !== 'all' && filter !== 'warnings' && candidate.status !== filter) return false;
      if (reviewFilter !== 'all' && reviewDecision(candidate) !== reviewFilter) return false;
      if (!needle) return true;
      const material = candidate.material;
      return `${material.name} ${material.sku ?? ''} ${material.supplierGroup ?? ''} ${candidate.status} ${candidate.changeSummary.join(' ')} ${candidate.reviewNote ?? ''}`.toLowerCase().includes(needle);
    });
  }, [session, filter, reviewFilter, query]);

  const parseFile = async () => {
    if (!file || parsing) return;
    setParsing(true);
    setError(null);
    try {
      const next = await stageVicostoneFabricatorPdf(file, settings.stockMaterials, effectiveDateDraft || undefined);
      setSession(next);
      setFilter('all');
      setReviewFilter('all');
      setQuery('');
      setExpandedId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The supplier sheet could not be staged.');
    } finally {
      setParsing(false);
    }
  };

  const reviewedCount = reviewCounts.approved + reviewCounts.needsReview + reviewCounts.ignored;

  return (
    <div className="supplier-import-overlay" role="dialog" aria-modal="true" aria-label="Supplier Import Center">
      <section className="supplier-import-center">
        <header className="supplier-import-header">
          <div>
            <span className="board-eyebrow">Management pricing pipeline</span>
            <h2>Supplier Import Center</h2>
            <p>Stage → normalize → compare → review. Supplier rules stay reference-only; only explicit sheet listings become staged specs.</p>
          </div>
          <div className="supplier-import-header-actions">
            <span className="supplier-import-review-badge">Importer v2 · review only</span>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </header>

        <div className="supplier-import-body">
          <section className="supplier-import-source-card">
            <div className="supplier-import-source-copy">
              <span className="board-eyebrow">Parser v2</span>
              <strong>Vicostone / UMI Fabricator PDF</strong>
              <p>Extracts only products, physical specs and prices explicitly listed in the sheet. Supplier special-order rules are preserved as purchasing reference notes and never generate hypothetical catalog options.</p>
            </div>
            <div className="supplier-import-file-controls">
              <label className="supplier-import-file-picker">
                <span>Supplier PDF</span>
                <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                <b>{file ? file.name : 'Choose PDF…'}</b>
              </label>
              <label className="supplier-import-effective-date">
                <span>Effective date <em>optional</em></span>
                <input type="date" value={effectiveDateDraft} onChange={(event) => {
                  setEffectiveDateDraft(event.target.value);
                  if (session) setEffectiveDate(event.target.value || undefined);
                }} />
              </label>
              <button type="button" className="supplier-import-stage-button" disabled={!file || parsing} onClick={() => void parseFile()}>{parsing ? 'Reading PDF…' : session ? 'Stage new file' : 'Stage for review'}</button>
            </div>
            {error && <div className="supplier-import-error">{error}</div>}
          </section>

          <SessionHistory currentId={session?.id} />

          {!hydrated ? <div className="supplier-import-empty">Opening staging area…</div> : !session ? (
            <section className="supplier-import-empty supplier-import-empty-state">
              <strong>No staged supplier sheet</strong>
              <span>Choose the Vicostone fabricator PDF above. SalesShop reads it locally and compares explicit supplier listings against the current Material Catalog.</span>
              <small>Nothing is written to the live catalog during Importer v2.</small>
            </section>
          ) : (
            <>
              <section className="supplier-import-session-summary">
                <div className="supplier-import-source-meta">
                  <strong>{session.source.brand} · {session.source.supplier}</strong>
                  <span>{session.source.fileName} · {formatBytes(session.source.fileSize)} · {session.source.pageCount} page{session.source.pageCount === 1 ? '' : 's'}</span>
                  <span>{session.source.priceListLabel || 'Price-list date not detected'}{session.source.effectiveDate ? ` · effective ${session.source.effectiveDate}` : ' · effective date not confirmed'}</span>
                </div>
                <div className="supplier-import-counts">
                  <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}><span>All</span><strong>{counts.all}</strong></button>
                  <button type="button" className={filter === 'new' ? 'active' : ''} onClick={() => setFilter('new')}><span>New</span><strong>{counts.new}</strong></button>
                  <button type="button" className={filter === 'changed' ? 'active' : ''} onClick={() => setFilter('changed')}><span>Changed</span><strong>{counts.changed}</strong></button>
                  <button type="button" className={filter === 'unchanged' ? 'active' : ''} onClick={() => setFilter('unchanged')}><span>Unchanged</span><strong>{counts.unchanged}</strong></button>
                  <button type="button" className={filter === 'possible-duplicate' ? 'active' : ''} onClick={() => setFilter('possible-duplicate')}><span>Duplicates</span><strong>{counts.duplicate}</strong></button>
                  <button type="button" className={filter === 'warnings' ? 'active' : ''} onClick={() => setFilter('warnings')}><span>Warnings</span><strong>{counts.warnings}</strong></button>
                </div>
                <div className="supplier-import-review-counts" aria-label="Review progress">
                  {(['pending', 'approved', 'needs-review', 'ignored'] as SupplierImportReviewDecision[]).map((decision) => {
                    const count = decision === 'needs-review' ? reviewCounts.needsReview : reviewCounts[decision];
                    return <button type="button" key={decision} className={reviewFilter === decision ? 'active' : ''} onClick={() => setReviewFilter((current) => current === decision ? 'all' : decision)}><span>{REVIEW_LABELS[decision]}</span><strong>{count}</strong></button>;
                  })}
                </div>
                <div className="supplier-import-session-actions">
                  <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staged colors, SKUs, changes, notes…" />
                  <button type="button" onClick={() => { if (window.confirm('Clear the current staged import? Its saved review session will remain in Import history.')) clearSession(); }}>Clear staging</button>
                </div>
              </section>

              {session.source.supplierRules.length > 0 && (
                <details className="supplier-import-rules">
                  <summary>{session.source.supplierRules.length} supplier notes / rules detected · reference only</summary>
                  <div className="supplier-import-rule-reference-note"><strong>Reference only</strong><span>These notes are shown to management and purchasing. They do not create unlisted finishes, thicknesses, SKUs, physical specs, or prices.</span></div>
                  <div>{session.source.supplierRules.map((rule) => <span key={rule}>{rule}</span>)}</div>
                </details>
              )}

              <section className="supplier-import-review-card">
                <header><div><strong>Staged comparison</strong><small>{visibleCandidates.length} of {session.candidates.length} colors shown · {reviewedCount} reviewed.</small></div><span>Parser {session.source.parserVersion} · explicit listings only</span></header>
                <div className="supplier-import-table-scroll">
                  <table className="supplier-import-table supplier-import-table-v2">
                    <thead><tr><th>Status</th><th>Review</th><th>Color</th><th>SKU</th><th>Supplier group</th><th>Physical specs</th><th>Price programs</th><th>Comparison</th><th>Confidence</th><th /></tr></thead>
                    <tbody>
                      {visibleCandidates.map((candidate) => {
                        const expanded = expandedId === candidate.id;
                        const decision = reviewDecision(candidate);
                        return (
                          <Fragment key={candidate.id}>
                            <tr className={`status-${candidate.status} review-${decision}`}>
                              <td><span className={`supplier-import-status status-${candidate.status}`}>{STATUS_LABELS[candidate.status]}</span>{candidate.warnings.length > 0 && <small className="supplier-import-warning-count">{candidate.warnings.length} warning{candidate.warnings.length === 1 ? '' : 's'}</small>}</td>
                              <td><ReviewSelect value={decision} onChange={(next) => setCandidateDecision(candidate.id, next)} label={`Review ${candidate.material.name}`} /></td>
                              <td><strong>{candidate.material.name}</strong><small>{candidate.material.brand} · {candidate.material.materialType}</small></td>
                              <td>{candidate.material.sku || '—'}</td>
                              <td>{candidate.material.supplierGroup || '—'}</td>
                              <td className="number">{candidate.material.variants?.length ?? 0}</td>
                              <td className="number">{programCount(candidate)}</td>
                              <td className="supplier-import-change-cell"><span>{candidate.changeSummary[0]}</span>{candidate.changeSummary.length > 1 && <small>+ {candidate.changeSummary.length - 1} more</small>}</td>
                              <td><span className={`supplier-import-confidence confidence-${candidate.confidence}`}>{candidate.confidence}</span></td>
                              <td><button type="button" onClick={() => setExpandedId((current) => current === candidate.id ? null : candidate.id)}>{expanded ? 'Close' : 'Details'}</button></td>
                            </tr>
                            {expanded && <tr className="supplier-import-detail-row"><td colSpan={10}><CandidateDetails candidate={candidate} /></td></tr>}
                          </Fragment>
                        );
                      })}
                      {!visibleCandidates.length && <tr><td colSpan={10}><div className="supplier-import-empty">No staged colors match this view.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>

              <footer className="supplier-import-publish-bar">
                <div><strong>Publish remains intentionally locked in Importer v2.</strong><span>{reviewedCount} of {session.candidates.length} colors reviewed · {reviewCounts.approved} approved · {reviewCounts.needsReview} needs review · {reviewCounts.ignored} ignored. v3 can turn approved explicit supplier data into a controlled catalog update.</span></div>
                <button type="button" disabled>Publish to Material Catalog</button>
              </footer>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export function SupplierImportLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="supplier-import-launcher" onClick={() => setOpen(true)} title="Open the management supplier-price staging area">Supplier imports</button>
      {open && <SupplierImportCenter onClose={() => setOpen(false)} />}
    </>
  );
}
