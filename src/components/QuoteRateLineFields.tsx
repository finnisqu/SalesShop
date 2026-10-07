import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RATE_BOOK_CATEGORY_LABELS,
  RATE_BOOK_UNIT_LABELS,
  type RateBookCategory,
  type RateBookItem,
} from '../types/rateBook';
import type { Quote, QuoteLine } from '../types/quote';
import {
  compareQuoteRateSnapshot,
  createQuoteRateSnapshot,
  rateSnapshotLinePatch,
} from '../services/quoteRateSnapshot';
import { useQuoteStore } from '../store/quoteStore';
import { useRateBookStore } from '../store/rateBookStore';
import { compatibleAreaScopeFields } from '../services/quoteAreaScope';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const allowedCategories: RateBookCategory[] = ['fabrication-install', 'sink', 'add-on'];

function displayDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function searchText(item: RateBookItem) {
  return [item.name, item.code, item.category, item.unit, item.notes].filter(Boolean).join(' ').toLowerCase();
}

function priceLabel(item: RateBookItem, quote: Quote) {
  const snapshot = createQuoteRateSnapshot(item, quote.pricingDivision);
  if (snapshot.sellRate !== undefined) return `${money.format(snapshot.sellRate)}/${RATE_BOOK_UNIT_LABELS[item.unit]}`;
  if (snapshot.internalCost !== undefined) return `Cost ${money.format(snapshot.internalCost)}/${RATE_BOOK_UNIT_LABELS[item.unit]}`;
  return item.pricingBehavior === 'manual' ? 'Manual price' : 'No current rate';
}

