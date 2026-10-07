import { Fragment, useEffect, useMemo, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import {
  defaultMaterialPurchaseOption,
  materialPurchaseCostPerSf,
  materialPurchaseSlabCost,
  materialVariantAreaSf,
  resolveStockMaterialCostReference,
  type MaterialPurchaseOption,
  type MaterialVariant,
  type StockMaterial,
} from '../types/settings';
import { MaterialRateBook } from './MaterialRateBook';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const PIN_STORAGE_KEY = 'salesshop-material-comparison-v1';

type MaterialSort = 'stock-supplier' | 'name' | 'supplier' | 'type' | 'cost-asc' | 'cost-desc';
type ProgramFilter = 'all' | 'stock' | 'non-stock';

function moneyPerSf(value?: number) {
  return value === undefined ? '—' : `${money.format(value)}/SF`;
}

function variantSpec(variant?: MaterialVariant) {
  if (!variant) return 'No structured variant';
  return [variant.thickness, variant.finish, variant.formatName || variant.formatKind]
    .filter(Boolean)
    .join(' · ') || 'Structured variant';
}

function variantSize(variant: MaterialVariant) {
  if (variant.lengthIn && variant.widthIn) return `${variant.lengthIn} × ${variant.widthIn} in`;
  return variant.formatName || variant.formatKind || 'Size not listed';
}

function availabilityLabel(value?: MaterialVariant['availability']) {
  if (!value || value === 'unknown') return 'Availability not tracked';
  return value.replaceAll('-', ' ');
}

function productLinks(material: StockMaterial) {
  return [
    ['Slab', material.slabImageUrl],
    ['Close-up', material.closeUpImageUrl],
    ['Product', material.productUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function pinKey(materialId: string, variantId: string) {
  return `${materialId}::${variantId}`;
}

function activePurchaseOptions(variant: MaterialVariant) {
  return (variant.purchaseOptions ?? []).filter((option) => option.active !== false);
}

function priceProgramSummary(variant: MaterialVariant, option: MaterialPurchaseOption) {
  const costPerSf = materialPurchaseCostPerSf(variant, option);
  const slabCost = materialPurchaseSlabCost(variant, option);
  const unitCost = option.costPerUnit;
  return {
    label: option.label || 'Price',
    costPerSf,
    unitCost,
    slabCost,
  };
}

function compareOptionalNumbers(left?: number, right?: number) {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

export function MaterialsWorkspace() {
  const settings = useCompanySettingsStore((state) => state.settings);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [finishFilter, setFinishFilter] = useState('all');
  const [thicknessFilter, setThicknessFilter] = useState('all');
  const [sort, setSort] = useState<MaterialSort>('stock-supplier');
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(PIN_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([...pinnedKeys]));
  }, [pinnedKeys]);

  const materialTypes = useMemo(() => [...new Set(settings.stockMaterials.map((material) => material.materialType))].sort(), [settings.stockMaterials]);
  const suppliers = useMemo(() => [...new Set(settings.stockMaterials.map((material) => material.supplier?.trim()).filter((value): value is string => Boolean(value)))].sort(), [settings.stockMaterials]);
  const finishes = useMemo(() => [...new Set(settings.stockMaterials.flatMap((material) => (material.variants ?? []).map((variant) => variant.finish?.trim()).filter((value): value is string => Boolean(value))))].sort(), [settings.stockMaterials]);
  const thicknesses = useMemo(() => [...new Set(settings.stockMaterials.flatMap((material) => (material.variants ?? []).map((variant) => variant.thickness?.trim()).filter((value): value is string => Boolean(value))))].sort(), [settings.stockMaterials]);

  const materials = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = settings.stockMaterials
      .filter((material) => material.active)
      .filter((material) => programFilter === 'all' || (programFilter === 'stock' ? material.stockProgram : !material.stockProgram))
      .filter((material) => materialTypeFilter === 'all' || material.materialType === materialTypeFilter)
      .filter((material) => supplierFilter === 'all' || material.supplier === supplierFilter)
      .filter((material) => finishFilter === 'all' || (material.variants ?? []).some((variant) => variant.finish === finishFilter))
      .filter((material) => thicknessFilter === 'all' || (material.variants ?? []).some((variant) => variant.thickness === thicknessFilter))
      .filter((material) => !needle || `${material.name} ${material.supplier ?? ''} ${material.brand ?? ''} ${material.collection ?? ''} ${material.sku ?? ''} ${material.materialType} ${(material.features ?? []).join(' ')} ${(material.variants ?? []).flatMap((variant) => [variant.sku, variant.thickness, variant.finish, variant.formatName, variant.availabilityNote, ...(variant.features ?? [])]).join(' ')}`.toLowerCase().includes(needle));

    return rows.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'supplier') return (a.supplier ?? '').localeCompare(b.supplier ?? '') || a.name.localeCompare(b.name);
      if (sort === 'type') return a.materialType.localeCompare(b.materialType) || a.name.localeCompare(b.name);
      if (sort === 'cost-asc') return compareOptionalNumbers(resolveStockMaterialCostReference(a).costPerSf, resolveStockMaterialCostReference(b).costPerSf) || a.name.localeCompare(b.name);
      if (sort === 'cost-desc') return compareOptionalNumbers(resolveStockMaterialCostReference(b).costPerSf, resolveStockMaterialCostReference(a).costPerSf) || a.name.localeCompare(b.name);
      return Number(b.stockProgram) - Number(a.stockProgram) || (a.supplier ?? '').localeCompare(b.supplier ?? '') || a.name.localeCompare(b.name);
    });
  }, [settings.stockMaterials, query, programFilter, materialTypeFilter, supplierFilter, finishFilter, thicknessFilter, sort]);

  const pinnedVariants = useMemo(() => {
    const entries: Array<{ material: StockMaterial; variant: MaterialVariant }> = [];
    settings.stockMaterials.forEach((material) => {
      (material.variants ?? []).forEach((variant) => {
        if (pinnedKeys.has(pinKey(material.id, variant.id))) entries.push({ material, variant });
      });
    });
    return entries;
  }, [settings.stockMaterials, pinnedKeys]);

  const activeFilterCount = Number(programFilter !== 'all')
    + Number(materialTypeFilter !== 'all')
    + Number(supplierFilter !== 'all')
    + Number(finishFilter !== 'all')
    + Number(thicknessFilter !== 'all');

  const clearFilters = () => {
    setProgramFilter('all');
    setMaterialTypeFilter('all');
    setSupplierFilter('all');
    setFinishFilter('all');
    setThicknessFilter('all');
  };

  const togglePin = (materialId: string, variantId: string) => {
    const key = pinKey(materialId, variantId);
    setPinnedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <main className={`rates-workspace materials-workspace ${editing ? 'is-editing' : 'is-reference'}`}>
      <header className="rates-workspace-header">
        <div>
          <span className="board-eyebrow">Supplier material library</span>
          <h1>Materials</h1>
          <p>{editing
            ? 'Maintain supplier colors, physical variants, slab sizes, purchase programs, and source costs.'
            : 'Browse what we can buy, drill into slab variants, and compare real supplier costs without entering edit mode.'}</p>
        </div>
        <div className="rates-mode-actions">
          {editing && (
            <label className="materials-show-inactive">
              <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
              Show inactive
            </label>
          )}
          <span className={`rates-mode-badge ${editing ? 'is-editing' : ''}`}>{editing ? 'Editing' : 'Reference mode'}</span>
          <button type="button" className={editing ? 'rates-done-button' : 'rates-edit-button'} onClick={() => setEditing((value) => !value)}>
            {editing ? 'Done editing' : 'Edit materials'}
          </button>
        </div>
      </header>

      <section className="rates-reference-controls rates-shared-controls materials-controls">
        <div className="rates-reference-tools materials-reference-tools">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search colors, suppliers, brands, finishes…"
            aria-label="Search material library"
          />
          {!editing && (
            <>
              <details className="rates-filter-menu">
                <summary>Filter{activeFilterCount ? ` · ${activeFilterCount}` : ''}</summary>
                <div className="rates-filter-popover">
                  <label><span>Program</span><select value={programFilter} onChange={(event) => setProgramFilter(event.target.value as ProgramFilter)}><option value="all">All programs</option><option value="stock">STOCK only</option><option value="non-stock">Non-stock only</option></select></label>
                  <label><span>Material type</span><select value={materialTypeFilter} onChange={(event) => setMaterialTypeFilter(event.target.value)}><option value="all">All types</option>{materialTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
                  <label><span>Supplier</span><select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="all">All suppliers</option>{suppliers.map((supplier) => <option value={supplier} key={supplier}>{supplier}</option>)}</select></label>
                  <label><span>Finish</span><select value={finishFilter} onChange={(event) => setFinishFilter(event.target.value)}><option value="all">All finishes</option>{finishes.map((finish) => <option value={finish} key={finish}>{finish}</option>)}</select></label>
                  <label><span>Thickness</span><select value={thicknessFilter} onChange={(event) => setThicknessFilter(event.target.value)}><option value="all">All thicknesses</option>{thicknesses.map((thickness) => <option value={thickness} key={thickness}>{thickness}</option>)}</select></label>
                  <button type="button" onClick={clearFilters} disabled={!activeFilterCount}>Clear filters</button>
                </div>
              </details>
              <label className="rates-sort-control">
                <span>Sort</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as MaterialSort)} aria-label="Sort material library">
                  <option value="stock-supplier">STOCK / supplier</option>
                  <option value="name">Color A–Z</option>
                  <option value="supplier">Supplier A–Z</option>
                  <option value="type">Material type</option>
                  <option value="cost-asc">Cost / SF · low to high</option>
                  <option value="cost-desc">Cost / SF · high to low</option>
                </select>
              </label>
            </>
          )}
        </div>
      </section>

      {editing ? (
        <div className="materials-editor-host">
          <MaterialRateBook query={query} showInactive={showInactive} mode="catalog" />
        </div>
      ) : (
        <div className="materials-reference-host">
          <section className={`materials-comparison-board ${pinnedVariants.length ? 'has-pins' : ''}`} aria-label="Pinned material comparison">
            <header>
              <div>
                <span className="board-eyebrow">Comparison board</span>
                <strong>{pinnedVariants.length ? `${pinnedVariants.length} pinned variant${pinnedVariants.length === 1 ? '' : 's'}` : 'Pin slab variants while you browse'}</strong>
                <small>Pinned variants stay here while search and filters change.</small>
              </div>
              {pinnedVariants.length > 0 && <button type="button" onClick={() => setPinnedKeys(new Set())}>Clear all</button>}
            </header>
            {pinnedVariants.length > 0 ? (
              <div className="materials-comparison-strip">
                {pinnedVariants.map(({ material, variant }) => {
                  const option = defaultMaterialPurchaseOption(variant);
                  const costPerSf = materialPurchaseCostPerSf(variant, option);
                  const slabCost = materialPurchaseSlabCost(variant, option);
                  const area = materialVariantAreaSf(variant);
                  return (
                    <article className="materials-comparison-card" key={pinKey(material.id, variant.id)}>
                      <button type="button" className="materials-unpin" onClick={() => togglePin(material.id, variant.id)} aria-label={`Unpin ${material.name} ${variantSpec(variant)}`}>×</button>
                      <span>{material.supplier || 'Unknown supplier'} · {material.materialType}</span>
                      <strong>{material.name}</strong>
                      <b>{variantSpec(variant)}</b>
                      <dl>
                        <div><dt>Size</dt><dd>{variantSize(variant)}</dd></div>
                        <div><dt>Area</dt><dd>{area === undefined ? '—' : `${area.toFixed(2)} SF`}</dd></div>
                        <div><dt>Cost / SF</dt><dd>{moneyPerSf(costPerSf)}</dd></div>
                        <div><dt>Slab cost</dt><dd>{slabCost === undefined ? '—' : money.format(slabCost)}</dd></div>
                      </dl>
                      <small>{option?.label || 'No default price program'} · {availabilityLabel(variant.availability)}</small>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="materials-comparison-empty">Expand <strong>Variants</strong> on any material, then pin the slab options you want to compare.</div>
            )}
          </section>

          <section className="rates-reference-card materials-reference-card">
            <header>
              <div><strong>Supplier material catalog</strong><small>{materials.length} active material{materials.length === 1 ? '' : 's'} shown</small></div>
              <span>Variants reveal slab size, square footage, availability, and every active supplier price program.</span>
            </header>
            <div className="rates-reference-table-wrap">
              <table className="rates-reference-table materials-reference-table">
                <thead><tr><th>Color</th><th>Program</th><th>Supplier</th><th>Type</th><th>Default cost</th><th>Default spec</th><th>Variants</th><th>Product</th></tr></thead>
                <tbody>
                  {materials.map((material) => {
                    const reference = resolveStockMaterialCostReference(material);
                    const links = productLinks(material);
                    const activeVariants = (material.variants ?? []).filter((variant) => variant.active !== false);
                    const expanded = expandedMaterialId === material.id;
                    const hasPinnedVariant = activeVariants.some((variant) => pinnedKeys.has(pinKey(material.id, variant.id)));
                    return (
                      <Fragment key={material.id}>
                        <tr className={`${expanded ? 'is-expanded' : ''} ${hasPinnedVariant ? 'has-pinned-variant' : ''}`}>
                          <td className="rates-reference-item"><strong>{material.name}</strong><small>{material.brand || material.collection || material.sku || '—'}</small></td>
                          <td><span className={`rates-program-pill ${material.stockProgram ? 'is-stock' : ''}`}>{material.stockProgram ? 'STOCK' : 'Non-stock'}</span></td>
                          <td>{material.supplier || '—'}</td>
                          <td>{material.materialType}</td>
                          <td className="number"><strong>{moneyPerSf(reference.costPerSf)}</strong><small className="materials-cell-note">{reference.purchaseOption?.label || (reference.basis === 'legacy' ? 'Legacy cost' : 'No default price')}</small></td>
                          <td className="materials-default-spec"><strong>{variantSpec(reference.variant)}</strong><small>{reference.variant ? `${variantSize(reference.variant)}${materialVariantAreaSf(reference.variant) ? ` · ${materialVariantAreaSf(reference.variant)?.toFixed(2)} SF` : ''}` : 'No structured slab size'}</small></td>
                          <td className="materials-variant-toggle-cell"><button type="button" className={expanded ? 'active' : ''} onClick={() => setExpandedMaterialId((current) => current === material.id ? null : material.id)}>{expanded ? 'Hide variants' : `Variants · ${activeVariants.length}`}</button></td>
                          <td className="rates-product-links">{links.length ? links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}</a>) : <span>—</span>}</td>
                        </tr>
                        {expanded && (
                          <tr key={`${material.id}-variants`} className="materials-variant-expanded-row">
                            <td colSpan={8}>
                              <div className="materials-variant-browser">
                                {activeVariants.map((variant) => {
                                  const area = materialVariantAreaSf(variant);
                                  const options = activePurchaseOptions(variant);
                                  const defaultOption = defaultMaterialPurchaseOption(variant);
                                  const defaultCost = materialPurchaseCostPerSf(variant, defaultOption);
                                  const isPinned = pinnedKeys.has(pinKey(material.id, variant.id));
                                  return (
                                    <article className={`materials-variant-line ${isPinned ? 'is-pinned' : ''}`} key={variant.id}>
                                      <button type="button" className={`materials-pin-button ${isPinned ? 'is-pinned' : ''}`} onClick={() => togglePin(material.id, variant.id)}>{isPinned ? 'Pinned' : 'Pin'}</button>
                                      <div className="materials-variant-identity"><strong>{variantSpec(variant)}</strong><small>{variant.sku || 'No variant SKU'}{variant.default ? ' · Default spec' : ''}</small></div>
                                      <div><span>Size</span><strong>{variantSize(variant)}</strong><small>{area === undefined ? 'Area not available' : `${area.toFixed(2)} SF`}</small></div>
                                      <div><span>Availability</span><strong>{availabilityLabel(variant.availability)}</strong><small>{variant.availabilityNote || 'No ETA note'}</small></div>
                                      <div className="materials-variant-default-cost"><span>Default cost</span><strong>{moneyPerSf(defaultCost)}</strong><small>{defaultOption?.label || 'No default program'}</small></div>
                                      <div className="materials-price-program-list">
                                        {options.length ? options.map((option) => {
                                          const summary = priceProgramSummary(variant, option);
                                          return (
                                            <div key={option.id} className={option.default ? 'is-default' : ''}>
                                              <span>{summary.label}{option.minQuantity ? ` · ${option.minQuantity}+` : ''}</span>
                                              <strong>{moneyPerSf(summary.costPerSf)}</strong>
                                              <small>{summary.unitCost === undefined ? 'No unit cost' : `${money.format(summary.unitCost)}/${option.pricingBasis}`}</small>
                                            </div>
                                          );
                                        }) : <div className="is-empty"><span>No supplier price programs</span><strong>—</strong></div>}
                                      </div>
                                    </article>
                                  );
                                })}
                                {!activeVariants.length && <div className="materials-variant-empty">This material has no active structured variants yet. Use Edit materials to add slab sizes and supplier price programs.</div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {!materials.length && <tr><td colSpan={8}><div className="rates-reference-empty">No active materials match the current search and filters.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
