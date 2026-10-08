import { useEffect, useMemo, useRef, useState } from 'react';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { useRateBookStore } from '../store/rateBookStore';
import { materialLevelCostBand } from '../types/materialLevelGuide';
import {
  RATE_BOOK_CATEGORY_LABELS,
  RATE_BOOK_PRICING_BEHAVIOR_LABELS,
  RATE_BOOK_UNIT_LABELS,
  type RateBookCategory,
  type RateBookItem,
  type RateBookPricingBehavior,
  type RateBookUnit,
} from '../types/rateBook';
import { MobileCatalogReferenceCard, MobileCatalogReferenceList } from './MobileCatalogReferenceCard';
import { MobileCatalogActiveFilters, MobileCatalogFilterSheet, MobileCatalogToolsSheet, type MobileCatalogFilterChip } from './MobileCatalogTools';
import { RateBook } from './RateBook';
import { WorkspaceLoadingState } from './WorkspaceLoadingState';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
type ReferenceCategory = 'all' | RateBookCategory;
type RateSort = 'category' | 'name' | 'sell-asc' | 'sell-desc' | 'cost-asc' | 'effective-desc';
type OverrideFilter = 'all' | 'has' | 'base';

const CATEGORY_TABS: Array<[ReferenceCategory, string]> = [
  ['all', 'All Rates'],
  ['fabrication-install', 'Fab & Install'],
  ['sink', 'Sink Services'],
  ['add-on', 'Add-ons'],
  ['material', 'Material Pricing'],
];

function moneyLabel(value?: number) {
  return value === undefined ? '—' : money.format(value);
}

