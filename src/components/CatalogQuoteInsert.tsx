import { useEffect, useMemo, useRef, useState } from 'react';
import {createPortal} from 'react-dom';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import { useDismissibleLayer } from '../lib/useDismissibleLayer';
import { useNavigationStore } from '../store/navigationStore';
import { useQuoteStore } from '../store/quoteStore';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';
import { buildCatalogQuoteLinePatch, validateCatalogQuoteSource, catalogQuoteWholeUnits, type CatalogQuoteSource } from '../services/catalogQuoteInsertion';
import { catalogQuoteDestinationLabel } from '../services/catalogQuoteDestination';
import { resolveStockMaterialCostReference, defaultMaterialVariant, defaultMaterialPurchaseOption } from '../types/settings';
import { defaultSinkVariant } from '../types/sink';
import { RATE_BOOK_UNIT_LABELS, resolveRateBookValues } from '../types/rateBook';
import type { Quote } from '../types/quote';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const TARGET_NEW = '__new__';

export function CatalogAddToQuoteButton({ onClick, label = 'Add to quote' }: { onClick: () => void; label?: string }) {
  return <button type="button" className="catalog-add-to-quote" onClick={onClick}>+ {label}</button>;
}

/** Launch the existing snapshot-based destination chooser from any Catalog
 * variant. Its dialog uses a portal so sticky worktable scrollports cannot
 * clip it, and respects the same quote-edit permissions as Quick Create. */
export function CatalogQuoteLauncher({source,label='Add to quote'}:{
 source:CatalogQuoteSource;label?:string;
}){
 const [open,setOpen]=useState(false);
 const mode=useAuthStore(s=>s.mode);
 const organizationId=useAuthStore(s=>s.organizationId);
 const userId=useAuthStore(s=>s.user?.id);
 const teamRole=useAuthStore(s=>s.teamRole);
 const department=useAuthStore(s=>s.teamDepartment);
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 const allowed=!preview&&(mode==='local'||Boolean(
  organizationId&&userId&&canEditTeamArea(teamRole,department,'quotes')));
 if(!allowed)return null;
 return <>
  <CatalogAddToQuoteButton label={label} onClick={()=>setOpen(true)}/>
  {open&&createPortal(<CatalogQuoteInsert source={source}
    onClose={()=>setOpen(false)}/>,document.body)}
 </>;
}

