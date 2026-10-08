import { useEffect, useMemo, useState } from 'react';
import {
  SINK_CATEGORIES,
  SINK_CATEGORY_LABELS,
  SINK_CONFIGURATIONS,
  SINK_CONFIGURATION_LABELS,
  type SinkCategory,
  type SinkModel,
  type SinkMountType,
  type SinkVariant,
} from '../types/sink';
import { useSinkCatalogStore } from '../store/sinkCatalogStore';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const MOUNT_TYPES: Array<[SinkMountType, string]> = [
  ['undermount', 'Undermount'],
  ['drop-in', 'Drop-in'],
  ['apron-front', 'Apron front'],
  ['vessel', 'Vessel'],
  ['other', 'Other'],
];

function numberValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function priceLabel(value?: number) {
  return value === undefined ? 'Unpriced' : money.format(value);
}

function variantSubtitle(variant: SinkVariant) {
  return [
    SINK_CONFIGURATION_LABELS[variant.configuration],
    variant.ada ? 'ADA' : '',
    variant.code,
  ].filter(Boolean).join(' · ');
}

export function SinksWorkspace({ embedded = false }: { embedded?: boolean } = {}) {
  const models = useSinkCatalogStore((state) => state.models);
  const hydrated = useSinkCatalogStore((state) => state.hydrated);
  const saving = useSinkCatalogStore((state) => state.saving);
  const error = useSinkCatalogStore((state) => state.error);
  const hydrate = useSinkCatalogStore((state) => state.hydrate);
  const addModel = useSinkCatalogStore((state) => state.addModel);
  const updateModel = useSinkCatalogStore((state) => state.updateModel);
  const addVariant = useSinkCatalogStore((state) => state.addVariant);
  const updateVariant = useSinkCatalogStore((state) => state.updateVariant);
  const duplicateVariant = useSinkCatalogStore((state) => state.duplicateVariant);
  const deleteVariant = useSinkCatalogStore((state) => state.deleteVariant);

  const [editing, setEditing] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [expandedMobileSinkId, setExpandedMobileSinkId] = useState<string | null>(null);
  const [isMobileCatalog, setIsMobileCatalog] = useState(
    () => embedded && typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | SinkCategory>('all');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => { void hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!embedded) return;
    const media = window.matchMedia('(max-width: 700px)');
    const update = () => setIsMobileCatalog(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [embedded]);

  useEffect(() => {
    if (!models.length) return;
    if (!selectedId || !models.some((model) => model.id === selectedId)) {
      setSelectedId(models.find((model) => model.active)?.id ?? models[0].id);
    }
  }, [models, selectedId]);

  const visibleModels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models
      .filter((model) => showInactive || model.active)
      .filter((model) => category === 'all' || model.category === category)
      .filter((model) => {
        if (!needle) return true;
        const text = [
          model.name,
          model.modelCode,
          model.brand,
          model.supplier,
          SINK_CATEGORY_LABELS[model.category],
          ...model.variants.flatMap((variant) => [variant.label, variant.code, SINK_CONFIGURATION_LABELS[variant.configuration], variant.ada ? 'ada' : '']),
        ].filter(Boolean).join(' ').toLowerCase();
        return text.includes(needle);
      })
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  }, [models, category, query, showInactive]);

  const selected = visibleModels.find((model) => model.id === selectedId) ?? visibleModels[0] ?? null;
  const activeModels = models.filter((model) => model.active);
  const activeVariants = activeModels.flatMap((model) => model.variants.filter((variant) => variant.active));
  const pricedVariants = activeVariants.filter((variant) => variant.sellPrice !== undefined);
  const multiVariantModels = activeModels.filter((model) => model.variants.filter((variant) => variant.active).length > 1);

  const createModel = () => {
    const id = addModel(category === 'all' ? 'kitchen' : category);
    setSelectedId(id);
    setExpandedMobileSinkId(id);
    setEditing(true);
    setMobileToolsOpen(false);
  };

  // One model renderer is reused by the desktop detail pane and mobile inline cards.
  const renderSinkDetail = (selected: SinkModel | null) => (
        <section className="sinks-detail">
          {!selected ? (
            <div className="sinks-empty-detail"><strong>No sink model selected</strong><span>Add a model to start the catalog.</span></div>
          ) : (
            <>
              <header className="sinks-model-header">
                <div>
                  <span>{SINK_CATEGORY_LABELS[selected.category]} sink model</span>
                  <h2>{selected.name}</h2>
                  <p>{selected.variants.filter((variant) => variant.active).length} active variant{selected.variants.filter((variant) => variant.active).length === 1 ? '' : 's'} · {selected.widthIn && selected.depthIn ? `${selected.widthIn} × ${selected.depthIn} in` : selected.modelCode || 'Dimensions not set'}</p>
                </div>
                {editing && <label className="sinks-active-toggle"><input type="checkbox" checked={selected.active} onChange={(event) => updateModel(selected.id, { active: event.target.checked })} /> Active model</label>}
              </header>

              {editing ? (
                <section className="sinks-model-fields">
                  <label><span>Model name</span><input value={selected.name} onChange={(event) => updateModel(selected.id, { name: event.target.value })} /></label>
                  <label><span>Model code</span><input value={selected.modelCode ?? ''} onChange={(event) => updateModel(selected.id, { modelCode: event.target.value || undefined })} /></label>
                  <label><span>Category</span><select value={selected.category} onChange={(event) => updateModel(selected.id, { category: event.target.value as SinkCategory })}>{SINK_CATEGORIES.map((item) => <option value={item} key={item}>{SINK_CATEGORY_LABELS[item]}</option>)}</select></label>
                  <label><span>Mount</span><select value={selected.mountType ?? ''} onChange={(event) => updateModel(selected.id, { mountType: (event.target.value || undefined) as SinkMountType | undefined })}><option value="">—</option>{MOUNT_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                  <label><span>Width (in)</span><input type="number" step="0.125" value={selected.widthIn ?? ''} onChange={(event) => updateModel(selected.id, { widthIn: numberValue(event.target.value) })} /></label>
                  <label><span>Depth (in)</span><input type="number" step="0.125" value={selected.depthIn ?? ''} onChange={(event) => updateModel(selected.id, { depthIn: numberValue(event.target.value) })} /></label>
                  <label><span>Brand</span><input value={selected.brand ?? ''} onChange={(event) => updateModel(selected.id, { brand: event.target.value || undefined })} /></label>
                  <label><span>Supplier</span><input value={selected.supplier ?? ''} onChange={(event) => updateModel(selected.id, { supplier: event.target.value || undefined })} /></label>
                  <label><span>Material</span><input value={selected.material ?? ''} onChange={(event) => updateModel(selected.id, { material: event.target.value || undefined })} placeholder="e.g. 18ga stainless" /></label>
                  <label className="wide"><span>Private notes</span><input value={selected.notes ?? ''} onChange={(event) => updateModel(selected.id, { notes: event.target.value || undefined })} /></label>
                </section>
              ) : (
                <section className="sinks-model-reference">
                  {selected.modelCode && <div><span>Model</span><strong>{selected.modelCode}</strong></div>}
                  {selected.mountType && <div><span>Mount</span><strong>{MOUNT_TYPES.find(([value]) => value === selected.mountType)?.[1] ?? selected.mountType}</strong></div>}
                  {selected.brand && <div><span>Brand</span><strong>{selected.brand}</strong></div>}
                  {selected.supplier && <div><span>Supplier</span><strong>{selected.supplier}</strong></div>}
                  {selected.material && <div><span>Material</span><strong>{selected.material}</strong></div>}
                  {selected.notes && <div className="wide"><span>Notes</span><strong>{selected.notes}</strong></div>}
                </section>
              )}

              <section className="sinks-variants-section">
                <header>
                  <div><strong>Variants</strong><small>One model can carry a single sellable version or many configurations.</small></div>
                  {editing && <button type="button" onClick={() => addVariant(selected.id)}>+ Variant</button>}
                </header>

                <div className="sinks-variant-list">
                  {selected.variants.map((variant) => (
                    <article className={`sinks-variant-card ${variant.active ? '' : 'is-inactive'} ${variant.default ? 'is-default' : ''}`} key={variant.id}>
                      <header>
                        <div>
                          <strong>{variant.label}</strong>
                          <small>{variantSubtitle(variant)}</small>
                        </div>
                        <div className="sinks-variant-badges">
                          {variant.default && <span>Default</span>}
                          {variant.ada && <span>ADA</span>}
                          {!variant.active && <span>Archived</span>}
                        </div>
                      </header>

                      {editing ? (
                        <>
                          <div className="sinks-variant-editor">
                            <label><span>Variant</span><input value={variant.label} onChange={(event) => updateVariant(selected.id, variant.id, { label: event.target.value })} /></label>
                            <label><span>Configuration</span><select value={variant.configuration} onChange={(event) => updateVariant(selected.id, variant.id, { configuration: event.target.value as SinkVariant['configuration'] })}>{SINK_CONFIGURATIONS.map((item) => <option value={item} key={item}>{SINK_CONFIGURATION_LABELS[item]}</option>)}</select></label>
                            <label><span>Code / SKU</span><input value={variant.code ?? ''} onChange={(event) => updateVariant(selected.id, variant.id, { code: event.target.value || undefined })} /></label>
                            <label><span>Internal cost</span><span className="sinks-money-input"><b>$</b><input type="number" min="0" step="0.01" value={variant.internalCost ?? ''} onChange={(event) => updateVariant(selected.id, variant.id, { internalCost: numberValue(event.target.value) })} /></span></label>
                            <label><span>Customer price</span><span className="sinks-money-input"><b>$</b><input type="number" min="0" step="0.01" value={variant.sellPrice ?? ''} onChange={(event) => updateVariant(selected.id, variant.id, { sellPrice: numberValue(event.target.value) })} /></span></label>
                            <label><span>Effective</span><input type="date" value={variant.effectiveDate ?? ''} onChange={(event) => updateVariant(selected.id, variant.id, { effectiveDate: event.target.value || undefined })} /></label>
                          </div>
                          <div className="sinks-variant-flags">
                            <label><input type="checkbox" checked={variant.ada} onChange={(event) => updateVariant(selected.id, variant.id, { ada: event.target.checked })} /> ADA</label>
                            <label><input type="checkbox" checked={variant.default} onChange={(event) => updateVariant(selected.id, variant.id, { default: event.target.checked })} disabled={variant.default} /> Default</label>
                            <label><input type="checkbox" checked={variant.active} onChange={(event) => updateVariant(selected.id, variant.id, { active: event.target.checked })} /> Active</label>
                            <input className="sinks-variant-notes" value={variant.notes ?? ''} onChange={(event) => updateVariant(selected.id, variant.id, { notes: event.target.value || undefined })} placeholder="Private variant note…" />
                            <button type="button" onClick={() => duplicateVariant(selected.id, variant.id)}>Duplicate</button>
                            <button type="button" className="danger" disabled={selected.variants.length <= 1} onClick={() => {
                              if (selected.variants.length > 1 && window.confirm(`Delete ${variant.label}? Historical quote snapshots will remain frozen.`)) deleteVariant(selected.id, variant.id);
                            }}>Delete</button>
                          </div>
                        </>
                      ) : (
                        <div className="sinks-variant-reference">
                          <div><span>Customer price</span><strong className={variant.sellPrice === undefined ? 'is-unpriced' : ''}>{priceLabel(variant.sellPrice)}</strong></div>
                          <div><span>Internal cost</span><strong>{variant.internalCost === undefined ? '—' : money.format(variant.internalCost)}</strong></div>
                          <div><span>Margin</span><strong>{variant.sellPrice !== undefined && variant.internalCost !== undefined && variant.sellPrice > 0 ? `${(((variant.sellPrice - variant.internalCost) / variant.sellPrice) * 100).toFixed(1)}%` : '—'}</strong></div>
                          <div><span>Effective</span><strong>{variant.effectiveDate || '—'}</strong></div>
                          {variant.history.length > 1 && <div><span>Price versions</span><strong>{variant.history.length}</strong></div>}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </section>
  );

  if (!hydrated) return <div className="sinks-loading">Opening Sinks…</div>;

  return (
    <main className={`sinks-workspace ${embedded ? 'is-catalog-embedded' : ''} ${editing ? 'is-editing' : 'is-reference'}`}>
      <header className="sinks-workspace-header">
        <div>
          <span className="board-eyebrow">Product catalog</span>
          <h1>Sinks</h1>
          <p>Physical sink products live here. Sink cutouts and customer-provided sink installation stay in Rates as services.</p>
        </div>
        <div className="sinks-header-actions">
          <span className={`sinks-save-status ${error ? 'has-error' : ''}`}>{error ? 'Cloud issue' : saving ? 'Saving…' : 'Saved'}</span>
          {editing && <button type="button" className="sinks-add-model" onClick={createModel}>+ Sink model</button>}
          <button type="button" className={editing ? 'sinks-done-button' : 'sinks-edit-button'} onClick={() => setEditing((value) => !value)}>
            {editing ? 'Done editing' : 'Edit catalog'}
          </button>
        </div>
      </header>

      <section className="sinks-stats" aria-label="Sink catalog summary">
        <div><span>Active models</span><strong>{activeModels.length}</strong></div>
        <div><span>Active variants</span><strong>{activeVariants.length}</strong></div>
        <div><span>Priced variants</span><strong>{pricedVariants.length}/{activeVariants.length}</strong></div>
        <div><span>Multi-variant models</span><strong>{multiVariantModels.length}</strong></div>
      </section>

      <section className="sinks-shared-controls">
        <div className="sinks-category-tabs" role="tablist" aria-label="Sink categories">
          <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All Sinks</button>
          {SINK_CATEGORIES.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{SINK_CATEGORY_LABELS[item]}</button>)}
        </div>
        <div className="sinks-search-tools">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models, variants, codes…" aria-label="Search sink catalog" />
          <label className="sinks-archived-toggle"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Archived</label>
          <button type="button" className="sinks-mobile-tools-trigger" onClick={() => setMobileToolsOpen(true)} aria-label="Open sink catalog tools">••• <span>Tools</span></button>
        </div>
      </section>

      {mobileToolsOpen && (
        <div className="sinks-mobile-tools-backdrop" onPointerDown={() => setMobileToolsOpen(false)}>
          <aside className="sinks-mobile-tools-sheet" role="dialog" aria-modal="true" aria-label="Sink catalog tools" onPointerDown={(event) => event.stopPropagation()}>
            <header>
              <div><span>Catalog · Sinks</span><strong>Sink tools</strong><small>Browse by default; open maintenance only when needed.</small></div>
              <button type="button" onClick={() => setMobileToolsOpen(false)} aria-label="Close sink tools">×</button>
            </header>
            <section>
              <span className="sinks-mobile-tools-label">Mode</span>
              <div className="sinks-mobile-mode-row">
                <button type="button" className={!editing ? 'active' : ''} onClick={() => { setEditing(false); setMobileToolsOpen(false); }}><strong>Reference</strong><small>Look up models and pricing</small></button>
                <button type="button" className={editing ? 'active' : ''} onClick={() => { setEditing(true); setMobileToolsOpen(false); }}><strong>Edit catalog</strong><small>Maintain models and variants</small></button>
              </div>
            </section>
            <section>
              <span className="sinks-mobile-tools-label">Catalog visibility</span>
              <label className="sinks-mobile-archived"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /><span>Show archived models</span></label>
            </section>
            {editing && <section>
              <span className="sinks-mobile-tools-label">Maintenance</span>
              <button type="button" className="sinks-mobile-add-model" onClick={createModel}>+ Add sink model</button>
              <small>Choose a model to edit its details, variants, prices and history.</small>
            </section>}
            <footer className={error ? 'has-error' : ''}>{error ? 'Cloud sync issue' : saving ? 'Saving changes…' : 'Changes saved'}</footer>
          </aside>
        </div>
      )}

      <div className="sinks-catalog-shell">
        <aside className="sinks-navigator">
          <header><strong>Models</strong><span>{visibleModels.length}</span></header>
          <div className="sinks-model-list">
            {visibleModels.map((model) => {
              const variants = model.variants.filter((variant) => variant.active);
              const prices = variants.map((variant) => variant.sellPrice).filter((value): value is number => value !== undefined);
              const low = prices.length ? Math.min(...prices) : undefined;
              const high = prices.length ? Math.max(...prices) : undefined;
              return (
                <button type="button" key={model.id} className={selected?.id === model.id ? 'active' : ''} aria-expanded={isMobileCatalog ? expandedMobileSinkId === model.id : undefined} onClick={() => {
                  setSelectedId(model.id);
                  if (isMobileCatalog) setExpandedMobileSinkId((current) => current === model.id ? null : model.id);
                }}>
                  <span className="sinks-model-list-main"><strong>{model.name}</strong><small>{model.modelCode || SINK_CATEGORY_LABELS[model.category]}</small></span>
                  <span className="sinks-model-list-meta">
                    <b>{variants.length} variant{variants.length === 1 ? '' : 's'}</b>
                    <small>{low === undefined ? 'Unpriced' : low === high ? money.format(low) : `${money.format(low)}–${money.format(high ?? low)}`}</small>
                  </span>
                  {!model.active && <em>Archived</em>}
                  <span className="sinks-mobile-model-chevron" aria-hidden="true">{expandedMobileSinkId === model.id ? '⌃' : '⌄'}</span>
                </button>
                {isMobileCatalog && expandedMobileSinkId === model.id && (
                  <div className="sinks-mobile-model-detail">{renderSinkDetail(model)}</div>
                )}
              );
            })}
            {!visibleModels.length && <div className="sinks-empty-navigator"><strong>No sinks found</strong><span>Change the search/filter or add a sink model.</span></div>}
          </div>
        </aside>

        {!isMobileCatalog && renderSinkDetail(selected)}
      </div>
    </main>
  );
}
