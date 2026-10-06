import { useEffect, useMemo, useState } from 'react';
import { createPricingRateItem } from '../services/pricingScheduleBuilder';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useRateBookStore } from '../store/rateBookStore';
import {
  RATE_BOOK_CATEGORIES,
  RATE_BOOK_CATEGORY_LABELS,
  RATE_BOOK_PRICING_BEHAVIOR_LABELS,
  RATE_BOOK_UNIT_LABELS,
  resolveRateBookValues,
  type RateBookCategory,
  type RateBookDivision,
  type RateBookItem,
} from '../types/rateBook';
import type { PricingBuilderProductType, PricingRateItem } from '../types/quote';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
type CategoryFilter = 'all' | RateBookCategory;

function supportedUnit(item: RateBookItem): item is RateBookItem & { unit: 'sf' | 'each' | 'flat' } {
  return item.unit === 'sf' || item.unit === 'each' || item.unit === 'flat';
}

function normalized(value: string) {
  return value.trim().toLowerCase();
}

function productTypeFor(item: RateBookItem): PricingBuilderProductType {
  const text = `${item.name} ${item.code ?? ''}`.toLowerCase();
  if (item.category === 'sink') {
    if (/vanity|oval|rect|1714|1813/.test(text)) return 'Vanity Sink';
    return 'Kitchen Sink';
  }
  if (item.category === 'fabrication-install') return 'Countertops';
  if (/splash/.test(text)) return 'Backsplash';
  if (/support|bracket/.test(text)) return 'Support';
  return item.category === 'material' ? 'Countertops' : 'Other';
}

function matchesExisting(item: RateBookItem, rates: PricingRateItem[]) {
  return rates.some((rate) => rate.sourceRateBookItemId === item.id
    || (normalized(rate.name) === normalized(item.name) && rate.unit === item.unit));
}

function snapshotRate(
  item: RateBookItem,
  division: RateBookDivision | undefined,
  stockMaterials: ReturnType<typeof useCompanySettingsStore.getState>['settings']['stockMaterials'],
) {
  if (!supportedUnit(item)) return null;
  const material = item.category === 'material';
  const stock = item.stockMaterialId ? stockMaterials.find((candidate) => candidate.id === item.stockMaterialId) : undefined;
  const resolved = resolveRateBookValues(item, division);
  const rate = createPricingRateItem(productTypeFor(item), material ? 'material-level' : 'add-on');
  rate.name = item.name;
  rate.unit = item.unit;
  rate.internalCost = resolved.internalCost;
  rate.suggestedRate = resolved.sellRate;
  rate.sourceRateBookItemId = item.id;
  rate.sourceRateBookEffectiveDate = item.effectiveDate;
  rate.sourcePricingBehavior = item.pricingBehavior;
  rate.pricingDivision = division;
  rate.rate = item.pricingBehavior === 'suggested' ? resolved.sellRate : undefined;
  rate.priceMode = rate.rate === undefined ? 'tbd' : 'priced';
  rate.customerVisible = true;

  if (material) {
    rate.materialType = stock?.materialType ?? 'Other';
    rate.level = '';
    rate.showLevelOnCustomer = false;
    rate.colorsText = stock ? stock.name : '';
    rate.colors = stock ? [stock.name] : [];
    rate.colorIds = stock ? [stock.id] : [];
    rate.detailsLayout = 'list';
  }

  return rate;
}