export function CatalogQuoteInsert({ source, onClose }: { source: CatalogQuoteSource; onClose: () => void }) {
  const ref = useDismissibleLayer<HTMLDivElement>(true, onClose);
  const quotes = useQuoteStore((state) => state.quotes);
  const activeQuoteId = useQuoteStore((state) => state.activeQuoteId);
  const hydrate = useQuoteStore((state) => state.hydrate);
  const createCatalogQuote = useQuoteStore((state) => state.createCatalogQuote);
  const addCatalogLine = useQuoteStore((state) => state.addCatalogLine);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const eligible = useMemo(() => quotes.filter((quote) =>
    quoteIsCommerciallyEditable(quote) && quote.documentType !== 'pricing-schedule',
  ), [quotes]);
  const [targetId, setTargetId] = useState<string>(() => activeQuoteId ?? TARGET_NEW);
  const [variantId, setVariantId] = useState(() => source.kind === 'rate' ? '' : source.variantId ?? '');
  const [purchaseOptionId, setPurchaseOptionId] = useState('');
  const [quantityText, setQuantityText] = useState(() => source.kind === 'sink' || source.kind === 'other' ? '1' : source.kind === 'rate' && ['each','slab'].includes(source.item.unit) ? '1' : '');
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState('');
  const [inserting,setInserting]=useState(false);
  const insertPending=useRef(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  const destination = eligible.find((quote) => quote.id === targetId);
  const destinationId = destination ? destination.id : TARGET_NEW;
  const materialVariant = source.kind === 'material'
    ? variantId
      ? source.material.variants?.find((item) => item.id === variantId && item.active !== false)
      : defaultMaterialVariant(source.material)
    : undefined;
  const sinkVariant = source.kind === 'sink'
    ? variantId
      ? source.model.variants.find((item) => item.id === variantId && item.active)
      : defaultSinkVariant(source.model)
    : undefined;
  const otherVariant = source.kind === 'other'
    ? variantId
      ? source.item.variants.find((item) => item.id === variantId && item.active)
      : source.item.variants.find((item) => item.active && item.default) ?? source.item.variants.find((item) => item.active)
    : undefined;
  const options = materialVariant?.purchaseOptions?.filter((option) => option.active !== false) ?? [];
  const selectedOption = purchaseOptionId
    ? options.find((option) => option.id === purchaseOptionId)
    : defaultMaterialPurchaseOption(materialVariant);
  const materialReference = source.kind === 'material'
    ? resolveStockMaterialCostReference(source.material, materialVariant?.id, selectedOption?.id)
    : undefined;
  const rateValues = source.kind === 'rate' ? resolveRateBookValues(source.item, destination?.pricingDivision) : undefined;
  const quantityValue = quantityText.trim() ? Number(quantityText) : undefined;
  const countRequired=source.kind==='sink'||source.kind==='other';
  const wholeUnits=catalogQuoteWholeUnits(source);
  const validQuantity = quantityValue===undefined?!countRequired:
    Number.isFinite(quantityValue)&&quantityValue>0&&quantityValue<=1_000_000&&
    (!wholeUnits||Number.isInteger(quantityValue));
  const materialVariantsValid=source.kind!=='material'||
    !(source.material.variants?.length)||Boolean(materialVariant);
  const materialProgramsValid=source.kind!=='material'||
    !(materialVariant?.purchaseOptions?.length)||Boolean(selectedOption);
  const validSource = (source.kind==='material'
    ? source.material.active && materialVariantsValid && materialProgramsValid &&
      (!variantId || Boolean(materialVariant)) && (!purchaseOptionId || Boolean(selectedOption))
    : source.kind==='sink' ? source.model.active && Boolean(sinkVariant)
    : source.kind==='other' ? source.item.active && Boolean(otherVariant)
    : source.item.active);
  const title = source.kind === 'material' ? source.material.name : source.kind === 'sink' ? source.model.name : source.item.name;
  const sourceLabel = source.kind === 'material' ? 'Stone material' : source.kind === 'sink' ? 'Sink variant' : source.kind === 'other' ? 'Other catalog product' : 'Company rate';
  const priceLabel = source.kind === 'material'
    ? (materialReference?.costPerSf === undefined ? 'Cost not listed' : `${money.format(materialReference.costPerSf)}/SF internal cost`)
    : source.kind === 'sink'
      ? (sinkVariant?.sellPrice === undefined ? 'Customer price not set' : `${money.format(sinkVariant.sellPrice)}/each customer price`)
      : source.kind === 'other'
        ? (otherVariant?.sellPrice === undefined ? 'Customer price not set' :
          `${money.format(otherVariant.sellPrice)}/${source.item.unit||'each'} customer price`)
      : source.item.pricingBehavior === 'cost-reference'
        ? (rateValues?.internalCost === undefined ? 'Internal cost not listed' : `${money.format(rateValues.internalCost)}/${RATE_BOOK_UNIT_LABELS[source.item.unit]} internal cost`)
        : (rateValues?.sellRate === undefined ? 'Customer price not set' : `${money.format(rateValues.sellRate)}/${RATE_BOOK_UNIT_LABELS[source.item.unit]} suggested sell`);

  const insert = () => {
    // Immediately serialize rapid taps; the disabled state may not have
    // rendered when another click event arrives.
    if(insertPending.current)return;
    setError('');
    if (!validQuantity) { setError(countRequired
      ?'Enter a positive'+(wholeUnits?' whole-number':'')+' quantity for this product.'
      :'Enter a positive quantity, or leave it blank for takeoff later.'); return; }
    if(!validSource){setError('Choose an active Catalog source.');return;}
    insertPending.current=true;setInserting(true);
    const finalTarget = eligible.find((quote) => quote.id === targetId);
    let committed=false;
    try {
      // Validate and capture the exact selection BEFORE creating a quote.
      // A removed variant must not silently become the current default.
      validateCatalogQuoteSource(source,
        source.kind==='material'||source.kind==='sink'||source.kind==='other'?variantId||undefined:undefined,
        source.kind==='material'?purchaseOptionId||undefined:undefined);
      const patch = buildCatalogQuoteLinePatch(source, {
        variantId: source.kind === 'material' ? materialVariant?.id : source.kind === 'sink' ? sinkVariant?.id : source.kind==='other'?otherVariant?.id:undefined,
        purchaseOptionId: source.kind === 'material' ? selectedOption?.id : undefined,
        division: finalTarget?.pricingDivision,
        quantity: quantityValue,
      });
      const kind=source.kind==='other'?'item':source.kind;
      let quoteId:string;
      if(finalTarget){
        const quote=useQuoteStore.getState().quotes.find((item:Quote)=>item.id===finalTarget.id);
        if(!quote||!quoteIsCommerciallyEditable(quote)||quote.documentType==='pricing-schedule'){
          setError('That quote is no longer editable. Choose another quote.');return;
        }
        const id=addCatalogLine(quote.id,kind,patch);
        if(!id){setError('Could not add the line. Check the quote status.');return;}
        quoteId=quote.id;
      }else{
        // One persistence step creates exactly the selected Catalog item;
        // never leave an empty draft behind after a failed second save.
        quoteId=createCatalogQuote(newTitle.trim()||`Quote · ${title}`,kind,patch);
        if(!quoteId){setError('Could not create the Catalog quote.');return;}
      }
      committed=true;
      onClose();
      openQuote(quoteId);
    } catch (reason) {
      setError(committed
        ?'The Catalog item was saved, but navigation failed. Open the Quote from Records instead of adding it again.'
        :reason instanceof Error ? reason.message : 'Could not add this catalog reference.');
    }finally{
      // A committed insert cannot be retried from this dialog: doing so
      // could create a duplicate line or a second quote.
      if(!committed){insertPending.current=false;setInserting(false);}
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
              {eligible.map((quote) => <option key={quote.id} value={quote.id}>{catalogQuoteDestinationLabel(quote)}</option>)}
            </select>
          </label>
          {destinationId === TARGET_NEW && <label className="catalog-quote-field"><span>New quote title</span><input type="text" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={`Quote · ${title}`} /></label>}
          {source.kind === 'material' && <>
            <label className="catalog-quote-field"><span>Slab variant</span><select value={materialVariant?.id ?? ''} onChange={(event) => { setVariantId(event.target.value); setPurchaseOptionId(''); }}>
              {source.material.variants?.filter((variant) => variant.active !== false).map((variant) =>
                <option key={variant.id} value={variant.id}>{[variant.thickness,variant.finish,variant.formatName,variant.sku].filter(Boolean).join(' · ') || 'Standard variant'}</option>)}
              {!materialVariant && <option value="">{variantId?'Selected variant unavailable · choose another':
                  source.material.variants?.length?'No active variants · choose another material':
                  'No structured variants · legacy reference'}</option>}
            </select></label>
            {options.length > 0 && <label className="catalog-quote-field"><span>Supplier purchase program</span><select value={selectedOption?.id ?? ''} onChange={(event) => setPurchaseOptionId(event.target.value)}>
              {!selectedOption&&<option value="">Select an active supplier program</option>}
              {options.map((option) => <option value={option.id} key={option.id}>{option.label || option.pricingBasis}</option>)}
            </select></label>}
          </>}
          {source.kind === 'sink' && <label className="catalog-quote-field"><span>Sink variant</span><select value={sinkVariant?.id ?? ''} onChange={(event) => {setVariantId(event.target.value);setError('');}}>
            {source.model.variants.filter((variant) => variant.active).map((variant) => <option key={variant.id} value={variant.id}>{variant.label}{variant.ada ? ' · ADA' : ''}{variant.code ? ` · ${variant.code}` : ''}</option>)}
            {!sinkVariant && <option value="">No active variants · choose another</option>}
          </select></label>}
          {source.kind === 'other' && <label className="catalog-quote-field"><span>Product variant</span><select value={otherVariant?.id ?? ''} onChange={(event) => {setVariantId(event.target.value);setError('');}}>
            {source.item.variants.filter((variant) => variant.active).map((variant) =>
              <option key={variant.id} value={variant.id}>{variant.label}{variant.sku ? ` · ${variant.sku}` : ''}</option>)}
            {!otherVariant && <option value="">No active variants · choose another</option>}
          </select></label>}
          {(source.kind !== 'rate' || source.item.unit !== 'flat') && (
            <label className="catalog-quote-field"><span>{source.kind === 'material' ? 'Quoted area (SF) · optional' : source.kind === 'sink' ? 'Quantity' : source.kind==='other' ? `Quantity (${source.item.unit||'each'})` : `Quantity (${RATE_BOOK_UNIT_LABELS[source.item.unit]}) · optional`}</span>
              <input type="number" min={wholeUnits?'1':'0.001'} step={wholeUnits?'1':'any'}
                inputMode="decimal" value={quantityText} onChange={(event) => setQuantityText(event.target.value)}
                placeholder={source.kind === 'material' ? 'Enter takeoff SF later' : 'Enter quantity'} />
            </label>
          )}
          <div className="catalog-quote-review">
            <span>{source.kind === 'material' ? 'Internal purchasing reference' : source.kind === 'rate' && source.item.pricingBehavior === 'cost-reference' ? 'Internal cost reference' : 'Pricing reference'}</span>
            <strong>{priceLabel}</strong>
            <small>{source.kind === 'material'
              ? 'Supplier cost is stored privately with its source snapshot. Enter the customer selling rate in Quotes.'
              : source.kind === 'rate' && source.item.pricingBehavior === 'cost-reference'
                ? 'Cost-reference rates stay hidden from the customer and excluded from totals.'
                : 'The current price is frozen in the quote. You can adjust pricing or quantity in Quotes.'}</small>
          </div>
          {!validSource&&<p className="catalog-quote-error" role="alert">
            This Catalog item or selected variant is inactive or unavailable. Choose an active option, or cancel.
          </p>}
          {error && <p className="catalog-quote-error" role="alert">{error}</p>}
        </div>
        <footer className="catalog-quote-footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" disabled={inserting || !validQuantity || !validSource} onClick={insert}>Add & open quote →</button>
        </footer>
      </div>
    </div>
  );
}
