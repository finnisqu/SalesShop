import { useEffect, useMemo, useRef, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { useRateBookStore } from '../store/rateBookStore';
import { resolveMaterialPricingRecommendation, resolveSlabPrice } from '../types/materialLevelGuide';
import {
  RATE_BOOK_CATEGORY_LABELS,
  RATE_BOOK_PRICING_BEHAVIOR_LABELS,
  RATE_BOOK_UNIT_LABELS,
  type RateBookCategory,
  type RateBookItem,
  type RateBookPricingBehavior,
  type RateBookUnit,
} from '../types/rateBook';
import { resolveStockMaterialCostReference, type StockMaterial } from '../types/settings';
import { RateBook } from './RateBook';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
type ReferenceCategory = 'all' | RateBookCategory;
type RateSort = 'category' | 'name' | 'sell-asc' | 'sell-desc' | 'cost-asc' | 'effective-desc';
type MaterialSort = 'stock-supplier' | 'name' | 'supplier' | 'type' | 'guide-asc' | 'guide-desc';
type OverrideFilter = 'all' | 'has' | 'base';
type ProgramFilter = 'all' | 'stock' | 'non-stock';

const CATEGORY_TABS: Array<[ReferenceCategory, string]> = [
  ['all', 'All Rates'],
  ['fabrication-install', 'Fab & Install'],
  ['sink', 'Sinks'],
  ['add-on', 'Add-ons'],
  ['material', 'Materials'],
];

function moneyLabel(value?: number) {
  return value === undefined ? '—' : money.format(value);
}

function marginLabel(item: RateBookItem) {
  if (item.sellRate === undefined || item.internalCost === undefined || item.sellRate === 0) return '—';
  return `${(((item.sellRate - item.internalCost) / item.sellRate) * 100).toFixed(1)}%`;
}

function productLinks(material: StockMaterial) {
  return [
    ['Slab', material.slabImageUrl],
    ['Close-up', material.closeUpImageUrl],
    ['Product', material.productUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function compareOptionalNumbers(left?: number, right?: number) {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

function editorTabMatches(button: HTMLButtonElement, category: ReferenceCategory) {
  const text = button.textContent?.trim().toLowerCase() ?? '';
  if (category === 'all') return text === 'all' || text === 'all rates';
  if (category === 'fabrication-install') return text.includes('fabrication') || text.includes('fab & install');
  if (category === 'sink') return text.startsWith('sink');
  if (category === 'add-on') return text.includes('add-on') || text.includes('add on');
  return text.startsWith('material');
}

export function RatesWorkspace() {
  const items = useRateBookStore((state) => state.items);
  const hydrated = useRateBookStore((state) => state.hydrated);
  const hydrateRates = useRateBookStore((state) => state.hydrate);
  const addRateItem = useRateBookStore((state) => state.addItem);
  const settings = useCompanySettingsStore((state) => state.settings);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const guide = useMaterialLevelGuideStore((state) => state.guide);
  const hydrateGuide = useMaterialLevelGuideStore((state) => state.hydrate);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState<ReferenceCategory>('all');
  const [query, setQuery] = useState('');
  const [rateSort, setRateSort] = useState<RateSort>('category');
  const [materialSort, setMaterialSort] = useState<MaterialSort>('stock-supplier');
  const [behaviorFilter, setBehaviorFilter] = useState<'all' | RateBookPricingBehavior>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | RateBookUnit>('all');
  const [overrideFilter, setOverrideFilter] = useState<OverrideFilter>('all');
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  useEffect(() => {
    hydrateRates();
    void hydrateSettings();
    hydrateGuide();
  }, [hydrateRates, hydrateSettings, hydrateGuide]);

  const syncEditorCategory = (nextCategory: ReferenceCategory) => {
    const buttons = Array.from(editorHostRef.current?.querySelectorAll<HTMLButtonElement>('.rate-book-category-switch button') ?? []);
    const target = buttons.find((button) => editorTabMatches(button, nextCategory));
    target?.click();
  };

  const selectCategory = (nextCategory: ReferenceCategory) => {
    setCategory(nextCategory);
    window.requestAnimationFrame(() => syncEditorCategory(nextCategory));
  };

  const addCurrentRate = () => {
    if (category === 'material') return;
    const nextCategory: RateBookCategory = category === 'all' ? 'fabrication-install' : category;
    addRateItem(nextCategory);
    if (category === 'all') selectCategory(nextCategory);
  };

  const nonMaterialItems = useMemo(() => items.filter((item) => item.category !== 'material'), [items]);
  const activeCount = nonMaterialItems.filter((item) => item.active).length;
  const referenceOnlyCount = nonMaterialItems.filter((item) => item.active && item.pricingBehavior !== 'suggested').length;
  const overrideCount = nonMaterialItems.filter((item) => item.active && item.divisionOverrides.length).length;
  const historyCount = nonMaterialItems.reduce((total, item) => total + item.history.length, 0);

  const availableUnits = useMemo(() => [...new Set(nonMaterialItems.map((item) => item.unit))].sort(), [nonMaterialItems]);
  const materialTypes = useMemo(() => [...new Set(settings.stockMaterials.map((material) => material.materialType))].sort(), [settings.stockMaterials]);
  const suppliers = useMemo(() => [...new Set(settings.stockMaterials.map((material) => material.supplier?.trim()).filter((value): value is string => Boolean(value)))].sort(), [settings.stockMaterials]);

  const rateRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = items
      .filter((item) => item.active && item.category !== 'material')
      .filter((item) => category === 'all' || category === 'material' || item.category === category)
      .filter((item) => behaviorFilter === 'all' || item.pricingBehavior === behaviorFilter)
      .filter((item) => unitFilter === 'all' || item.unit === unitFilter)
      .filter((item) => overrideFilter === 'all' || (overrideFilter === 'has' ? item.divisionOverrides.length > 0 : item.divisionOverrides.length === 0))
      .filter((item) => !needle || `${item.name} ${item.code ?? ''} ${RATE_BOOK_CATEGORY_LABELS[item.category]} ${item.notes ?? ''}`.toLowerCase().includes(needle));

    return rows.sort((a, b) => {
      if (rateSort === 'name') return a.name.localeCompare(b.name);
      if (rateSort === 'sell-asc') return compareOptionalNumbers(a.sellRate, b.sellRate) || a.name.localeCompare(b.name);
      if (rateSort === 'sell-desc') return compareOptionalNumbers(b.sellRate, a.sellRate) || a.name.localeCompare(b.name);
      if (rateSort === 'cost-asc') return compareOptionalNumbers(a.internalCost, b.internalCost) || a.name.localeCompare(b.name);
      if (rateSort === 'effective-desc') return (b.effectiveDate ?? '').localeCompare(a.effectiveDate ?? '') || a.name.localeCompare(b.name);
      return RATE_BOOK_CATEGORY_LABELS[a.category].localeCompare(RATE_BOOK_CATEGORY_LABELS[b.category]) || a.name.localeCompare(b.name);
    });
  }, [items, category, query, behaviorFilter, unitFilter, overrideFilter, rateSort]);

  const materialRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const guideRate = (material: StockMaterial) => {
      const reference = resolveStockMaterialCostReference(material);
      const recommendation = resolveMaterialPricingRecommendation(
        guide,
        reference.costPerSf,
        material.stockProgram ? material.builderLevelId : undefined,
      );
      return recommendation.mode === 'level' ? recommendation.level.customerRate : undefined;
    };

    const rows = settings.stockMaterials
      .filter((material) => material.active)
      .filter((material) => programFilter === 'all' || (programFilter === 'stock' ? material.stockProgram : !material.stockProgram))
      .filter((material) => materialTypeFilter === 'all' || material.materialType === materialTypeFilter)
      .filter((material) => supplierFilter === 'all' || material.supplier === supplierFilter)
      .filter((material) => !needle || `${material.name} ${material.supplier ?? ''} ${material.brand ?? ''} ${material.collection ?? ''} ${material.sku ?? ''} ${material.materialType} ${material.stockProgram ? 'stock' : 'non-stock'}`.toLowerCase().includes(needle));

    return rows.sort((a, b) => {
      if (materialSort === 'name') return a.name.localeCompare(b.name);
      if (materialSort === 'supplier') return (a.supplier ?? '').localeCompare(b.supplier ?? '') || a.name.localeCompare(b.name);
      if (materialSort === 'type') return a.materialType.localeCompare(b.materialType) || a.name.localeCompare(b.name);
      if (materialSort === 'guide-asc') return compareOptionalNumbers(guideRate(a), guideRate(b)) || a.name.localeCompare(b.name);
      if (materialSort === 'guide-desc') return compareOptionalNumbers(guideRate(b), guideRate(a)) || a.name.localeCompare(b.name);
      return Number(b.stockProgram) - Number(a.stockProgram) || (a.supplier ?? '').localeCompare(b.supplier ?? '') || a.name.localeCompare(b.name);
    });
  }, [settings.stockMaterials, query, programFilter, materialTypeFilter, supplierFilter, materialSort, guide]);

  const showingMaterials = category === 'material';
  const activeReferenceFilters = showingMaterials
    ? Number(programFilter !== 'all') + Number(materialTypeFilter !== 'all') + Number(supplierFilter !== 'all')
    : Number(behaviorFilter !== 'all') + Number(unitFilter !== 'all') + Number(overrideFilter !== 'all');

  const clearReferenceFilters = () => {
    if (showingMaterials) {
      setProgramFilter('all');
      setMaterialTypeFilter('all');
      setSupplierFilter('all');
    } else {
      setBehaviorFilter('all');
      setUnitFilter('all');
      setOverrideFilter('all');
    }
  };

  if (!hydrated) return <div className="rate-book-loading">Opening Rates…</div>;

  return (
    <main className={`rates-workspace ${editing ? 'is-editing' : 'is-reference'}`}>
      <header className="rates-workspace-header">
        <div>
          <span className="board-eyebrow">Company pricing reference</span>
          <h1>Rates</h1>
          <p>{editing ? 'Edit company pricing, history, overrides, and material guidance.' : 'Look up a price without worrying about accidentally changing it.'}</p>
        </div>
        <div className="rates-mode-actions">
          <span className={`rates-mode-badge ${editing ? 'is-editing' : ''}`}>{editing ? 'Editing' : 'Reference mode'}</span>
          {editing && !showingMaterials && <button type="button" className="rates-add-button" onClick={addCurrentRate}>+ Rate row</button>}
          <button type="button" className={editing ? 'rates-done-button' : 'rates-edit-button'} onClick={() => {
            if (!editing) syncEditorCategory(category);
            setEditing((value) => !value);
          }}>{editing ? 'Done editing' : 'Edit pricing'}</button>
        </div>
      </header>

      <section className="rates-reference-controls rates-shared-controls">
        <div className="rates-reference-tabs" role="tablist" aria-label="Rate categories">
          {CATEGORY_TABS.map(([tab, label]) => (
            <button type="button" key={tab} className={category === tab ? 'active' : ''} onClick={() => selectCategory(tab)}>{label}</button>
          ))}
        </div>

        {!editing && (
          <div className="rates-reference-tools">
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={showingMaterials ? 'Search colors, suppliers, brands…' : 'Search rates, codes, categories…'} aria-label="Search pricing reference" />
            <details className="rates-filter-menu">
              <summary>Filter{activeReferenceFilters ? ` · ${activeReferenceFilters}` : ''}</summary>
              <div className="rates-filter-popover">
                {showingMaterials ? (
                  <>
                    <label><span>Program</span><select value={programFilter} onChange={(event) => setProgramFilter(event.target.value as ProgramFilter)}><option value="all">All programs</option><option value="stock">STOCK only</option><option value="non-stock">Non-stock only</option></select></label>
                    <label><span>Material type</span><select value={materialTypeFilter} onChange={(event) => setMaterialTypeFilter(event.target.value)}><option value="all">All types</option>{materialTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
                    <label><span>Supplier</span><select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="all">All suppliers</option>{suppliers.map((supplier) => <option value={supplier} key={supplier}>{supplier}</option>)}</select></label>
                  </>
                ) : (
                  <>
                    <label><span>Pricing behavior</span><select value={behaviorFilter} onChange={(event) => setBehaviorFilter(event.target.value as 'all' | RateBookPricingBehavior)}><option value="all">All behaviors</option><option value="suggested">Suggested sell</option><option value="cost-reference">Cost reference</option><option value="manual">Manual</option></select></label>
                    <label><span>Unit</span><select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value as 'all' | RateBookUnit)}><option value="all">All units</option>{availableUnits.map((unit) => <option value={unit} key={unit}>{RATE_BOOK_UNIT_LABELS[unit]}</option>)}</select></label>
                    <label><span>Division pricing</span><select value={overrideFilter} onChange={(event) => setOverrideFilter(event.target.value as OverrideFilter)}><option value="all">All rows</option><option value="has">Has division override</option><option value="base">Base rate only</option></select></label>
                  </>
                )}
                <button type="button" onClick={clearReferenceFilters} disabled={!activeReferenceFilters}>Clear filters</button>
              </div>
            </details>
            <label className="rates-sort-control">
              <span>Sort</span>
              {showingMaterials ? (
                <select value={materialSort} onChange={(event) => setMaterialSort(event.target.value as MaterialSort)} aria-label="Sort material reference">
                  <option value="stock-supplier">STOCK / supplier</option>
                  <option value="name">Color A–Z</option>
                  <option value="supplier">Supplier A–Z</option>
                  <option value="type">Material type</option>
                  <option value="guide-asc">Guide price · low to high</option>
                  <option value="guide-desc">Guide price · high to low</option>
                </select>
              ) : (
                <select value={rateSort} onChange={(event) => setRateSort(event.target.value as RateSort)} aria-label="Sort rate reference">
                  <option value="category">Category / item</option>
                  <option value="name">Item A–Z</option>
                  <option value="sell-asc">Suggested sell · low to high</option>
                  <option value="sell-desc">Suggested sell · high to low</option>
                  <option value="cost-asc">Cost · low to high</option>
                  <option value="effective-desc">Effective date · newest</option>
                </select>
              )}
            </label>
          </div>
        )}
      </section>

      {editing && (
        <section className="rate-book-stats rates-workspace-stats" aria-label="Rate Book summary">
          <div><span>Active</span><strong>{activeCount}</strong></div>
          <div><span>Reference/manual</span><strong>{referenceOnlyCount}</strong></div>
          <div><span>Division overrides</span><strong>{overrideCount}</strong></div>
          <div><span>Price versions</span><strong>{historyCount}</strong></div>
        </section>
      )}

      <div ref={editorHostRef} className={`rates-editor-host ${editing ? '' : 'is-hidden'}`}><RateBook /></div>

      <div className={`rates-reference-host ${editing ? 'is-hidden' : ''}`}>
        {!showingMaterials ? (
          <section className="rates-reference-card">
            <header><div><strong>Current company rates</strong><small>{rateRows.length} active reference{rateRows.length === 1 ? '' : 's'} shown</small></div><span>Click Edit pricing when you want to make changes.</span></header>
            <div className="rates-reference-table-wrap">
              <table className="rates-reference-table">
                <thead><tr><th>Item</th><th>Category</th><th>Cost</th><th>Suggested sell</th><th>Unit</th><th>Margin</th><th>Effective</th></tr></thead>
                <tbody>
                  {rateRows.map((item) => (
                    <tr key={item.id}>
                      <td className="rates-reference-item"><strong>{item.name}</strong><small>{item.code || 'No code'}</small></td>
                      <td>{RATE_BOOK_CATEGORY_LABELS[item.category]}</td>
                      <td className="number">{moneyLabel(item.internalCost)}</td>
                      <td className="rates-reference-sell"><strong>{moneyLabel(item.sellRate)}</strong><small>{RATE_BOOK_PRICING_BEHAVIOR_LABELS[item.pricingBehavior]}</small></td>
                      <td>{RATE_BOOK_UNIT_LABELS[item.unit]}</td>
                      <td className="number">{marginLabel(item)}</td>
                      <td>{item.effectiveDate || '—'}</td>
                    </tr>
                  ))}
                  {!rateRows.length && <tr><td colSpan={7}><div className="rates-reference-empty">No active rates match the current search and filters.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="rates-reference-card rates-material-reference-card">
            <header><div><strong>Material pricing reference</strong><small>{materialRows.length} active material{materialRows.length === 1 ? '' : 's'} shown</small></div><span>SalesShop suggests a Level through the standard guide; premium materials move to slab review.</span></header>
            <div className="rates-reference-table-wrap">
              <table className="rates-reference-table rates-material-reference-table">
                <thead><tr><th>Color</th><th>Program</th><th>Supplier</th><th>Type</th><th>Cost reference</th><th>Pricing guide</th><th>Default spec</th><th>Product</th></tr></thead>
                <tbody>
                  {materialRows.map((material) => {
                    const reference = resolveStockMaterialCostReference(material);
                    const recommendation = resolveMaterialPricingRecommendation(
                      guide,
                      reference.costPerSf,
                      material.stockProgram ? material.builderLevelId : undefined,
                    );
                    const slabPricing = recommendation.mode === 'slab-review'
                      ? resolveSlabPrice(guide, reference.costPerSf, reference.slabCost, 1)
                      : undefined;
                    const customerRate = recommendation.mode === 'level' ? recommendation.level.customerRate : undefined;
                    const guideLabel = recommendation.mode === 'level'
                      ? `${material.stockProgram && material.builderLevelId ? 'Assigned' : 'Suggested'} ${recommendation.level.rule.label}`
                      : recommendation.mode === 'slab-review'
                        ? reference.slabCost === undefined
                          ? 'Slab review · needs full-slab cost'
                          : `${guide.slabPricingMultiplier}× actual slab cost`
                        : recommendation.basis;
                    const links = productLinks(material);
                    const variant = reference.variant;
                    const spec = variant ? [variant.thickness, variant.finish, variant.formatName].filter(Boolean).join(' · ') : 'No structured spec';
                    return (
                      <tr key={material.id}>
                        <td className="rates-reference-item"><strong>{material.name}</strong><small>{material.brand || material.collection || material.sku || '—'}</small></td>
                        <td><span className={`rates-program-pill ${material.stockProgram ? 'is-stock' : ''}`}>{material.stockProgram ? 'STOCK' : 'Non-stock'}</span></td>
                        <td>{material.supplier || '—'}</td>
                        <td>{material.materialType}</td>
                        <td className="number">{reference.costPerSf === undefined ? '—' : `${money.format(reference.costPerSf)}/SF`}</td>
                        <td className="rates-reference-sell"><strong>{recommendation.mode === 'slab-review'
                          ? slabPricing?.customerPricePerSlab === undefined ? 'Slab review' : `${money.format(slabPricing.customerPricePerSlab)}/slab`
                          : customerRate === undefined ? '—' : `${money.format(customerRate)}/SF`}</strong><small>{guideLabel}</small></td>
                        <td>{spec || 'No structured spec'}</td>
                        <td className="rates-product-links">{links.length ? links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}</a>) : <span>—</span>}</td>
                      </tr>
                    );
                  })}
                  {!materialRows.length && <tr><td colSpan={8}><div className="rates-reference-empty">No active materials match the current search and filters.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