export function RateBookImportPanel({
  existingRates,
  division,
  onImport,
}: {
  existingRates: PricingRateItem[];
  division?: RateBookDivision;
  onImport: (rates: PricingRateItem[]) => void;
}) {
  const items = useRateBookStore((state) => state.items);
  const hydrate = useRateBookStore((state) => state.hydrate);
  const hydrated = useRateBookStore((state) => state.hydrated);
  const stockMaterials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  useEffect(() => {
    hydrate();
    void hydrateSettings();
  }, [hydrate, hydrateSettings]);

  const activeItems = useMemo(() => items.filter((item) => item.active), [items]);
  const filtered = useMemo(() => {
    const needle = normalized(query);
    return activeItems
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => !needle || normalized(`${item.name} ${item.code ?? ''} ${RATE_BOOK_CATEGORY_LABELS[item.category]}`).includes(needle))
      .sort((a, b) => RATE_BOOK_CATEGORIES.indexOf(a.category) - RATE_BOOK_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name));
  }, [activeItems, category, query]);

  const selectableCount = activeItems.filter((item) => supportedUnit(item) && !matchesExisting(item, existingRates)).length;

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importSelected = () => {
    const snapshots = [...selected]
      .map((id) => activeItems.find((item) => item.id === id))
      .filter((item): item is RateBookItem => Boolean(item))
      .map((item) => snapshotRate(item, division, stockMaterials))
      .filter((rate): rate is PricingRateItem => Boolean(rate));
    if (!snapshots.length) return;
    onImport(snapshots);
    setSelected(new Set());
    setMessage(`${snapshots.length} rate${snapshots.length === 1 ? '' : 's'} copied as editable ${division ?? 'base'} snapshot${snapshots.length === 1 ? '' : 's'}.`);
    setOpen(false);
  };

  return (
    <section className="pricing-rate-master-import">
      <header>
        <div>
          <span className="quote-control-heading">Company Rate Book</span>
          <small>{division ? `${division} overrides are applied where available.` : 'Using base company costs and suggestions.'} Imported rows remain fully editable.</small>
        </div>
        <button type="button" onClick={() => { setOpen((value) => !value); setMessage(''); }}>
          {open ? 'Close Rate Book' : '+ Add from Rate Book'}
        </button>
      </header>

      {message && <div className="pricing-rate-import-message">{message}</div>}

      {open && (
        <div className="pricing-rate-import-browser">
          <div className="pricing-rate-import-controls">
            <div className="pricing-rate-import-categories" role="tablist" aria-label="Rate Book categories">
              <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All</button>
              {RATE_BOOK_CATEGORIES.map((item) => (
                <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{RATE_BOOK_CATEGORY_LABELS[item]}</button>
              ))}
            </div>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company rates…" aria-label="Search company Rate Book" />
          </div>

          <div className="pricing-rate-import-list">
            {!hydrated && <div className="pricing-builder-empty">Opening company Rate Book…</div>}
            {hydrated && filtered.map((item) => {
              const supported = supportedUnit(item);
              const alreadyAdded = matchesExisting(item, existingRates);
              const disabled = !supported || alreadyAdded;
              const resolved = resolveRateBookValues(item, division);
              return (
                <label className={`pricing-rate-import-row ${disabled ? 'is-disabled' : ''}`} key={item.id}>
                  <input type="checkbox" checked={selected.has(item.id)} disabled={disabled} onChange={() => toggle(item.id)} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{RATE_BOOK_CATEGORY_LABELS[item.category]}{item.code ? ` · ${item.code}` : ''} · {RATE_BOOK_PRICING_BEHAVIOR_LABELS[item.pricingBehavior]}</span>
                  </div>
                  <div className="pricing-rate-import-price">
                    <strong>{resolved.sellRate === undefined ? 'No suggestion' : money.format(resolved.sellRate)}</strong>
                    <span>{resolved.internalCost === undefined ? 'Cost —' : `Cost ${money.format(resolved.internalCost)}`} · {RATE_BOOK_UNIT_LABELS[item.unit]}</span>
                  </div>
                  <small>{alreadyAdded ? 'Already in schedule' : supported ? (item.pricingBehavior === 'suggested' ? 'Copies suggested sell' : 'Copies as TBD / editable') : `${RATE_BOOK_UNIT_LABELS[item.unit]} import coming next`}</small>
                </label>
              );
            })}
            {hydrated && !filtered.length && <div className="pricing-builder-empty">No active company rates match this filter.</div>}
          </div>

          <footer>
            <span>{selectableCount} company rate{selectableCount === 1 ? '' : 's'} available to add</span>
            <button type="button" disabled={!selected.size} onClick={importSelected}>Add selected{selected.size ? ` (${selected.size})` : ''}</button>
          </footer>
        </div>
      )}
    </section>
  );
}
