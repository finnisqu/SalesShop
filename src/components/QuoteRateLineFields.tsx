import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => { hydrate(); }, [hydrate]);

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
    updateLine(quote.id, line.id, rateSnapshotLinePatch(nextSnapshot));
    setSearching(false);
    setSearch('');
  };

  const refresh = () => {
    if (!selectedItem) return;
    apply(selectedItem);
  };

  if (searching || !snapshot) {
    return (
      <div className="quote-rate-picker">
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

  const unit = RATE_BOOK_UNIT_LABELS[snapshot.unit];
  const sourceDate = displayDate(snapshot.effectiveDate);

  return (
    <div className="quote-rate-selection">
      <div className="quote-rate-selection-main">
        <span>Rate Book</span>
        <strong>{snapshot.name}</strong>
        <small>{[snapshot.code, RATE_BOOK_CATEGORY_LABELS[snapshot.category], unit].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="quote-rate-reference">
        <span>{snapshot.pricingBehavior === 'cost-reference' ? 'Internal cost' : 'Quoted rate'}</span>
        <strong>{snapshot.pricingBehavior === 'cost-reference'
          ? snapshot.internalCost === undefined ? '—' : `${money.format(snapshot.internalCost)}/${unit}`
          : snapshot.sellRate === undefined ? 'Manual' : `${money.format(snapshot.sellRate)}/${unit}`}</strong>
        <small>{sourceDate ? `Effective ${sourceDate}` : 'Current Rate Book snapshot'}</small>
      </div>
      {snapshot.pricingBehavior === 'cost-reference' && (
        <div className="quote-rate-cost-note">
          <strong>Internal reference only</strong>
          <small>Hidden from customer and excluded from quote total until you deliberately price it.</small>
        </div>
      )}
      {snapshot && !selectedItem && (
        <div className="quote-rate-change-state is-unavailable">
          <strong>Rate Book item unavailable</strong>
          <small>The quoted snapshot is retained.</small>
        </div>
      )}
      {comparison?.changed && currentSnapshot && (
        <div className="quote-rate-change-state is-changed">
          <div>
            <strong>Rate Book changed</strong>
            <small>{currentSnapshot.sellRate !== undefined
              ? `Now ${money.format(currentSnapshot.sellRate)}/${RATE_BOOK_UNIT_LABELS[currentSnapshot.unit]}`
              : currentSnapshot.internalCost !== undefined
                ? `Current cost ${money.format(currentSnapshot.internalCost)}/${RATE_BOOK_UNIT_LABELS[currentSnapshot.unit]}`
                : 'Current rate needs review'}</small>
          </div>
          <button type="button" onClick={refresh}>Update quote snapshot</button>
        </div>
      )}
      <button type="button" className="quote-rate-change" onClick={() => { setSearch(''); setSearching(true); }}>Change</button>
    </div>
  );
}
