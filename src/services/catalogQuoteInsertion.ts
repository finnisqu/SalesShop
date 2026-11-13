import { createQuoteMaterialCostSnapshot } from './quoteMaterialSnapshot';
import { createQuoteRateSnapshot, rateSnapshotLinePatch } from './quoteRateSnapshot';
import { createQuoteSinkSnapshot, sinkSnapshotLinePatch } from './quoteSinkSnapshot';
import { resolveStockMaterialCostReference, type StockMaterial } from '../types/settings';
import type { SinkModel } from '../types/sink';
import type { RateBookItem } from '../types/rateBook';
import type { QuoteLine } from '../types/quote';
import type { RateBookDivision } from '../types/rateBook';

export type CatalogQuoteSource =
  | { kind: 'material'; material: StockMaterial; variantId?: string }
  | { kind: 'sink'; model: SinkModel; variantId?: string }
  | { kind: 'rate'; item: RateBookItem };

export function validateCatalogQuoteQuantity(quantity?: number):void{
  if(quantity!==undefined&&(!Number.isFinite(quantity)||quantity<=0||quantity>1_000_000))
    throw new Error('Enter a positive quantity no greater than 1,000,000.');
}

/** Reject an explicit stale/inactive variant instead of silently quoting a
 * different default option. Unspecified variants may use the active default. */
export function validateCatalogQuoteSource(source:CatalogQuoteSource,variantId?:string,purchaseOptionId?:string):void{
  const requestedVariant=variantId??(source.kind==='rate'?undefined:source.variantId);
  if(source.kind==='material'){
    if(!source.material.active)throw new Error('This material is inactive. Choose an active catalog item.');
    const active=(source.material.variants??[]).filter(v=>v.active!==false);
    if(requestedVariant&&!active.some(v=>v.id===requestedVariant))
      throw new Error('The selected material variant is inactive or no longer available.');
    if(purchaseOptionId){
      const variant=active.find(v=>v.id===requestedVariant)??active.find(v=>v.default)??active[0];
      if(!variant?.purchaseOptions.some(option=>option.id===purchaseOptionId&&option.active!==false))
        throw new Error('The selected supplier purchase program is inactive or no longer available.');
    }
  }else if(source.kind==='sink'){
    if(!source.model.active)throw new Error('This sink model is inactive. Choose an active model.');
    if(requestedVariant&&!source.model.variants.some(v=>v.id===requestedVariant&&v.active))
      throw new Error('The selected sink variant is inactive or no longer available.');
    if(!source.model.variants.some(v=>v.active))
      throw new Error('This sink model has no active variant to quote.');
  }else if(!source.item.active){
    throw new Error('This Rate Book item is inactive. Choose an active rate.');
  }
}

export function buildCatalogQuoteLinePatch(
  source: CatalogQuoteSource,
  options: { variantId?: string; purchaseOptionId?: string; quantity?: number; division?: RateBookDivision } = {},
): Partial<QuoteLine> {
  validateCatalogQuoteQuantity(options.quantity);
  validateCatalogQuoteSource(source,options.variantId,options.purchaseOptionId);
  if (source.kind === 'material') {
    const reference = resolveStockMaterialCostReference(source.material, options.variantId ?? source.variantId, options.purchaseOptionId);
    const material = source.material;
    // Supplier cost is an INTERNAL reference, never the customer's sell price.
    return {
      description: [material.brand, material.name, reference.variant?.thickness, reference.variant?.finish].filter(Boolean).join(' · '),
      pricingMode: 'quantity-rate',
      quantity: options.quantity,
      rate: undefined,
      amount: undefined,
      customerVisible: true,
      includeInTotal: true,
      materialReference: {
        materialId: material.id,
        variantId: reference.variant?.id,
        purchaseOptionId: reference.purchaseOption?.id,
        stockProgram: material.stockProgram,
        pricingSource: 'manual-line-rate',
        sourceCostPerSf: reference.costPerSf,
        catalogSlabCost: reference.slabCost,
        snapshot: createQuoteMaterialCostSnapshot(material, reference),
      },
    };
  }
  if (source.kind === 'sink') {
    const variant = source.model.variants.find((item) => item.id === (options.variantId ?? source.variantId) && item.active)
      ?? source.model.variants.find((item) => item.active && item.default)
      ?? source.model.variants.find((item) => item.active);
    if (!variant) throw new Error('This sink model has no active variant to quote.');
    const patch = sinkSnapshotLinePatch(createQuoteSinkSnapshot(source.model, variant));
    return { ...patch, quantity: options.quantity ?? 1 };
  }
  const snapshot = createQuoteRateSnapshot(source.item, options.division);
  const patch = rateSnapshotLinePatch(snapshot);
  // Quantity is deliberately blank for SF/LF services until takeoff is entered.
  return { ...patch, quantity: snapshot.unit === 'flat' ? undefined : options.quantity ?? patch.quantity };
}
