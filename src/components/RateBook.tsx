import { useEffect, useMemo, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useRateBookStore } from '../store/rateBookStore';
import {
  RATE_BOOK_CATEGORIES,
  RATE_BOOK_CATEGORY_LABELS,
  RATE_BOOK_UNIT_LABELS,
  RATE_BOOK_UNITS,
  type RateBookCategory,
  type RateBookItem,
  type RateBookUnit,
} from '../types/rateBook';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
type CategoryFilter = 'all' | RateBookCategory;

function numberValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function marginLabel(item: RateBookItem) {
  if (item.sellRate === undefined || item.internalCost === undefined || item.sellRate === 0) return '—';
  const margin = ((item.sellRate - item.internalCost) / item.sellRate) * 100;
  return `${margin.toFixed(1)}%`;
}

function RateBookRow({ item }: { item: RateBookItem }) {
  const updateItem = useRateBookStore((state) => state.updateItem);
  const duplicateItem = useRateBookStore((state) => state.duplicateItem);
  const deleteItem = useRateBookStore((state) => state.deleteItem);
  const stockMaterials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const stockMaterial = item.stockMaterialId ? stockMaterials.find((candidate) => candidate.id === item.stockMaterialId) : undefined;

  return (
    <article className={`rate-book-row ${item.active ? '' : 'is-inactive'}`}>
      <div className="rate-book-row-main">
        <label className="rate-book-name"><span>Item</span><input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} /></label>
        <label><span>Code</span><input value={item.code ?? ''} onChange={(event) => updateItem(item.id, { code: event.target.value })} placeholder="Optional" /></label>
        <label><span>Category</span><select value={item.category} onChange={(event) => updateItem(item.id, { category: event.target.value as RateBookCategory })}>{RATE_BOOK_CATEGORIES.map((category) => <option value={category} key={category}>{RATE_BOOK_CATEGORY_LABELS[category]}</option>)}</select></label>
        <label><span>Unit</span><select value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value as RateBookUnit })}>{RATE_BOOK_UNITS.map((unit) => <option value={unit} key={unit}>{RATE_BOOK_UNIT_LABELS[unit]}</option>)}</select></label>
      </div>

      <div className="rate-book-row-pricing">
        <label><span>Internal cost</span><div className="rate-book-money"><span>$</span><input type="number" step="0.01" value={item.internalCost ?? ''} onChange={(event) => updateItem(item.id, { internalCost: numberValue(event.target.value) })} /></div></label>
        <label><span>Standard sell</span><div className="rate-book-money"><span>$</span><input type="number" step="0.01" value={item.sellRate ?? ''} onChange={(event) => updateItem(item.id, { sellRate: numberValue(event.target.value) })} /></div></label>
        <div className="rate-book-margin"><span>Margin</span><strong>{marginLabel(item)}</strong></div>
        <label><span>Effective</span><input type="date" value={item.effectiveDate ?? ''} onChange={(event) => updateItem(item.id, { effectiveDate: event.target.value || undefined })} /></label>
      </div>

      <div className="rate-book-row-footer">
        <label className="rate-book-notes"><span>Internal notes</span><input value={item.notes ?? ''} onChange={(event) => updateItem(item.id, { notes: event.target.value })} placeholder={stockMaterial ? `Linked to ${stockMaterial.name}` : 'Optional note'} /></label>
        {stockMaterial && <span className="rate-book-stock-link">Stock color · {stockMaterial.materialType}</span>}
        <label className="rate-book-active"><input type="checkbox" checked={item.active} onChange={(event) => updateItem(item.id, { active: event.target.checked })} /> Active</label>
        <button type="button" className="rate-book-row-action" onClick={() => duplicateItem(item.id)} title="Duplicate item">Duplicate</button>
        <button type="button" className="rate-book-row-action danger" onClick={() => { if (window.confirm(`Delete ${item.name}?`)) deleteItem(item.id); }} title="Delete item">Delete</button>
      </div>
    </article>
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
  const sellCount = items.filter((item) => item.active && item.sellRate !== undefined).length;
  const costCount = items.filter((item) => item.active && item.internalCost !== undefined).length;
  const linkedMaterials = items.filter((item) => item.active && item.category === 'material' && item.stockMaterialId).length;
  const availableStock = stockMaterials.filter((material) => material.active && !items.some((item) => item.stockMaterialId === material.id));

  const addCurrent = () => {
    const nextCategory: RateBookCategory = category === 'all' ? 'material' : category;
    addItem(nextCategory);
    setCategory(nextCategory);
  };

  const addStockMaterial = (stockId: string) => {
    const stock = stockMaterials.find((material) => material.id === stockId);
    if (!stock) return;
    addItem('material', {
      name: stock.name,
      stockMaterialId: stock.id,
      internalCost: stock.internalCost,
      unit: stock.unit,
      notes: stock.notes,
    });
    setCategory('material');
  };

  if (!hydrated) return <div className="rate-book-loading">Opening Rate Book…</div>;

  return (
    <main className="rate-book-view">
      <header className="rate-book-header">
        <div>
          <span className="board-eyebrow">Company pricing system</span>
          <h1>Rate Book</h1>
          <p>Maintain the reusable company rates that Quotes, Pricing Schedules, Programs, and eventually CAD Lite can snapshot.</p>
        </div>
        <button type="button" className="rate-book-add" onClick={addCurrent}>+ Rate item</button>
      </header>

      <section className="rate-book-stats" aria-label="Rate Book summary">
        <div><span>Active items</span><strong>{activeCount}</strong></div>
        <div><span>Sell rates set</span><strong>{sellCount}<small> / {activeCount}</small></strong></div>
        <div><span>Costs set</span><strong>{costCount}<small> / {activeCount}</small></strong></div>
        <div><span>Linked colors</span><strong>{linkedMaterials}</strong></div>
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
          <div><strong>Stock material library</strong><small>Link a rate to an existing color from Company Settings instead of creating another material record.</small></div>
          <select value="" disabled={!availableStock.length} onChange={(event) => { if (event.target.value) addStockMaterial(event.target.value); }}>
            <option value="">{availableStock.length ? 'Add stocked material…' : 'All active stock colors are linked'}</option>
            {availableStock.map((material) => <option value={material.id} key={material.id}>{material.name} · {material.materialType}</option>)}
          </select>
        </section>
      )}

      <section className="rate-book-list">
        {filtered.map((item) => <RateBookRow item={item} key={item.id} />)}
        {!filtered.length && <div className="rate-book-empty"><strong>No matching rate items</strong><span>Add an item here or change the filters above.</span></div>}
      </section>

      <footer className="rate-book-footnote">
        <strong>Snapshot rule:</strong> changing this Rate Book will not rewrite a quote that has already copied a rate. Pricing Schedule integration is the next connection point.
      </footer>
    </main>
  );
}
