import { useEffect, useMemo, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useRateBookStore } from '../store/rateBookStore';
import {
  RATE_BOOK_CATEGORIES,
  RATE_BOOK_CATEGORY_LABELS,
  RATE_BOOK_DIVISIONS,
  RATE_BOOK_PRICING_BEHAVIORS,
  RATE_BOOK_PRICING_BEHAVIOR_LABELS,
  RATE_BOOK_UNIT_LABELS,
  RATE_BOOK_UNITS,
  resolveRateBookValues,
  type RateBookCategory,
  type RateBookItem,
  type RateBookPricingBehavior,
  type RateBookUnit,
} from '../types/rateBook';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
type CategoryFilter = 'all' | RateBookCategory;

function numberValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function moneyLabel(value?: number) {
  return value === undefined ? '—' : money.format(value);
}

function marginLabel(item: RateBookItem) {
  if (item.sellRate === undefined || item.internalCost === undefined || item.sellRate === 0) return '—';
  const margin = ((item.sellRate - item.internalCost) / item.sellRate) * 100;
  return `${margin.toFixed(1)}%`;
}

function RateBookDetails({ item }: { item: RateBookItem }) {
  const setDivisionOverride = useRateBookStore((state) => state.setDivisionOverride);
  const setCurrentHistoryNote = useRateBookStore((state) => state.setCurrentHistoryNote);
  const updateItem = useRateBookStore((state) => state.updateItem);
  const duplicateItem = useRateBookStore((state) => state.duplicateItem);
  const deleteItem = useRateBookStore((state) => state.deleteItem);
  const stockMaterials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const stockMaterial = item.stockMaterialId ? stockMaterials.find((candidate) => candidate.id === item.stockMaterialId) : undefined;
  const currentHistory = item.history.find((version) => version.effectiveDate === item.effectiveDate);
  const history = [...item.history].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  return (
    <div className="rate-book-detail-panel">
      <section className="rate-book-override-panel">
        <header><div><strong>Division overrides</strong><small>Blank cells inherit the base company rate above.</small></div></header>
        <div className="rate-book-override-grid">
          <span className="is-head">Division</span><span className="is-head">Internal cost</span><span className="is-head">Suggested sell</span>
          {RATE_BOOK_DIVISIONS.map((division) => {
            const override = item.divisionOverrides.find((candidate) => candidate.division === division);
            const resolved = resolveRateBookValues(item, division);
            return (
              <div className="rate-book-override-row" key={division}>
                <strong>{division}</strong>
                <label><span>$</span><input type="number" step="0.01" value={override?.internalCost ?? ''} placeholder={item.internalCost?.toFixed(2) ?? '—'} onChange={(event) => setDivisionOverride(item.id, division, { internalCost: numberValue(event.target.value) })} /></label>
                <label><span>$</span><input type="number" step="0.01" value={override?.sellRate ?? ''} placeholder={item.sellRate?.toFixed(2) ?? '—'} onChange={(event) => setDivisionOverride(item.id, division, { sellRate: numberValue(event.target.value) })} /></label>
                <small>{moneyLabel(resolved.internalCost)} cost · {moneyLabel(resolved.sellRate)} suggested</small>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rate-book-history-panel">
        <header><div><strong>Rate history</strong><small>One version per effective date. Change the effective date before entering a new annual rate.</small></div></header>
        <label className="rate-book-history-note"><span>Note for {item.effectiveDate || 'current version'}</span><input value={currentHistory?.note ?? ''} onChange={(event) => setCurrentHistoryNote(item.id, event.target.value)} placeholder="Supplier increase, annual update, new installer agreement…" /></label>
        <div className="rate-book-history-list">
          {history.map((version) => (
            <div className="rate-book-history-row" key={version.id}>
              <strong>{version.effectiveDate}</strong>
              <span>{moneyLabel(version.internalCost)} cost</span>
              <span>{moneyLabel(version.sellRate)} suggested</span>
              <span>{RATE_BOOK_PRICING_BEHAVIOR_LABELS[version.pricingBehavior]}</span>
              <small>{version.divisionOverrides.length ? `${version.divisionOverrides.length} division override${version.divisionOverrides.length === 1 ? '' : 's'}` : 'Base rates only'}</small>
              {version.note && <em>{version.note}</em>}
            </div>
          ))}
        </div>
      </section>

      <section className="rate-book-row-admin">
        <label><span>Internal notes</span><input value={item.notes ?? ''} onChange={(event) => updateItem(item.id, { notes: event.target.value })} placeholder={stockMaterial ? `Linked to ${stockMaterial.name}` : 'Optional private note'} /></label>
        {stockMaterial && <span className="rate-book-stock-link">Stock color · {stockMaterial.materialType}</span>}
        <div><button type="button" onClick={() => duplicateItem(item.id)}>Duplicate</button><button type="button" className="danger" onClick={() => { if (window.confirm(`Delete ${item.name}?`)) deleteItem(item.id); }}>Delete</button></div>
      </section>
    </div>
  );
}

function RateBookSheetRow({ item, expanded, onToggle }: { item: RateBookItem; expanded: boolean; onToggle: () => void }) {
  const updateItem = useRateBookStore((state) => state.updateItem);
  const updatePricing = useRateBookStore((state) => state.updatePricing);
  return (
    <>
      <tr className={`${item.active ? '' : 'is-inactive'} ${expanded ? 'is-expanded' : ''}`}>
        <td className="rate-book-check"><input type="checkbox" checked={item.active} onChange={(event) => updateItem(item.id, { active: event.target.checked })} aria-label={`${item.name} active`} /></td>
        <td><select value={item.category} onChange={(event) => updateItem(item.id, { category: event.target.value as RateBookCategory })}>{RATE_BOOK_CATEGORIES.map((category) => <option value={category} key={category}>{RATE_BOOK_CATEGORY_LABELS[category]}</option>)}</select></td>
        <td className="rate-book-item-cell"><input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} /></td>
        <td><input value={item.code ?? ''} onChange={(event) => updateItem(item.id, { code: event.target.value })} placeholder="—" /></td>
        <td className="number"><input type="number" step="0.01" value={item.internalCost ?? ''} onChange={(event) => updatePricing(item.id, { internalCost: numberValue(event.target.value) })} placeholder="—" /></td>
        <td className="number"><input type="number" step="0.01" value={item.sellRate ?? ''} onChange={(event) => updatePricing(item.id, { sellRate: numberValue(event.target.value) })} placeholder="—" /></td>
        <td><select value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value as RateBookUnit })}>{RATE_BOOK_UNITS.map((unit) => <option value={unit} key={unit}>{RATE_BOOK_UNIT_LABELS[unit]}</option>)}</select></td>
        <td><select value={item.pricingBehavior} onChange={(event) => updatePricing(item.id, { pricingBehavior: event.target.value as RateBookPricingBehavior })}>{RATE_BOOK_PRICING_BEHAVIORS.map((behavior) => <option value={behavior} key={behavior}>{RATE_BOOK_PRICING_BEHAVIOR_LABELS[behavior]}</option>)}</select></td>
        <td className="rate-book-margin-cell">{marginLabel(item)}</td>
        <td><input type="date" value={item.effectiveDate ?? ''} onChange={(event) => updatePricing(item.id, { effectiveDate: event.target.value || undefined })} /></td>
        <td className="rate-book-detail-cell"><button type="button" onClick={onToggle}>{expanded ? 'Close' : `${item.divisionOverrides.length || item.history.length > 1 ? 'Details' : 'Details'}`}</button></td>
      </tr>
      {expanded && <tr className="rate-book-detail-row"><td colSpan={11}><RateBookDetails item={item} /></td></tr>}
    </>
  );
}