export function QuoteRateLineFields({ quote, line }: { quote: Quote; line: QuoteLine }) {
  const items = useRateBookStore((state) => state.items);
  const hydrate = useRateBookStore((state) => state.hydrate);
  const updateLine = useQuoteStore((state) => state.updateLine);
  const snapshot = line.rateReference?.snapshot;
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(!snapshot);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!searching) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (pickerRef.current?.contains(event.target as Node)) return;
      setSearching(false);
      setSearch('');
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [searching]);

  useEffect(() => {
    const collapse = () => {
      setSearching(false);
      setSearch('');
    };
    const collapseLine = (event: Event) => {
      const detail = (event as CustomEvent<{ lineId?: string }>).detail;
      if (detail?.lineId !== line.id) return;
      collapse();
    };
    window.addEventListener('sales-shop:quote-collapse-all', collapse);
    window.addEventListener('sales-shop:quote-collapse-line', collapseLine);
    return () => {
      window.removeEventListener('sales-shop:quote-collapse-all', collapse);
      window.removeEventListener('sales-shop:quote-collapse-line', collapseLine);
    };
  }, [line.id, snapshot]);

  const activeItems = useMemo(() => items.filter((item) => item.active && allowedCategories.includes(item.category)), [items]);
  const selectedItem = line.rateReference?.rateBookItemId
    ? activeItems.find((item) => item.id === line.rateReference?.rateBookItemId)
    : undefined;
  const currentSnapshot = selectedItem ? createQuoteRateSnapshot(selectedItem, quote.pricingDivision) : undefined;
  const comparison = snapshot && currentSnapshot ? compareQuoteRateSnapshot(snapshot, currentSnapshot) : undefined;

  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return activeItems
      .filter((item) => !needle || searchText(item).includes(needle))
      .slice()
      .sort((a, b) => allowedCategories.indexOf(a.category) - allowedCategories.indexOf(b.category) || a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [activeItems, search]);

  const apply = (item: RateBookItem) => {
    const nextSnapshot = createQuoteRateSnapshot(item, quote.pricingDivision);
    const patch = rateSnapshotLinePatch(nextSnapshot);
    const nextLine = { ...line, ...patch } as QuoteLine;
    const quantitySource = line.quantitySource && compatibleAreaScopeFields(nextLine).includes(line.quantitySource.field)
      ? line.quantitySource
      : undefined;
    updateLine(quote.id, line.id, { ...patch, quantitySource });
    setSearching(false);
    setSearch('');
  };

  const refresh = () => {
    if (!selectedItem) return;
    apply(selectedItem);
  };

  if (searching) {
    return (
      <div className="quote-rate-picker quote-catalog-popover" ref={pickerRef}>
        {snapshot && <div className="quote-picker-current">
          <div>
            <span>Current rate</span>
            <strong>{snapshot.name}</strong>
            <small>{[
              snapshot.code,
              RATE_BOOK_CATEGORY_LABELS[snapshot.category],
              RATE_BOOK_UNIT_LABELS[snapshot.unit],
            ].filter(Boolean).join(' · ')}</small>
          </div>
          {comparison?.changed && currentSnapshot && selectedItem && <button type="button" onClick={refresh}>Update snapshot</button>}
        </div>}
        <div className="quote-rate-search-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Rates: fabrication, sink, splash…" aria-label="Search Rate Book" />
          {snapshot && <button type="button" onClick={() => setSearching(false)}>Cancel</button>}
        </div>
        <div className="quote-rate-results">
          {results.map((item) => (
            <button type="button" key={item.id} onClick={() => apply(item)}>
              <span>
                <strong>{item.name}</strong>
                <small>{[item.code, RATE_BOOK_CATEGORY_LABELS[item.category]].filter(Boolean).join(' · ')}</small>
              </span>
              <span>
                <b>{priceLabel(item, quote)}</b>
                <small>{item.pricingBehavior === 'cost-reference' ? 'Internal cost reference' : item.pricingBehavior === 'manual' ? 'Manual selling price' : 'Suggested sell rate'}</small>
              </span>
            </button>
          ))}
          {!results.length && <div className="quote-rate-empty">No matching active Rate Book items.</div>}
        </div>
      </div>
    );
  }

  const unit = snapshot ? RATE_BOOK_UNIT_LABELS[snapshot.unit] : undefined;
  const sourceDate = snapshot ? displayDate(snapshot.effectiveDate) : undefined;

  return (
    <div className="quote-rate-selection quote-database-result">
      <div className="quote-rate-selection-main">
        <div className="quote-product-name-row">
          <strong>{snapshot?.name ?? 'Rate'}</strong>
          <button type="button" className="quote-product-pencil" onClick={() => {
            window.dispatchEvent(new CustomEvent('sales-shop:quote-close-pricing', { detail: { lineId: line.id } }));
            setSearch('');
            setSearching(true);
          }} title="Change rate" aria-label="Change rate">✎</button>
        </div>
        {snapshot && <small>{[snapshot.code, RATE_BOOK_CATEGORY_LABELS[snapshot.category], unit].filter(Boolean).join(' · ')}</small>}
      </div>

      <div className={`quote-rate-reference ${snapshot ? '' : 'is-empty'}`}>
        {snapshot ? (
          <>
            <span>{snapshot.pricingBehavior === 'cost-reference' ? 'Internal cost' : 'Quoted rate'}</span>
            <strong>{snapshot.pricingBehavior === 'cost-reference'
              ? snapshot.internalCost === undefined ? '—' : `${money.format(snapshot.internalCost)}/${unit}`
              : snapshot.sellRate === undefined ? 'Manual' : `${money.format(snapshot.sellRate)}/${unit}`}</strong>
            <small>{sourceDate ? `Effective ${sourceDate}` : 'Frozen quote snapshot'}</small>
          </>
        ) : (
          <>
            <strong>Choose rate</strong>
            <small>Rate Book</small>
          </>
        )}
      </div>

      {snapshot?.pricingBehavior === 'cost-reference' && <span className="quote-source-status">Internal only</span>}
      {snapshot && !selectedItem && <span className="quote-source-status is-warning">Source unavailable</span>}
      {snapshot && comparison?.changed && currentSnapshot && <span className="quote-source-status">Source updated</span>}
    </div>
  );
}
