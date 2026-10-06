import { useEffect, useMemo, useState } from 'react';
import { stageVicostoneFabricatorPdf } from '../services/vicostoneSupplierImport';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useSupplierImportStore } from '../store/supplierImportStore';
import type { MaterialVariant } from '../types/settings';
import type { SupplierImportCandidate, SupplierImportStatus } from '../types/supplierImport';

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

function CandidateDetails({ candidate }: { candidate: SupplierImportCandidate }) {
  return (
    <div className="supplier-import-candidate-details">
      <div className="supplier-import-diff-panel">
        <div><strong>Comparison</strong>{candidate.changeSummary.map((change) => <span key={change}>{change}</span>)}</div>
        <div><strong>Import safety</strong><span>STOCK status, Level assignment, images, product URL and account pricing are management-owned and are not overwritten by supplier data.</span>{candidate.warnings.map((warning) => <span className="warning" key={warning}>{warning}</span>)}</div>
      </div>
      <div className="supplier-import-variant-list">
        {(candidate.material.variants ?? []).map((variant) => (
          <article className="supplier-import-variant" key={variant.id}>
            <header><strong>{specLabel(variant)}</strong><span>{variant.sku || candidate.material.sku}</span></header>
            <div>
              {variant.purchaseOptions.map((option) => (
                <div className="supplier-import-program" key={option.id}>
                  <strong>{option.label}</strong>
                  <span>{option.minQuantity ? `${option.minQuantity}+` : 'Standard qty'}</span>
                  <span>{option.costPerSf === undefined ? '—' : `${money.format(option.costPerSf)}/SF`}</span>
                  <span>{option.costPerUnit === undefined ? '—' : `${money.format(option.costPerUnit)}/${option.pricingBasis.replace('-', ' ')}`}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
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
  const clearSession = useSupplierImportStore((state) => state.clearSession);
  const [file, setFile] = useState<File | null>(null);
  const [effectiveDateDraft, setEffectiveDateDraft] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    void hydrateSettings();
  }, [hydrate, hydrateSettings]);

  useEffect(() => {
    if (session?.source.effectiveDate) setEffectiveDateDraft(session.source.effectiveDate);
  }, [session?.source.effectiveDate]);

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

  const visibleCandidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (session?.candidates ?? []).filter((candidate) => {
      if (filter === 'warnings' && !candidate.warnings.length) return false;
      if (filter !== 'all' && filter !== 'warnings' && candidate.status !== filter) return false;
      if (!needle) return true;
      const material = candidate.material;
      return `${material.name} ${material.sku ?? ''} ${material.supplierGroup ?? ''} ${candidate.status} ${candidate.changeSummary.join(' ')}`.toLowerCase().includes(needle);
    });
  }, [session, filter, query]);

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
            <p>Stage → normalize → compare → review. This pilot cannot publish into the live Material Catalog yet.</p>
          </div>
          <div className="supplier-import-header-actions">
            <span className="supplier-import-review-badge">Review only</span>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </header>

        <div className="supplier-import-body">
          <section className="supplier-import-source-card">
            <div className="supplier-import-source-copy">
              <span className="board-eyebrow">Parser v1</span>
              <strong>Vicostone / UMI Fabricator PDF</strong>
              <p>Tuned for the current Vicostone fabricator layout: groups, Super Jumbo/Jumbo/Regular slabs, 2cm/3cm, half slabs and 8+ bundle pricing.</p>
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

          {!hydrated ? <div className="supplier-import-empty">Opening staging area…</div> : !session ? (
            <section className="supplier-import-empty supplier-import-empty-state">
              <strong>No staged supplier sheet</strong>
              <span>Choose the Vicostone fabricator PDF above. SalesShop will read it locally in your browser and compare the proposed supplier catalog data against the current Material Catalog.</span>
              <small>Nothing is written to the live catalog during this pilot.</small>
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
                <div className="supplier-import-session-actions">
                  <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staged colors, SKUs, changes…" />
                  <button type="button" onClick={() => { if (window.confirm('Clear this staged import? The live Material Catalog will not be affected.')) clearSession(); }}>Clear staging</button>
                </div>
              </section>

              {session.source.supplierRules.length > 0 && (
                <details className="supplier-import-rules">
                  <summary>{session.source.supplierRules.length} supplier-level rule{session.source.supplierRules.length === 1 ? '' : 's'} detected</summary>
                  <div>{session.source.supplierRules.map((rule) => <span key={rule}>{rule}</span>)}</div>
                </details>
              )}

              <section className="supplier-import-review-card">
                <header><div><strong>Staged comparison</strong><small>{visibleCandidates.length} of {session.candidates.length} colors shown · STOCK selection and Level assignments remain untouched.</small></div><span>Parser {session.source.parserVersion} · {session.source.parserId}</span></header>
                <div className="supplier-import-table-scroll">
                  <table className="supplier-import-table">
                    <thead><tr><th>Status</th><th>Color</th><th>SKU</th><th>Supplier group</th><th>Physical specs</th><th>Price programs</th><th>Comparison</th><th>Confidence</th><th /></tr></thead>
                    <tbody>
                      {visibleCandidates.map((candidate) => {
                        const expanded = expandedId === candidate.id;
                        return (
                          <>
                            <tr className={`status-${candidate.status}`} key={candidate.id}>
                              <td><span className={`supplier-import-status status-${candidate.status}`}>{STATUS_LABELS[candidate.status]}</span>{candidate.warnings.length > 0 && <small className="supplier-import-warning-count">{candidate.warnings.length} warning{candidate.warnings.length === 1 ? '' : 's'}</small>}</td>
                              <td><strong>{candidate.material.name}</strong><small>{candidate.material.brand} · {candidate.material.materialType}</small></td>
                              <td>{candidate.material.sku || '—'}</td>
                              <td>{candidate.material.supplierGroup || '—'}</td>
                              <td className="number">{candidate.material.variants?.length ?? 0}</td>
                              <td className="number">{programCount(candidate)}</td>
                              <td className="supplier-import-change-cell"><span>{candidate.changeSummary[0]}</span>{candidate.changeSummary.length > 1 && <small>+ {candidate.changeSummary.length - 1} more</small>}</td>
                              <td><span className={`supplier-import-confidence confidence-${candidate.confidence}`}>{candidate.confidence}</span></td>
                              <td><button type="button" onClick={() => setExpandedId((current) => current === candidate.id ? null : candidate.id)}>{expanded ? 'Close' : 'Details'}</button></td>
                            </tr>
                            {expanded && <tr className="supplier-import-detail-row" key={`${candidate.id}-details`}><td colSpan={9}><CandidateDetails candidate={candidate} /></td></tr>}
                          </>
                        );
                      })}
                      {!visibleCandidates.length && <tr><td colSpan={9}><div className="supplier-import-empty">No staged colors match this view.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>

              <footer className="supplier-import-publish-bar">
                <div><strong>Publish is intentionally locked in Importer v1.</strong><span>Use this batch to validate parsing, product grouping, slab specs and price comparisons. The next batch can add an approval step once the staged data looks trustworthy.</span></div>
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