export function RateBook() {
  const items = useRateBookStore((state) => state.items);
  const hydrated = useRateBookStore((state) => state.hydrated);
  const hydrate = useRateBookStore((state) => state.hydrate);
  const addItem = useRateBookStore((state) => state.addItem);
  const stockMaterials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    void hydrateSettings();
  }, [hydrate, hydrateSettings]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => showInactive || item.active)
      .filter((item) => !needle || `${item.name} ${item.code ?? ''} ${item.notes ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => RATE_BOOK_CATEGORIES.indexOf(a.category) - RATE_BOOK_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name));
  }, [items, category, query, showInactive]);

  const activeCount = items.filter((item) => item.active).length;
  const referenceOnlyCount = items.filter((item) => item.active && item.pricingBehavior !== 'suggested').length;
  const overrideCount = items.filter((item) => item.active && item.divisionOverrides.length).length;
  const historyCount = items.reduce((total, item) => total + item.history.length, 0);
  const availableStock = stockMaterials.filter((material) => material.active && !items.some((item) => item.stockMaterialId === material.id));

  const addCurrent = () => {
    const nextCategory: RateBookCategory = category === 'all' ? 'material' : category;
    const id = addItem(nextCategory);
    setCategory(nextCategory);
    setExpandedId(id);
  };

  const addStockMaterial = (stockId: string) => {
    const stock = stockMaterials.find((material) => material.id === stockId);
    if (!stock) return;
    const id = addItem('material', {
      name: stock.name,
      stockMaterialId: stock.id,
      internalCost: stock.internalCost,
      unit: stock.unit,
      notes: stock.notes,
      pricingBehavior: 'cost-reference',
    });
    setCategory('material');
    setExpandedId(id);
  };

  if (!hydrated) return <div className="rate-book-loading">Opening Rate Book…</div>;

  return (
    <main className="rate-book-view">
      <header className="rate-book-header">
        <div>
          <span className="board-eyebrow">Company pricing system</span>
          <h1>Rate Book</h1>
          <p>Company costs and suggested rates are references—not rules. Salespeople can override them, use cost only, or bypass the Rate Book entirely on a quote.</p>
        </div>
        <button type="button" className="rate-book-add" onClick={addCurrent}>+ Rate row</button>
      </header>

      <section className="rate-book-stats" aria-label="Rate Book summary">
        <div><span>Active</span><strong>{activeCount}</strong></div>
        <div><span>Reference/manual</span><strong>{referenceOnlyCount}</strong></div>
        <div><span>Division overrides</span><strong>{overrideCount}</strong></div>
        <div><span>Price versions</span><strong>{historyCount}</strong></div>
      </section>

      <section className="rate-book-controls">
        <div className="rate-book-category-switch" role="tablist" aria-label="Rate Book categories">
          <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All</button>
          {RATE_BOOK_CATEGORIES.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{RATE_BOOK_CATEGORY_LABELS[item]}</button>)}
        </div>
        <div className="rate-book-filter-row">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rates…" aria-label="Search Rate Book" />
          <label><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Show inactive</label>
        </div>
      </section>

      {category === 'material' && (
        <section className="rate-book-material-source">
          <div><strong>Stock material library</strong><small>Bring an existing company color into the Rate Book as a cost-reference row.</small></div>
          <select value="" disabled={!availableStock.length} onChange={(event) => { if (event.target.value) addStockMaterial(event.target.value); }}>
            <option value="">{availableStock.length ? 'Add stocked material…' : 'All active stock colors are linked'}</option>
            {availableStock.map((material) => <option value={material.id} key={material.id}>{material.name} · {material.materialType}</option>)}
          </select>
        </section>
      )}

      <section className="rate-book-sheet-shell">
        <div className="rate-book-sheet-scroll">
          <table className="rate-book-sheet">
            <thead><tr><th>On</th><th>Category</th><th>Item</th><th>Code</th><th>Cost</th><th>Suggested sell</th><th>Unit</th><th>Pricing behavior</th><th>Margin</th><th>Effective</th><th>Context</th></tr></thead>
            <tbody>
              {filtered.map((item) => <RateBookSheetRow item={item} key={item.id} expanded={expandedId === item.id} onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)} />)}
              {!filtered.length && <tr><td colSpan={11}><div className="rate-book-empty"><strong>No matching rate rows</strong><span>Add a row or change the filters above.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="rate-book-footnote"><strong>Pricing rule:</strong> Rate Book → context-adjusted reference → quote snapshot → salesperson chooses the actual customer price.</footer>
    </main>
  );
}
