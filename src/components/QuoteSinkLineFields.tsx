import { useEffect, useMemo, useRef, useState } from 'react';
import {
  compareQuoteSinkSnapshot,
  createQuoteSinkSnapshot,
  sinkSnapshotLinePatch,
} from '../services/quoteSinkSnapshot';
import { useQuoteStore } from '../store/quoteStore';
import { useSinkCatalogStore } from '../store/sinkCatalogStore';
import { compatibleAreaScopeFields } from '../services/quoteAreaScope';
import {
  SINK_CATEGORY_LABELS,
  SINK_CONFIGURATION_LABELS,
  defaultSinkVariant,
  sinkVariantDisplayName,
  type SinkModel,
  type SinkVariant,
} from '../types/sink';
import type { QuoteLine } from '../types/quote';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function displayDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function searchText(model: SinkModel, variant: SinkVariant) {
  return [
    model.name,
    model.modelCode,
    model.brand,
    model.supplier,
    model.category,
    SINK_CATEGORY_LABELS[model.category],
    model.mountType,
    model.material,
    variant.label,
    variant.code,
    variant.configuration,
    SINK_CONFIGURATION_LABELS[variant.configuration],
    variant.ada ? 'ada accessible' : '',
  ].filter(Boolean).join(' ').toLowerCase();
}

function variantMeta(model: SinkModel, variant: SinkVariant) {
  return [
    SINK_CONFIGURATION_LABELS[variant.configuration],
    variant.ada ? 'ADA' : undefined,
    variant.code,
    SINK_CATEGORY_LABELS[model.category],
  ].filter(Boolean).join(' · ');
}

function priceLabel(variant: SinkVariant) {
  return variant.sellPrice === undefined ? 'Unpriced' : money.format(variant.sellPrice);
}

export function QuoteSinkLineFields({ quoteId, line, editSignal = 0 }: { quoteId: string; line: QuoteLine; editSignal?: number }) {
  const models = useSinkCatalogStore((state) => state.models);
  const hydrate = useSinkCatalogStore((state) => state.hydrate);
  const updateLine = useQuoteStore((state) => state.updateLine);
  const snapshot = line.sinkReference?.snapshot;
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(!snapshot);
  const lastEditSignal = useRef(editSignal);

  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => {
    if (editSignal === lastEditSignal.current) return;
    lastEditSignal.current = editSignal;
    setSearch('');
    setSearching(true);
  }, [editSignal]);

  useEffect(() => {
    const collapse = () => {
      if (!snapshot) return;
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

  const activeModels = useMemo(() => models.filter((model) => model.active), [models]);
  const selectedModel = line.sinkReference?.sinkModelId
    ? activeModels.find((model) => model.id === line.sinkReference?.sinkModelId)
    : undefined;
  const selectedVariant = selectedModel && line.sinkReference?.variantId
    ? selectedModel.variants.find((variant) => variant.id === line.sinkReference?.variantId && variant.active)
    : selectedModel ? defaultSinkVariant(selectedModel) : undefined;

  const currentSnapshot = selectedModel && selectedVariant
    ? createQuoteSinkSnapshot(selectedModel, selectedVariant)
    : undefined;
  const comparison = snapshot && currentSnapshot
    ? compareQuoteSinkSnapshot(snapshot, currentSnapshot)
    : undefined;

  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return activeModels
      .flatMap((model) => model.variants
        .filter((variant) => variant.active)
        .map((variant) => ({ model, variant })))
      .filter(({ model, variant }) => !needle || searchText(model, variant).includes(needle))
      .sort((a, b) => a.model.name.localeCompare(b.model.name)
        || Number(a.variant.ada) - Number(b.variant.ada)
        || a.variant.label.localeCompare(b.variant.label))
      .slice(0, 24);
  }, [activeModels, search]);

  const apply = (model: SinkModel, variant: SinkVariant) => {
    const nextSnapshot = createQuoteSinkSnapshot(model, variant);
    const patch = sinkSnapshotLinePatch(nextSnapshot);
    const nextLine = { ...line, ...patch } as QuoteLine;
    const quantitySource = line.quantitySource && compatibleAreaScopeFields(nextLine).includes(line.quantitySource.field)
      ? line.quantitySource
      : undefined;
    updateLine(quoteId, line.id, { ...patch, quantity: line.quantity ?? 1, quantitySource });
    setSearch('');
    setSearching(false);
  };

  if (searching || !snapshot) {
    return (
      <div className="quote-sink-picker">
        {snapshot && <div className="quote-picker-current">
          <div>
            <span>Current sink</span>
            <strong>{[snapshot.brand, snapshot.sinkModelName, snapshot.variantLabel].filter(Boolean).join(' · ')}</strong>
            <small>{[
              SINK_CONFIGURATION_LABELS[snapshot.configuration],
              snapshot.ada ? 'ADA' : undefined,
              snapshot.variantCode,
              snapshot.sellPrice === undefined ? 'Unpriced' : money.format(snapshot.sellPrice),
            ].filter(Boolean).join(' · ')}</small>
          </div>
          {comparison?.changed && currentSnapshot && selectedModel && selectedVariant && (
            <button type="button" onClick={() => apply(selectedModel, selectedVariant)}>Update snapshot</button>
          )}
        </div>}
        <div className="quote-sink-search-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Sinks: 3218, 50/50, ADA, vanity…"
            aria-label="Search sink catalog"
          />
          {snapshot && <button type="button" onClick={() => setSearching(false)}>Cancel</button>}
        </div>
        <div className="quote-sink-results">
          {results.map(({ model, variant }) => (
            <button type="button" key={variant.id} onClick={() => apply(model, variant)}>
              <span>
                <strong>{sinkVariantDisplayName(model, variant)}</strong>
                <small>{variantMeta(model, variant)}</small>
              </span>
              <span>
                <b>{priceLabel(variant)}</b>
                <small>{variant.internalCost === undefined ? 'Cost not entered' : `Cost ${money.format(variant.internalCost)}`}</small>
              </span>
            </button>
          ))}
          {!results.length && <div className="quote-sink-empty">No matching active sink variants.</div>}
        </div>
      </div>
    );
  }

  const sourceDate = displayDate(snapshot.effectiveDate);

  return (
    <div className="quote-sink-selection quote-database-result">
      <div className="quote-sink-selection-main">
        <strong>{[snapshot.brand, snapshot.sinkModelName].filter(Boolean).join(' ')}</strong>
        <small>{[
          snapshot.variantLabel,
          SINK_CONFIGURATION_LABELS[snapshot.configuration],
          snapshot.ada ? 'ADA' : undefined,
          snapshot.variantCode,
        ].filter(Boolean).join(' · ')}</small>
      </div>

      <div className="quote-sink-price-reference">
        <span>Catalog price</span>
        <strong>{snapshot.sellPrice === undefined ? 'Unpriced' : money.format(snapshot.sellPrice)}</strong>
        <small>{sourceDate ? `Effective ${sourceDate}` : 'Frozen quote snapshot'}</small>
      </div>

      {(!selectedModel || !selectedVariant) && <span className="quote-source-status is-warning">Source unavailable</span>}
      {comparison?.changed && selectedModel && selectedVariant && <span className="quote-source-status">Source updated</span>}
    </div>
  );
}
