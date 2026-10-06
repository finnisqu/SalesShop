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

const STATUS_LABELS: Record<SupplierImportStatus, string> = {
  new: 'New',
  changed: 'Changed',
  unchanged: 'Unchanged',
  'possible-duplicate': 'Possible duplicate',
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

function reviewDecision(candidate: SupplierImportCandidate): SupplierImportReviewDecision {
  return candidate.reviewDecision === 'ignored' || candidate.reviewDecision === 'needs-review' ? candidate.reviewDecision : 'approved';
}

function sessionReadiness(session: SupplierImportSession) {
  return {
    ready: session.candidates.filter((candidate) => reviewDecision(candidate) === 'approved').length,
    attention: session.candidates.filter((candidate) => reviewDecision(candidate) === 'needs-review').length,
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
  const normalized = value === 'pending' ? 'needs-review' : value;
  return (
    <select className={`supplier-import-review-select review-${normalized}`} value={normalized} onChange={(event) => onChange(event.target.value as SupplierImportReviewDecision)} aria-label={label}>
      <option value="approved">Ready</option>
      <option value="needs-review">Needs attention</option>
      <option value="ignored">Ignore</option>
    </select>
  );
}

function AdvancedReview({ candidate }: { candidate: SupplierImportCandidate }) {
  const setVariantDecision = useSupplierImportStore((state) => state.setVariantDecision);
  const setPriceDecision = useSupplierImportStore((state) => state.setPriceDecision);

  return (
    <details className="supplier-import-advanced-review">
      <summary>Advanced spec / price review</summary>
      <div className="supplier-import-advanced-review-list">
        {(candidate.material.variants ?? []).map((variant) => (
          <section key={variant.id}>
            <header>
              <div><strong>{specLabel(variant)}</strong><span>{variant.sku || candidate.material.sku}</span></div>
              <ReviewSelect value={candidate.variantDecisions?.[variant.id] ?? 'approved'} onChange={(decision) => setVariantDecision(candidate.id, variant.id, decision)} label={`Review ${specLabel(variant)}`} />
            </header>
            {variant.purchaseOptions.map((option) => (
              <div className="supplier-import-advanced-program" key={option.id}>
                <span>{option.label}</span>
                <ReviewSelect value={candidate.priceDecisions?.[option.id] ?? 'approved'} onChange={(decision) => setPriceDecision(candidate.id, option.id, decision)} label={`Review ${option.label} price`} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </details>
  );
}

function CandidateDetails({ candidate, reviewMode }: { candidate: SupplierImportCandidate; reviewMode: boolean }) {
  const setCandidateNote = useSupplierImportStore((state) => state.setCandidateNote);
  const reasons = candidate.attentionReasons ?? candidate.warnings;

  return (
    <div className="supplier-import-candidate-details">
      <div className="supplier-import-diff-panel">
        <div><strong>Comparison</strong>{candidate.changeSummary.map((change) => <span key={change}>{change}</span>)}</div>
        <div>
          <strong>{reviewDecision(candidate) === 'needs-review' ? 'Why SalesShop stopped here' : 'Import safety'}</strong>
          {reviewDecision(candidate) === 'needs-review'
            ? reasons.map((reason) => <span className="warning" key={reason}>{reason}</span>)
            : <span>STOCK status, Level assignment, images, product URL and account pricing are management-owned and are not overwritten by supplier data.</span>}
        </div>
      </div>

      {(reviewMode || candidate.reviewNote) && (
        <label className="supplier-import-review-note">
          <span>Review note</span>
          <input value={candidate.reviewNote ?? ''} onChange={(event) => setCandidateNote(candidate.id, event.target.value)} placeholder="Optional purchasing / review note…" />
        </label>
      )}

      <div className="supplier-import-variant-list">
        {(candidate.material.variants ?? []).map((variant) => (
          <article className="supplier-import-variant" key={variant.id}>
            <header><div><strong>{specLabel(variant)}</strong><span>{variant.sku || candidate.material.sku}</span></div></header>
            <div>
              {variant.purchaseOptions.map((option) => {
                const evidence = candidate.priceEvidence?.[option.id];
                const effective = materialPurchaseCostPerSf(variant, option);
                const provenance = evidence?.effectiveCostPerSf ?? (option.costPerSf !== undefined ? 'supplier-listed' : 'derived-from-listed-unit');
                return (
                  <div className="supplier-import-program supplier-import-program-clean" key={option.id}>
                    <strong>{option.label}</strong>
                    <span>{option.minQuantity ? `${option.minQuantity}+` : 'Standard qty'}</span>
                    <span className="supplier-import-price-value">
                      {effective === undefined ? '—' : `${money.format(effective)}/SF`}
                      <small className="supplier-import-source-note">{provenance === 'supplier-listed' ? 'listed' : 'derived from listed unit price'}</small>
                    </span>
                    <span className="supplier-import-price-value">
                      {option.costPerUnit === undefined ? '—' : `${money.format(option.costPerUnit)}/${option.pricingBasis.replace('-', ' ')}`}
                      {option.costPerUnit !== undefined && <small className="supplier-import-source-note">listed</small>}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      {reviewMode && <AdvancedReview candidate={candidate} />}
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
          const counts = sessionReadiness(item);
          return (
            <div className="supplier-import-history-row" key={item.id}>
              <div>
                <strong>{item.source.brand} · {item.source.priceListLabel || item.source.fileName}</strong>
                <span>{new Date(item.createdAt).toLocaleString()} · {item.candidates.length} colors</span>
                <small>{counts.ready} ready · {counts.attention} need attention · {counts.ignored} ignored</small>
              </div>
              {currentId === item.id ? <span className="supplier-import-current-chip">Current</span> : <button type="button" onClick={() => openHistorySession(item.id)}>Open</button>}
            </div>
          );
        })}
      </div>
      <small className="supplier-import-history-note">The five most recent review sessions are kept in this browser while publishing remains disabled.</small>
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
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => {
    hydrate();
    void hydrateSettings();
  }, [hydrate, hydrateSettings]);

  useEffect(() => {
    setEffectiveDateDraft(session?.source.effectiveDate ?? '');
    setReviewMode(false);
    setExpandedId(null);
  }, [session?.id, session?.source.effectiveDate]);

  const counts = useMemo(() => {
    const candidates = session?.candidates ?? [];
    return {
      all: candidates.length,
      new: candidates.filter((candidate) => candidate.status === 'new').length,
      changed: candidates.filter((candidate) => candidate.status === 'changed').length,
      unchanged: candidates.filter((candidate) => candidate.status === 'unchanged').length,
      duplicate: candidates.filter((candidate) => candidate.status === 'possible-duplicate').length,
      warnings: candidates.filter((candidate) => (candidate.attentionReasons?.length ?? candidate.warnings.length) > 0).length,
    };
  }, [session]);

  const readiness = useMemo(() => session ? sessionReadiness(session) : { ready: 0, attention: 0, ignored: 0 }, [session]);

  const visibleCandidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (session?.candidates ?? []).filter((candidate) => {
      if (reviewMode && reviewDecision(candidate) !== 'needs-review') return false;
      if (filter === 'warnings' && !(candidate.attentionReasons?.length ?? candidate.warnings.length)) return false;
      if (filter !== 'all' && filter !== 'warnings' && candidate.status !== filter) return false;
      if (!needle) return true;
      const material = candidate.material;
      return `${material.name} ${material.sku ?? ''} ${material.supplierGroup ?? ''} ${candidate.status} ${candidate.changeSummary.join(' ')} ${candidate.reviewNote ?? ''}`.toLowerCase().includes(needle);
    });
  }, [session, filter, query, reviewMode]);

  const parseFile = async () => {
    if (!file || parsing) return;
    setParsing(true);
    setError(null);
    try {
      const next = await stageVicostoneFabricatorPdf(file, settings.stockMaterials, effectiveDateDraft || undefined);
      setSession(next);
      setFilter('all');
      setQuery('');
      setExpandedId(null);
      setReviewMode(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The supplier sheet could not be staged.');
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="supplier-import-overlay" role="dialog" aria-modal="true" aria-label="Supplier Import Center">
      <section className="supplier-import-center">
        <header className="supplier-import-header">
          <div>
            <span className="board-eyebrow">Management pricing pipeline</span>
            <h2>Supplier Import Center</h2>
            <p>Clean supplier data is ready automatically. Management is interrupted only when SalesShop sees something that deserves judgment.</p>
          </div>
          <div className="supplier-import-header-actions">
            <span className="supplier-import-review-badge">Importer v2.1 · review by exception</span>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </header>

        <div className="supplier-import-body">
          <section className="supplier-import-source-card">
            <div className="supplier-import-source-copy">
              <span className="board-eyebrow">Parser v2</span>
              <strong>Vicostone / UMI Fabricator PDF</strong>
              <p>Only explicit products, physical specs and prices are staged. Supplier special-order rules remain reference notes and never generate hypothetical catalog options.</p>
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
              <span>Choose the Vicostone fabricator PDF above. SalesShop will read it locally and compare explicit supplier listings against the current Material Catalog.</span>
              <small>Nothing is written to the live catalog during Importer v2.1.</small>
            </section>
          ) : (
            <>
              <section className="supplier-import-session-summary">
                <div className="supplier-import-source-meta">
                  <strong>{session.source.brand} · {session.source.supplier}</strong>
                  <span>{session.source.fileName} · {formatBytes(session.source.fileSize)} · {session.source.pageCount} page{session.source.pageCount === 1 ? '' : 's'}</span>
                  <span>{session.source.priceListLabel || 'Price-list date not detected'}{session.source.effectiveDate ? ` · effective ${session.source.effectiveDate}` : ' · effective date not confirmed'}</span>
                </div>
                <div className="supplier-import-counts supplier-import-change-counts">
                  <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}><span>All</span><strong>{counts.all}</strong></button>
                  <button type="button" className={filter === 'new' ? 'active' : ''} onClick={() => setFilter('new')}><span>New</span><strong>{counts.new}</strong></button>
                  <button type="button" className={filter === 'changed' ? 'active' : ''} onClick={() => setFilter('changed')}><span>Changed</span><strong>{counts.changed}</strong></button>
                  <button type="button" className={filter === 'unchanged' ? 'active' : ''} onClick={() => setFilter('unchanged')}><span>Unchanged</span><strong>{counts.unchanged}</strong></button>
                  <button type="button" className={filter === 'possible-duplicate' ? 'active' : ''} onClick={() => setFilter('possible-duplicate')}><span>Duplicates</span><strong>{counts.duplicate}</strong></button>
                </div>
                <div className="supplier-import-session-actions">
                  <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staged colors, SKUs, changes…" />
                  <button type="button" onClick={() => { if (window.confirm('Clear the current staged import? Its saved review session will remain in Import history.')) clearSession(); }}>Clear staging</button>
                </div>
              </section>

              <section className={`supplier-import-readiness ${readiness.attention ? 'has-attention' : 'is-clear'}`}>
                <div className="supplier-import-readiness-summary">
                  <strong>{readiness.ready} ready automatically</strong>
                  <span>{readiness.attention ? `${readiness.attention} need management attention` : 'No exceptions need management review'}</span>
                  {readiness.ignored > 0 && <span>{readiness.ignored} ignored</span>}
                </div>
                {reviewMode ? (
                  <button type="button" onClick={() => { setReviewMode(false); setExpandedId(null); }}>Exit issue review</button>
                ) : readiness.attention > 0 ? (
                  <button type="button" className="primary" onClick={() => { setReviewMode(true); setFilter('all'); setExpandedId(null); }}>Review {readiness.attention} issue{readiness.attention === 1 ? '' : 's'}</button>
                ) : (
                  <span className="supplier-import-ready-mark">✓ Ready for controlled publishing</span>
                )}
              </section>

              {reviewMode && (
                <section className="supplier-import-review-mode-banner">
                  <div><strong>Exception review</strong><span>Only records that need judgment are shown. Mark one Ready or Ignore it; resolved records leave this view.</span></div>
                  <span>{readiness.attention} remaining</span>
                </section>
              )}

              {session.source.supplierRules.length > 0 && (
                <details className="supplier-import-rules">
                  <summary>{session.source.supplierRules.length} supplier notes / rules detected · reference only</summary>
                  <div className="supplier-import-rule-reference-note"><strong>Reference only</strong><span>These notes never create unlisted finishes, thicknesses, SKUs, physical specs, or prices.</span></div>
                  <div>{session.source.supplierRules.map((rule) => <span key={rule}>{rule}</span>)}</div>
                </details>
              )}

              <section className="supplier-import-review-card">
                <header>
                  <div><strong>{reviewMode ? 'Items needing attention' : 'Staged comparison'}</strong><small>{visibleCandidates.length} of {session.candidates.length} colors shown · STOCK selection and Level assignments remain untouched.</small></div>
                  <span>Parser {session.source.parserVersion} · explicit listings only</span>
                </header>
                <div className="supplier-import-table-scroll">
                  <table className="supplier-import-table supplier-import-table-v21">
                    <thead><tr><th>Status</th><th>Color</th><th>SKU</th><th>Supplier group</th><th>Physical specs</th><th>Price programs</th><th>Comparison</th><th>Confidence</th><th>{reviewMode ? 'Resolve' : ''}</th></tr></thead>
                    <tbody>
                      {visibleCandidates.map((candidate) => {
                        const expanded = expandedId === candidate.id;
                        const decision = reviewDecision(candidate);
                        return (
                          <Fragment key={candidate.id}>
                            <tr className={`status-${candidate.status} review-${decision}`}>
                              <td>
                                <span className={`supplier-import-status status-${candidate.status}`}>{STATUS_LABELS[candidate.status]}</span>
                                {decision === 'needs-review' && <small className="supplier-import-attention-flag">Needs attention</small>}
                                {decision === 'ignored' && <small className="supplier-import-ignored-flag">Ignored</small>}
                              </td>
                              <td><strong>{candidate.material.name}</strong><small>{candidate.material.brand} · {candidate.material.materialType}</small></td>
                              <td>{candidate.material.sku || '—'}</td>
                              <td>{candidate.material.supplierGroup || '—'}</td>
                              <td className="number">{candidate.material.variants?.length ?? 0}</td>
                              <td className="number">{programCount(candidate)}</td>
                              <td className="supplier-import-change-cell"><span>{candidate.changeSummary[0]}</span>{candidate.changeSummary.length > 1 && <small>+ {candidate.changeSummary.length - 1} more</small>}</td>
                              <td><span className={`supplier-import-confidence confidence-${candidate.confidence}`}>{candidate.confidence}</span></td>
                              <td className="supplier-import-row-actions">
                                {reviewMode && <>
                                  <button type="button" className="ready" onClick={() => setCandidateDecision(candidate.id, 'approved')}>Mark ready</button>
                                  <button type="button" onClick={() => setCandidateDecision(candidate.id, 'ignored')}>Ignore</button>
                                </>}
                                <button type="button" onClick={() => setExpandedId((current) => current === candidate.id ? null : candidate.id)}>{expanded ? 'Close' : 'Details'}</button>
                              </td>
                            </tr>
                            {expanded && <tr className="supplier-import-detail-row"><td colSpan={9}><CandidateDetails candidate={candidate} reviewMode={reviewMode} /></td></tr>}
                          </Fragment>
                        );
                      })}
                      {!visibleCandidates.length && <tr><td colSpan={9}><div className="supplier-import-empty">{reviewMode ? 'All flagged items are resolved.' : 'No staged colors match this view.'}</div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>

              <footer className="supplier-import-publish-bar">
                <div>
                  <strong>Publish remains locked while we validate review-by-exception.</strong>
                  <span>{readiness.ready} ready · {readiness.attention} need attention · {readiness.ignored} ignored. The next publishing batch can operate on Ready records without asking management to approve clean data one row at a time.</span>
                </div>
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
