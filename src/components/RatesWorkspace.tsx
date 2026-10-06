import { useEffect, useMemo, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { useRateBookStore } from '../store/rateBookStore';
import { resolveMaterialLevel, resolveNonStockMaterialPrice } from '../types/materialLevelGuide';
import {
  RATE_BOOK_CATEGORY_LABELS,
  RATE_BOOK_PRICING_BEHAVIOR_LABELS,
  RATE_BOOK_UNIT_LABELS,
  type RateBookCategory,
  type RateBookItem,
} from '../types/rateBook';
import { resolveStockMaterialCostReference, type StockMaterial } from '../types/settings';
import { RateBook } from './RateBook';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
type ReferenceCategory = 'all' | RateBookCategory;

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

export function RatesWorkspace() {
  const items = useRateBookStore((state) => state.items);
  const hydrated = useRateBookStore((state) => state.hydrated);
  const hydrateRates = useRateBookStore((state) => state.hydrate);
  const settings = useCompanySettingsStore((state) => state.settings);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const guide = useMaterialLevelGuideStore((state) => state.guide);
  const hydrateGuide = useMaterialLevelGuideStore((state) => state.hydrate);
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState<ReferenceCategory>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    hydrateRates();
    void hydrateSettings();
    hydrateGuide();
  }, [hydrateRates, hydrateSettings, hydrateGuide]);

  const rateRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => item.active && item.category !== 'material')
      .filter((item) => category === 'all' || category === 'material' || item.category === category)
      .filter((item) => !needle || `${item.name} ${item.code ?? ''} ${RATE_BOOK_CATEGORY_LABELS[item.category]} ${item.notes ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => RATE_BOOK_CATEGORY_LABELS[a.category].localeCompare(RATE_BOOK_CATEGORY_LABELS[b.category]) || a.name.localeCompare(b.name));
  }, [items, category, query]);

  const materialRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return settings.stockMaterials
      .filter((material) => material.active)
      .filter((material) => !needle || `${material.name} ${material.supplier ?? ''} ${material.brand ?? ''} ${material.collection ?? ''} ${material.sku ?? ''} ${material.materialType} ${material.stockProgram ? 'stock' : 'non-stock'}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.stockProgram) - Number(a.stockProgram) || (a.supplier ?? '').localeCompare(b.supplier ?? '') || a.name.localeCompare(b.name));
  }, [settings.stockMaterials, query]);

  const showingMaterials = category === 'material';

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
          <button type="button" className={editing ? 'rates-done-button' : 'rates-edit-button'} onClick={() => setEditing((value) => !value)}>{editing ? 'Done editing' : 'Edit pricing'}</button>
        </div>
      </header>

      {editing ? (
        <div className="rates-editor-host"><RateBook /></div>
      ) : (
        <>
          <section className="rates-reference-controls">
            <div className="rates-reference-tabs" role="tablist" aria-label="Rate reference categories">
              <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All rates</button>
              <button type="button" className={category === 'fabrication-install' ? 'active' : ''} onClick={() => setCategory('fabrication-install')}>Fab & Install</button>
              <button type="button" className={category === 'sink' ? 'active' : ''} onClick={() => setCategory('sink')}>Sinks</button>
              <button type="button" className={category === 'add-on' ? 'active' : ''} onClick={() => setCategory('add-on')}>Add-ons</button>
              <button type="button" className={category === 'material' ? 'active' : ''} onClick={() => setCategory('material')}>Materials</button>
            </div>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={showingMaterials ? 'Search colors, suppliers, brands…' : 'Search rates, codes, categories…'} aria-label="Search pricing reference" />
          </section>

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
                    {!rateRows.length && <tr><td colSpan={7}><div className="rates-reference-empty">No active rates match this search.</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="rates-reference-card rates-material-reference-card">
              <header><div><strong>Material pricing reference</strong><small>Supplier catalog and STOCK program at a glance</small></div><span>Levels apply only to STOCK colors.</span></header>
              <div className="rates-reference-table-wrap">
                <table className="rates-reference-table rates-material-reference-table">
                  <thead><tr><th>Color</th><th>Program</th><th>Supplier</th><th>Type</th><th>Cost reference</th><th>Pricing guide</th><th>Default spec</th><th>Product</th></tr></thead>
                  <tbody>
                    {materialRows.map((material) => {
                      const reference = resolveStockMaterialCostReference(material);
                      const stockRate = resolveMaterialLevel(guide.rules, reference.costPerSf, material.stockProgram ? material.builderLevelId : undefined);
                      const nonStockRate = resolveNonStockMaterialPrice(guide, reference.costPerSf);
                      const customerRate = material.stockProgram ? stockRate?.customerRate : nonStockRate.customerRate;
                      const guideLabel = material.stockProgram ? stockRate?.rule.label ?? 'Needs Level' : nonStockRate.basis;
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
                          <td className="rates-reference-sell"><strong>{customerRate === undefined ? '—' : `${money.format(customerRate)}/SF`}</strong><small>{guideLabel}</small></td>
                          <td>{spec || 'No structured spec'}</td>
                          <td className="rates-product-links">{links.length ? links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}</a>) : <span>—</span>}</td>
                        </tr>
                      );
                    })}
                    {!materialRows.length && <tr><td colSpan={8}><div className="rates-reference-empty">No active materials match this search.</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
