import { useEffect, useMemo, useState } from 'react';
import {
  compareQuoteSinkSnapshot,
  createQuoteSinkSnapshot,
  sinkSnapshotLinePatch,
} from '../services/quoteSinkSnapshot';
import { useQuoteStore } from '../store/quoteStore';
import { useSinkCatalogStore } from '../store/sinkCatalogStore';
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

export function QuoteSinkLineFields({ quoteId, line }: { quoteId: string; line: QuoteLine }) {
  const models = useSinkCatalogStore((state) => state.models);
  const hydrate = useSinkCatalogStore((state) => state.hydrate);
  const updateLine = useQuoteStore((state) => state.updateLine);
  const snapshot = line.sinkReference?.snapshot;
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(!snapshot);

  useEffect(() => { void hydrate(); }, [hydrate]);

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
    updateLine(quoteId, line.id, { ...patch, quantity: line.quantity ?? 1 });
    setSearch('');
    setSearching(false);
  };

  const chooseVariant = (variantId: string) => {
    if (!selectedModel) return;
    const variant = selectedModel.variants.find((candidate) => candidate.id === variantId && candidate.active);
    if (variant) apply(selectedModel, variant);
  };

  if (searching || !snapshot) {
    return (
      <div className="quote-sink-picker">
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

  const activeVariants = (selectedModel?.variants ?? []).filter((variant) => variant.active);
  const sourceDate = displayDate(snapshot.effectiveDate);

  return (
    <div className="quote-sink-selection">
      <div className="quote-sink-selection-main">
        <span>Sink catalog</span>
        <strong>{[snapshot.brand, snapshot.sinkModelName].filter(Boolean).join(' ')}</strong>
        <small>{[
          snapshot.modelCode,
          SINK_CATEGORY_LABELS[snapshot.category],
          snapshot.widthIn && snapshot.depthIn ? `${snapshot.widthIn} × ${snapshot.depthIn} in` : undefined,
        ].filter(Boolean).join(' · ')}</small>
      </div>

      {selectedModel && activeVariants.length > 1 && (
        <label className="quote-sink-variant-select">
          <span>Variant</span>
          <select value={selectedVariant?.id ?? snapshot.variantId} onChange={(event) => chooseVariant(event.target.value)}>
            {activeVariants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}{variant.ada ? ' · ADA' : ''}{variant.sellPrice === undefined ? ' · Unpriced' : ` · ${money.format(variant.sellPrice)}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="quote-sink-reference">
        <span>Quoted product</span>
        <strong>{snapshot.variantLabel}</strong>
        <small>{[
          SINK_CONFIGURATION_LABELS[snapshot.configuration],
          snapshot.ada ? 'ADA' : undefined,
          snapshot.variantCode,
        ].filter(Boolean).join(' · ')}</small>
      </div>

      <div className="quote-sink-price-reference">
        <span>Catalog snapshot</span>
        <strong>{snapshot.sellPrice === undefined ? 'Unpriced' : money.format(snapshot.sellPrice)}</strong>
        <small>{snapshot.internalCost === undefined ? 'Private cost —' : `Private cost ${money.format(snapshot.internalCost)}`}{sourceDate ? ` · effective ${sourceDate}` : ''}</small>
      </div>

      {!selectedModel || !selectedVariant ? (
        <div className="quote-sink-change-state is-unavailable">
          <strong>Catalog variant unavailable</strong>
          <small>The quoted sink snapshot is retained and unchanged.</small>
        </div>
      ) : null}

      {comparison?.changed && currentSnapshot && selectedModel && selectedVariant && (
        <div className="quote-sink-change-state is-changed">
          <div>
            <strong>Sink catalog changed</strong>
            <small>{currentSnapshot.sellPrice === undefined
              ? 'Current variant is unpriced.'
              : `Current sell price ${money.format(currentSnapshot.sellPrice)}.`}</small>
          </div>
          <button type="button" onClick={() => apply(selectedModel, selectedVariant)}>Update quote snapshot</button>
        </div>
      )}

      {snapshot.sellPrice === undefined && (
        <div className="quote-sink-change-state is-unpriced">
          <strong>Catalog price not set</strong>
          <small>Enter a customer rate on this quote or price the variant in Sinks before sending.</small>
        </div>
      )}

      <button type="button" className="quote-sink-change" onClick={() => { setSearch(''); setSearching(true); }}>Change sink</button>
    </div>
  );
}