function marginLabel(item: RateBookItem) {
  if (item.sellRate === undefined || item.internalCost === undefined || item.sellRate === 0) return '—';
  return `${(((item.sellRate - item.internalCost) / item.sellRate) * 100).toFixed(1)}%`;
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

export function RatesWorkspace({ embedded = false }: { embedded?: boolean } = {}) {
  const items = useRateBookStore((state) => state.items);
  const hydrated = useRateBookStore((state) => state.hydrated);
  const hydrateRates = useRateBookStore((state) => state.hydrate);
  const addRateItem = useRateBookStore((state) => state.addItem);
  const guide = useMaterialLevelGuideStore((state) => state.guide);
  const hydrateGuide = useMaterialLevelGuideStore((state) => state.hydrate);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [expandedRateId, setExpandedRateId] = useState<string | null>(null);
  const [expandedLevelId, setExpandedLevelId] = useState<string | null>(null);
  const [category, setCategory] = useState<ReferenceCategory>('all');
  const [query, setQuery] = useState('');
  const [rateSort, setRateSort] = useState<RateSort>('category');
  const [behaviorFilter, setBehaviorFilter] = useState<'all' | RateBookPricingBehavior>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | RateBookUnit>('all');
  const [overrideFilter, setOverrideFilter] = useState<OverrideFilter>('all');

  useEffect(() => {
    hydrateRates();
    hydrateGuide();
  }, [hydrateRates, hydrateGuide]);

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

  const rateRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = items
      .filter((item) => item.active && item.category !== 'material')
      .filter((item) => category === 'all' || item.category === category)
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

  const materialPricingRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...guide.rules]
      .filter((rule) => rule.active)
      .filter((rule) => !needle || `${rule.label} ${materialLevelCostBand(guide.rules, rule)}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (a.maxMaterialCost === undefined) return 1;
        if (b.maxMaterialCost === undefined) return -1;
        return a.maxMaterialCost - b.maxMaterialCost;
      });
  }, [guide.rules, query]);

  const showingMaterialPricing = category === 'material';
  const activeReferenceFilters = showingMaterialPricing
    ? 0
    : Number(behaviorFilter !== 'all') + Number(unitFilter !== 'all') + Number(overrideFilter !== 'all');

  const clearReferenceFilters = () => {
    setBehaviorFilter('all');
    setUnitFilter('all');
    setOverrideFilter('all');
  };

  const activeMobileFilters: MobileCatalogFilterChip[] = [
    ...(query.trim() ? [{ key: 'search', label: `Search: ${query.trim()}`, onRemove: () => setQuery('') }] : []),
    ...(category !== 'all' ? [{ key: 'category', label: CATEGORY_TABS.find(([key]) => key === category)?.[1] || category, onRemove: () => selectCategory('all') }] : []),
    ...(!showingMaterialPricing && behaviorFilter !== 'all' ? [{ key: 'behavior', label: RATE_BOOK_PRICING_BEHAVIOR_LABELS[behaviorFilter], onRemove: () => setBehaviorFilter('all') }] : []),
    ...(!showingMaterialPricing && unitFilter !== 'all' ? [{ key: 'unit', label: RATE_BOOK_UNIT_LABELS[unitFilter], onRemove: () => setUnitFilter('all') }] : []),
    ...(!showingMaterialPricing && overrideFilter !== 'all' ? [{ key: 'overrides', label: overrideFilter === 'has' ? 'Division overrides' : 'Base rates', onRemove: () => setOverrideFilter('all') }] : []),
  ];

  if (!hydrated) return <WorkspaceLoadingState title="Opening Rates" detail="Loading labor, service, and material pricing…" />;

  return (
    <main className={`rates-workspace ${embedded ? 'is-catalog-embedded' : ''} ${editing ? 'is-editing' : 'is-reference'}`}>
      <header className="rates-workspace-header">
        <div>
          <span className="board-eyebrow">Company pricing reference</span>
          <h1>Rates</h1>
          <p>{editing
            ? showingMaterialPricing
              ? 'Edit the material cost bands and standard customer square-foot pricing used by quoting.'
              : 'Edit company pricing, history, overrides, and selling references.'
            : showingMaterialPricing
              ? 'See the standard material cost bands and customer square-foot pricing without opening the supplier catalog.'
              : 'Look up a price without worrying about accidentally changing it.'}</p>
        </div>
        <div className="rates-mode-actions">
          <span className={`rates-mode-badge ${editing ? 'is-editing' : ''}`}>{editing ? 'Editing' : 'Reference mode'}</span>
          {editing && !showingMaterialPricing && <button type="button" className="rates-add-button" onClick={addCurrentRate}>+ Rate row</button>}
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
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={showingMaterialPricing ? 'Search material levels…' : 'Search rates, codes, categories…'}
              aria-label={showingMaterialPricing ? 'Search material pricing levels' : 'Search pricing reference'}
            />
            <button type="button" className="rates-mobile-tools-trigger" onClick={() => setMobileToolsOpen(true)} aria-label="Open rate catalog tools">••• <span>Tools</span></button>
            {!showingMaterialPricing && (
              <>
                <details className="rates-filter-menu">
                  <summary>Filter{activeReferenceFilters ? ` · ${activeReferenceFilters}` : ''}</summary>
                  <div className="rates-filter-popover">
                    <label><span>Pricing behavior</span><select value={behaviorFilter} onChange={(event) => setBehaviorFilter(event.target.value as 'all' | RateBookPricingBehavior)}><option value="all">All behaviors</option><option value="suggested">Suggested sell</option><option value="cost-reference">Cost reference</option><option value="manual">Manual</option></select></label>
                    <label><span>Unit</span><select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value as 'all' | RateBookUnit)}><option value="all">All units</option>{availableUnits.map((unit) => <option value={unit} key={unit}>{RATE_BOOK_UNIT_LABELS[unit]}</option>)}</select></label>
                    <label><span>Division pricing</span><select value={overrideFilter} onChange={(event) => setOverrideFilter(event.target.value as OverrideFilter)}><option value="all">All rows</option><option value="has">Has division override</option><option value="base">Base rate only</option></select></label>
                    <button type="button" onClick={clearReferenceFilters} disabled={!activeReferenceFilters}>Clear filters</button>
                  </div>
                </details>
                <button type="button" className="mobile-catalog-filter-trigger" aria-haspopup="dialog" onClick={() => setMobileFilterOpen(true)}>Filter{activeReferenceFilters ? ` · ${activeReferenceFilters}` : ''}</button>
                <label className="rates-sort-control">
                  <span>Sort</span>
                  <select value={rateSort} onChange={(event) => setRateSort(event.target.value as RateSort)} aria-label="Sort rate reference">
                    <option value="category">Category / item</option>
                    <option value="name">Item A–Z</option>
                    <option value="sell-asc">Suggested sell · low to high</option>
                    <option value="sell-desc">Suggested sell · high to low</option>
                    <option value="cost-asc">Cost · low to high</option>
                    <option value="effective-desc">Effective date · newest</option>
                  </select>
                </label>
              </>
            )}
          </div>
        )}
      </section>
      {!editing && <MobileCatalogActiveFilters items={activeMobileFilters}
        onClear={() => { setQuery(''); selectCategory('all'); clearReferenceFilters(); }} />}

      {!editing && !showingMaterialPricing && mobileFilterOpen && (
        <MobileCatalogFilterSheet section="Rates" onClose={() => setMobileFilterOpen(false)}>
          <label><span>Pricing behavior</span><select value={behaviorFilter} onChange={(event) => setBehaviorFilter(event.target.value as 'all' | RateBookPricingBehavior)}><option value="all">All behaviors</option><option value="suggested">Suggested sell</option><option value="cost-reference">Cost reference</option><option value="manual">Manual</option></select></label>
                    <label><span>Unit</span><select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value as 'all' | RateBookUnit)}><option value="all">All units</option>{availableUnits.map((unit) => <option value={unit} key={unit}>{RATE_BOOK_UNIT_LABELS[unit]}</option>)}</select></label>
                    <label><span>Division pricing</span><select value={overrideFilter} onChange={(event) => setOverrideFilter(event.target.value as OverrideFilter)}><option value="all">All rows</option><option value="has">Has division override</option><option value="base">Base rate only</option></select></label>
                    <button type="button" onClick={clearReferenceFilters} disabled={!activeReferenceFilters}>Clear filters</button>
        </MobileCatalogFilterSheet>
      )}

      {mobileToolsOpen && (
        <MobileCatalogToolsSheet title="Rate tools" section="Rates"
          description="Pricing maintenance stays separate from everyday lookup."
          onClose={() => setMobileToolsOpen(false)}>
          <section><span className="rates-mobile-tools-label">Mode</span><div className="rates-mobile-mode-row">
            <button type="button" className={!editing ? 'active' : ''} onClick={() => { setEditing(false); setMobileToolsOpen(false); }}><strong>Reference</strong><small>Look up current rates</small></button>
            <button type="button" className={editing ? 'active' : ''} onClick={() => { syncEditorCategory(category); setEditing(true); setMobileToolsOpen(false); }}><strong>Edit pricing</strong><small>Maintain rates and policy</small></button>
          </div></section>
          {editing && !showingMaterialPricing && <section><span className="rates-mobile-tools-label">Maintenance</span><button type="button" className="rates-mobile-add" onClick={() => { addCurrentRate(); setMobileToolsOpen(false); }}>+ Add rate row</button></section>}
          {!editing && !showingMaterialPricing && <section>
            <span className="rates-mobile-tools-label">Sort rates</span>
            <select className="rates-mobile-sort-select" aria-label="Sort rates on mobile" value={rateSort} onChange={(event) => setRateSort(event.target.value as RateSort)}>
              <option value="category">Category / item</option>
              <option value="name">Item A–Z</option>
              <option value="sell-asc">Sell price · low to high</option>
              <option value="sell-desc">Sell price · high to low</option>
              <option value="cost-asc">Cost · low to high</option>
              <option value="effective-desc">Effective date · newest</option>
            </select>
          </section>}
          <section><span className="rates-mobile-tools-label">Current category</span><strong>{CATEGORY_TABS.find(([key]) => key === category)?.[1]}</strong><small>Select a category in the reference toolbar to change which rates are shown.</small></section>
        </MobileCatalogToolsSheet>
      )}

      {editing && !showingMaterialPricing && (
        <section className="rate-book-stats rates-workspace-stats" aria-label="Rate Book summary">
          <div><span>Active</span><strong>{activeCount}</strong></div>
          <div><span>Reference/manual</span><strong>{referenceOnlyCount}</strong></div>
          <div><span>Division overrides</span><strong>{overrideCount}</strong></div>
          <div><span>Price versions</span><strong>{historyCount}</strong></div>
        </section>
      )}

      <div ref={editorHostRef} className={`rates-editor-host ${editing ? '' : 'is-hidden'}`}><RateBook /></div>

      <div className={`rates-reference-host ${editing ? 'is-hidden' : ''}`}>
        {!showingMaterialPricing ? (
          <section className="rates-reference-card">
            <header><div><strong>Current company rates</strong><small>{rateRows.length} active reference{rateRows.length === 1 ? '' : 's'} shown</small></div><span>Click Edit pricing when you want to make changes.</span></header>
            <MobileCatalogReferenceList
              label="Company rate reference"
              empty={!rateRows.length}
              emptyMessage="No active rates match the current search and filters."
              onReset={query.trim() || category !== 'all' || activeReferenceFilters ? () => {
                setQuery(''); selectCategory('all'); clearReferenceFilters();
              } : undefined}
            >
              {rateRows.map((item) => {
                const expanded = expandedRateId === item.id;
                return (
                  <MobileCatalogReferenceCard
                    key={item.id}
                    title={item.name}
                    subtitle={`${RATE_BOOK_CATEGORY_LABELS[item.category]}${item.code ? ` · ${item.code}` : ''}`}
                    price={moneyLabel(item.sellRate)}
                    priceAriaLabel={`Selling rate ${moneyLabel(item.sellRate)} per ${RATE_BOOK_UNIT_LABELS[item.unit]}`}
                    priceMeta={<><span>{RATE_BOOK_UNIT_LABELS[item.unit]} · sell</span><span>Cost {moneyLabel(item.internalCost)}</span></>}
                    expanded={expanded}
                    onToggle={() => setExpandedRateId(expanded ? null : item.id)}
                    details={
                      <div className="rates-mobile-price-details">
                        <div><span>Pricing behavior</span><strong>{RATE_BOOK_PRICING_BEHAVIOR_LABELS[item.pricingBehavior]}</strong></div>
                        <div><span>Margin</span><strong>{marginLabel(item)}</strong></div>
                        <div><span>Effective date</span><strong>{item.effectiveDate || '—'}</strong></div>
                        <div><span>Division overrides</span><strong>{item.divisionOverrides.length || '—'}</strong></div>
                        {item.notes && <p>{item.notes}</p>}
                      </div>
                    }
                  />
                );
              })}
            </MobileCatalogReferenceList>
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
          <section className="rates-reference-card rates-material-pricing-card">
            <header>
              <div><strong>Standard material pricing</strong><small>{materialPricingRows.length} active pricing level{materialPricingRows.length === 1 ? '' : 's'}</small></div>
              <span>Supplier colors and slab variants now live in Materials. This page only owns the pricing policy.</span>
            </header>
            <MobileCatalogReferenceList
              label="Standard material price levels"
              empty={!materialPricingRows.length}
              emptyMessage="No active material pricing levels match this search."
              resetLabel="View all rates"
              onReset={() => {
                setQuery(''); selectCategory('all'); clearReferenceFilters();
              }}
            >
              {materialPricingRows.map((rule) => {
                const expanded = expandedLevelId === rule.id;
                return (
                  <MobileCatalogReferenceCard
                    key={rule.id}
                    title={rule.label}
                    subtitle="Standard material level"
                    price={`${money.format(rule.customerRate)}/SF`}
                    priceAriaLabel={`Customer material price ${money.format(rule.customerRate)} per SF`}
                    priceMeta="Customer price"
                    expanded={expanded}
                    onToggle={() => setExpandedLevelId(expanded ? null : rule.id)}
                    details={
                      <div className="rates-mobile-price-details">
                        <div><span>Cost ceiling</span><strong>{rule.maxMaterialCost === undefined ? 'No ceiling' : `${money.format(rule.maxMaterialCost)}/SF`}</strong></div>
                        <div><span>Cost band</span><strong>{materialLevelCostBand(guide.rules, rule)}</strong></div>
                      </div>
                    }
                  />
                );
              })}
            </MobileCatalogReferenceList>
            <div className="rates-reference-table-wrap">
              <table className="rates-reference-table rates-material-pricing-table">
                <thead><tr><th>Level</th><th>Material cost ceiling</th><th>Standard customer price</th><th>Meaning</th></tr></thead>
                <tbody>
                  {materialPricingRows.map((rule) => (
                    <tr key={rule.id}>
                      <td className="rates-reference-item"><strong>{rule.label}</strong><small>Standard material level</small></td>
                      <td className="number">{rule.maxMaterialCost === undefined ? 'No ceiling' : `${money.format(rule.maxMaterialCost)}/SF cost`}</td>
                      <td className="rates-reference-sell"><strong>{money.format(rule.customerRate)}/SF</strong><small>Customer material rate</small></td>
                      <td>{materialLevelCostBand(guide.rules, rule)}</td>
                    </tr>
                  ))}
                  {!materialPricingRows.length && <tr><td colSpan={4}><div className="rates-reference-empty">No active material pricing levels match this search.</div></td></tr>}
                </tbody>
              </table>
            </div>
            <footer className="rates-material-pricing-footer">
              <strong>Premium slab review</strong>
              <span>Above {money.format(guide.slabPricingThresholdCostPerSf)}/SF material cost, SalesShop switches from standard levels to actual slab cost × {guide.slabPricingMultiplier}.</span>
            </footer>
          </section>
        )}
      </div>
    </main>
  );
}
