import { useEffect, useMemo, useState } from 'react';
import { useDismissibleLayer } from '../lib/useDismissibleLayer';
import { useNavigationStore } from '../store/navigationStore';
import { useQuoteStore } from '../store/quoteStore';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';
import { buildCatalogQuoteLinePatch, type CatalogQuoteSource } from '../services/catalogQuoteInsertion';
import { resolveStockMaterialCostReference, defaultMaterialVariant, defaultMaterialPurchaseOption } from '../types/settings';
import { defaultSinkVariant } from '../types/sink';
import { RATE_BOOK_UNIT_LABELS, resolveRateBookValues } from '../types/rateBook';
import type { Quote } from '../types/quote';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const TARGET_NEW = '__new__';

export function CatalogAddToQuoteButton({ onClick, label = 'Add to quote' }: { onClick: () => void; label?: string }) {
  return <button type="button" className="catalog-add-to-quote" onClick={onClick}>+ {label}</button>;
}

export function CatalogQuoteInsert({ source, onClose }: { source: CatalogQuoteSource; onClose: () => void }) {
  const ref = useDismissibleLayer<HTMLDivElement>(true, onClose);
  const quotes = useQuoteStore((state) => state.quotes);
  const activeQuoteId = useQuoteStore((state) => state.activeQuoteId);
  const hydrate = useQuoteStore((state) => state.hydrate);
  const createQuote = useQuoteStore((state) => state.createQuote);
  const addCatalogLine = useQuoteStore((state) => state.addCatalogLine);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const eligible = useMemo(() => quotes.filter((quote) =>
    quoteIsCommerciallyEditable(quote) && quote.documentType !== 'pricing-schedule',
  ), [quotes]);
  const [targetId, setTargetId] = useState<string>(() => activeQuoteId ?? TARGET_NEW);
  const [variantId, setVariantId] = useState(() => source.variantId ?? '');
  const [purchaseOptionId, setPurchaseOptionId] = useState('');
  const [quantityText, setQuantityText] = useState(() => source.kind === 'sink' ? '1' : source.kind === 'rate' && ['each','slab'].includes(source.item.unit) ? '1' : '');
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { hydrate(); }, [hydrate]);

  const destination = eligible.find((quote) => quote.id === targetId);
  const destinationId = destination ? destination.id : TARGET_NEW;
  const materialVariant = source.kind === 'material'
    ? source.material.variants?.find((item) => item.id === variantId && item.active !== false) ?? defaultMaterialVariant(source.material)
    : undefined;
  const sinkVariant = source.kind === 'sink'
    ? source.model.variants.find((item) => item.id === variantId && item.active) ?? defaultSinkVariant(source.model)
    : undefined;
  const options = materialVariant?.purchaseOptions?.filter((option) => option.active !== false) ?? [];
  const selectedOption = options.find((option) => option.id === purchaseOptionId) ?? defaultMaterialPurchaseOption(materialVariant);
  const materialReference = source.kind === 'material'
    ? resolveStockMaterialCostReference(source.material, materialVariant?.id, selectedOption?.id)
    : undefined;
  const rateValues = source.kind === 'rate' ? resolveRateBookValues(source.item, destination?.pricingDivision) : undefined;
  const quantityValue = quantityText.trim() ? Number(quantityText) : undefined;
  const validQuantity = quantityValue === undefined || (Number.isFinite(quantityValue) && quantityValue > 0 && quantityValue <= 1_000_000);
  const title = source.kind === 'material' ? source.material.name : source.kind === 'sink' ? source.model.name : source.item.name;
  const sourceLabel = source.kind === 'material' ? 'Stone material' : source.kind === 'sink' ? 'Sink variant' : 'Company rate';
  const priceLabel = source.kind === 'material'
    ? (materialReference?.costPerSf === undefined ? 'Cost not listed' : `${money.format(materialReference.costPerSf)}/SF internal cost`)
    : source.kind === 'sink'
      ? (sinkVariant?.sellPrice === undefined ? 'Customer price not set' : `${money.format(sinkVariant.sellPrice)}/each customer price`)
      : source.item.pricingBehavior === 'cost-reference'
        ? (rateValues?.internalCost === undefined ? 'Internal cost not listed' : `${money.format(rateValues.internalCost)}/${RATE_BOOK_UNIT_LABELS[source.item.unit]} internal cost`)
        : (rateValues?.sellRate === undefined ? 'Customer price not set' : `${money.format(rateValues.sellRate)}/${RATE_BOOK_UNIT_LABELS[source.item.unit]} suggested sell`);

  const insert = () => {
    setError('');
    if (!validQuantity) { setError('Enter a positive quantity, or leave it blank for takeoff later.'); return; }
    if (source.kind === 'sink' && !sinkVariant) { setError('Choose an active sink variant before adding.'); return; }
    const finalTarget = eligible.find((quote) => quote.id === targetId);
    const quoteId = finalTarget?.id ?? createQuote({
      title: newTitle.trim() || `Quote · ${title}`,
      documentType: 'quote',
    });
    const quote = useQuoteStore.getState().quotes.find((item: Quote) => item.id === quoteId);
    if (!quote || !quoteIsCommerciallyEditable(quote) || quote.documentType === 'pricing-schedule') {
      setError('That quote is no longer editable. Choose another quote.'); return;
    }
    try {
      const patch = buildCatalogQuoteLinePatch(source, {
        variantId: source.kind === 'material' ? materialVariant?.id : source.kind === 'sink' ? sinkVariant?.id : undefined,
        purchaseOptionId: source.kind === 'material' ? selectedOption?.id : undefined,
        division: quote.pricingDivision,
        quantity: quantityValue,
      });
      const id = addCatalogLine(quoteId, source.kind, patch);
      if (!id) { setError('Could not add the line. Check the quote status.'); return; }
      onClose();
      openQuote(quoteId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add this catalog reference.');
    }
  };

  return (
    <div className="catalog-quote-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div ref={ref} className="catalog-quote-sheet" role="dialog" aria-modal="true" aria-label="Add catalog item to quote">
        <header className="catalog-quote-heading">
          <div><span>Catalog → Quotes</span><strong>Review & add</strong><small>{sourceLabel} · {title}</small></div>
          <button type="button" data-dialog-initial-focus aria-label="Close add to quote" onClick={onClose}>×</button>
        </header>
        <div className="catalog-quote-content">
          <label className="catalog-quote-field"><span>Destination quote</span>
            <select value={destinationId} onChange={(event) => { setTargetId(event.target.value); setError(''); }}>
              <option value={TARGET_NEW}>+ Create new quote</option>
              {eligible.map((quote) => <option key={quote.id} value={quote.id}>{quote.quoteNumber} · {quote.title}{quote.companyName ? ` · ${quote.companyName}` : ''}</option>)}
            </select>
          </label>
          {destinationId === TARGET_NEW && <label className="catalog-quote-field"><span>New quote title</span><input type="text" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={`Quote · ${title}`} /></label>}
          {source.kind === 'material' && <>
            <label className="catalog-quote-field"><span>Slab variant</span><select value={materialVariant?.id ?? ''} onChange={(event) => { setVariantId(event.target.value); setPurchaseOptionId(''); }}>
              {source.material.variants?.filter((variant) => variant.active !== false).map((variant) =>
                <option key={variant.id} value={variant.id}>{[variant.thickness,variant.finish,variant.formatName,variant.sku].filter(Boolean).join(' · ') || 'Standard variant'}</option>)}
              {!materialVariant && <option value="">No structured variants · legacy reference</option>}
            </select></label>
            {options.length > 0 && <label className="catalog-quote-field"><span>Supplier purchase program</span><select value={selectedOption?.id ?? ''} onChange={(event) => setPurchaseOptionId(event.target.value)}>
              {options.map((option) => <option value={option.id} key={option.id}>{option.label || option.pricingBasis}</option>)}
            </select></label>}
          </>}
          {source.kind === 'sink' && <label className="catalog-quote-field"><span>Sink variant</span><select value={sinkVariant?.id ?? ''} onChange={(event) => setVariantId(event.target.value)}>
            {source.model.variants.filter((variant) => variant.active).map((variant) => <option key={variant.id} value={variant.id}>{variant.label}{variant.ada ? ' · ADA' : ''}{variant.code ? ` · ${variant.code}` : ''}</option>)}
            {!sinkVariant && <option value="">No active variants</option>}
          </select></label>}
          <label className="catalog-quote-field"><span>{source.kind === 'material' ? 'Quoted area (SF) · optional' : source.kind === 'sink' ? 'Quantity' : `Quantity (${RATE_BOOK_UNIT_LABELS[source.item.unit]}) · optional`}</span>
            <input type="number" min="0.001" step="any" inputMode="decimal" value={quantityText} onChange={(event) => setQuantityText(event.target.value)} placeholder={source.kind === 'material' ? 'Enter takeoff SF later' : 'Enter quantity'} />
          </label>
          <div className="catalog-quote-review">
            <span>{source.kind === 'material' ? 'Internal purchasing reference' : source.kind === 'rate' && source.item.pricingBehavior === 'cost-reference' ? 'Internal cost reference' : 'Pricing reference'}</span>
            <strong>{priceLabel}</strong>
            <small>{source.kind === 'material'
              ? 'Supplier cost is stored privately with its source snapshot. Enter the customer selling rate in Quotes.'
              : source.kind === 'rate' && source.item.pricingBehavior === 'cost-reference'
                ? 'Cost-reference rates stay hidden from the customer and excluded from totals.'
                : 'The current price is frozen in the quote. You can adjust pricing or quantity in Quotes.'}</small>
          </div>
          {error && <p className="catalog-quote-error" role="alert">{error}</p>}
        </div>
        <footer className="catalog-quote-footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" disabled={!validQuantity || (source.kind === 'sink' && !sinkVariant)} onClick={insert}>Add & open quote →</button>
        </footer>
      </div>
    </div>
  );
}
