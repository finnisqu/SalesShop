import { useEffect, useMemo, useRef, useState } from 'react';
import {
  compareQuoteSinkSnapshot,
  createQuoteSinkSnapshot,
} from '../services/quoteSinkSnapshot';
import { useQuoteStore } from '../store/quoteStore';
import { useSinkCatalogStore } from '../store/sinkCatalogStore';
import {
 catalogSellingOverride,quoteSinkSourcePatch,quoteSinkCatalogPricePatch,
} from '../services/quoteCatalogLineEditing';
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
  const [sourceError,setSourceError]=useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void hydrate(); }, [hydrate]);

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

  const activeModels = useMemo(() => models.filter((model) => model.active), [models]);
  const selectedModel = line.sinkReference?.sinkModelId
    ? activeModels.find((model) => model.id === line.sinkReference?.sinkModelId)
    : undefined;
  // Legacy quotes may carry a snapshot ID but no top-level variant ID.
  // Never silently refresh an existing selection to the default variant.
  const selectedVariantId=line.sinkReference?.variantId??snapshot?.variantId;
  const selectedVariant=selectedModel&&selectedVariantId
    ?selectedModel.variants.find(v=>v.id===selectedVariantId&&v.active)
    :selectedModel&&!snapshot?defaultSinkVariant(selectedModel):undefined;

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
    try {
      if(!model.active||!variant.active||!model.variants.some(v=>v.id===variant.id&&v.active))
        throw new Error('Choose an active Sink Catalog variant.');
      const nextSnapshot = createQuoteSinkSnapshot(model, variant);
      updateLine(quoteId,line.id,quoteSinkSourcePatch(line,nextSnapshot));
      setSourceError('');
      setSearch('');
      setSearching(false);
    }catch(error){
      setSourceError(error instanceof Error?error.message:'Unable to update Sink source.');
    }
  };
  const applyCatalogPrice = () => {
    try {
      updateLine(quoteId,line.id,quoteSinkCatalogPricePatch(line));
      setSourceError('');
    }catch(error){
      setSourceError(error instanceof Error?error.message:'Unable to apply Catalog selling price.');
    }
  };

  if (searching) {
    return (
      <div className="quote-sink-picker quote-catalog-popover" ref={pickerRef}>
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
            <button type="button" onClick={() => apply(selectedModel, selectedVariant)}>Refresh source · keep quoted price</button>
          )}
        </div>}
        {snapshot&&<p className="quote-source-status">
          Changing a Sink selection updates specifications and private costs, but preserves the quoted selling price.
        </p>}
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
        {sourceError&&<p role="alert" className="quote-source-status is-warning">{sourceError}</p>}
      </div>
    );
  }


  return (
    <div className="quote-sink-selection quote-database-result">
      <div className="quote-sink-selection-main">
        <strong>{snapshot ? [snapshot.brand, snapshot.sinkModelName].filter(Boolean).join(' ') : 'Sink'}</strong>
        {snapshot && <small>{[
          snapshot.variantLabel,
          SINK_CONFIGURATION_LABELS[snapshot.configuration],
          snapshot.ada ? 'ADA' : undefined,
          snapshot.variantCode,
        ].filter(Boolean).join(' · ')}</small>}
      </div>

      <div className={`quote-sink-price-reference quote-source-edit-reference ${snapshot ? '' : 'is-empty'}`}>
        <div className="quote-source-reference-copy">
          {snapshot ? (
            <strong>{snapshot.internalCost === undefined ? 'COST —' : `COST ${money.format(snapshot.internalCost)}`}</strong>
          ) : (
            <strong>Choose sink</strong>
          )}
        </div>
        <button type="button" className="quote-source-pencil" onClick={() => {
          window.dispatchEvent(new CustomEvent('sales-shop:quote-close-pricing', { detail: { lineId: line.id } }));
          setSearch('');
          setSourceError('');
          setSearching(true);
        }} title="Change sink" aria-label="Change sink">✎</button>
      </div>

      {snapshot && (!selectedModel || !selectedVariant) && <span className="quote-source-status is-warning">Source unavailable</span>}
      {snapshot && comparison?.changed && selectedModel && selectedVariant && <span className="quote-source-status">Source updated</span>}
      {snapshot && catalogSellingOverride(line) && <span className="quote-source-status">
        Manual selling override · catalog {snapshot.sellPrice===undefined?'unpriced':money.format(snapshot.sellPrice)}
      </span>}
      {snapshot&&line.pricingMode==='quantity-rate'&&snapshot.sellPrice!==undefined&&
       (catalogSellingOverride(line)||line.rate===undefined)&&
       <button type="button" className="quote-source-apply-price" onClick={applyCatalogPrice}>
         Use Catalog selling price {money.format(snapshot.sellPrice)}
       </button>}
      {sourceError&&<p role="alert" className="quote-source-status is-warning">{sourceError}</p>
    </div>
  );
}
