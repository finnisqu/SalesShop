import type {QuoteLine,QuoteRateSnapshot,QuoteSinkSnapshot} from '../types/quote';
import {rateSnapshotLinePatch} from './quoteRateSnapshot';
import {sinkSnapshotDescription,sinkSnapshotLinePatch} from './quoteSinkSnapshot';
import {compatibleAreaScopeFields} from './quoteAreaScope';

/** When reselecting a Rate Book entry, an unchanged unit must not discard the
 * quantity entered in Takeoffs. A unit switch intentionally starts fresh. */
export function rateCatalogSelectionPatch(line:QuoteLine,snapshot:QuoteRateSnapshot):Partial<QuoteLine>{
 const patch=rateSnapshotLinePatch(snapshot);
 const priorUnit=line.rateReference?.snapshot?.unit;
 const sameUnit=priorUnit===snapshot.unit;
 const quantity=patch.pricingMode==='quantity-rate'&&
  line.pricingMode==='quantity-rate'&&sameUnit&&
  line.quantity!==undefined?line.quantity:patch.quantity;
 const nextLine={...line,...patch,quantity} as QuoteLine;
 const quantitySource=line.quantitySource&&compatibleAreaScopeFields(nextLine)
  .includes(line.quantitySource.field)?line.quantitySource:undefined;
 return {...patch,quantity,quantitySource};
}

/** Display provenance separately from the customer's explicitly edited price.
 * Catalog snapshots are immutable: changing a sell rate must not rewrite them. */
export function catalogSellingOverride(line:QuoteLine):boolean{
 const captured=line.kind==='rate'?line.rateReference?.snapshot?.sellRate:
  line.kind==='sink'?line.sinkReference?.snapshot?.sellPrice:
  line.otherReference?.snapshot?.sellPrice;
 if(captured===undefined)return false;
 return line.pricingMode==='quantity-rate'&&
  (line.rate===undefined||Math.abs(line.rate-captured)>=0.005);
}


/** Initial selection may seed a quote's selling price. Changing an existing
 * linked Sink MUST retain quoted rate, quantity, visibility and manual totals. */
export function quoteSinkSourcePatch(line:QuoteLine,snapshot:QuoteSinkSnapshot):Partial<QuoteLine>{
 if(line.kind!=='sink')throw new Error('This line is not a Sink charge.');
 if(!snapshot.sinkModelId||!snapshot.variantId)
  throw new Error('Choose an active Sink model and variant.');
 if(!line.sinkReference?.snapshot)return sinkSnapshotLinePatch(snapshot);
 const sameSource=line.sinkReference.sinkModelId===snapshot.sinkModelId&&
  line.sinkReference.variantId===snapshot.variantId;
 return {
  description:sameSource?line.description:sinkSnapshotDescription(snapshot),
  sinkReference:{sinkModelId:snapshot.sinkModelId,variantId:snapshot.variantId,snapshot},
  // No rate, quantity, pricingMode, amount, manual cost or visibility changes.
 };
}

/** Refresh/reselect Rate Book metadata independently of customer pricing.
 * Different units and a switch into/out of cost-only are explicit new charges:
 * changing them in-place could change quantity, total or visibility. */
export function quoteRateSourcePatch(line:QuoteLine,snapshot:QuoteRateSnapshot):Partial<QuoteLine>{
 if(line.kind!=='rate')throw new Error('This line is not a Rate Book charge.');
 if(!snapshot.rateBookItemId)throw new Error('Choose a Rate Book item.');
 const old=line.rateReference?.snapshot;
 if(!old)return rateCatalogSelectionPatch(line,snapshot);
 if(old.unit!==snapshot.unit)
  throw new Error('This Rate uses a different unit. Add it as a new charge instead.');
 if((old.pricingBehavior==='cost-reference')!==(snapshot.pricingBehavior==='cost-reference'))
  throw new Error('Cannot switch between private cost-only and customer billing in this line. Add a new charge.');
 const sameSource=line.rateReference?.rateBookItemId===snapshot.rateBookItemId;
 return {
  description:sameSource?line.description:snapshot.name,
  rateReference:{...(line.rateReference??{}),rateBookItemId:snapshot.rateBookItemId,snapshot},
  // Leave quantity, rate, amount, visibility and manual price untouched.
 };
}

/** Seller explicitly opts in to the current frozen Catalog selling value. */
export function quoteSinkCatalogPricePatch(line:QuoteLine):Partial<QuoteLine>{
 if(line.kind!=='sink'||!line.sinkReference?.snapshot)
  throw new Error('This line has no linked Sink Catalog selection.');
 if(line.pricingMode!=='quantity-rate')
  throw new Error('Switch to Qty × rate before applying Sink Catalog pricing.');
 const price=line.sinkReference.snapshot.sellPrice;
 if(price===undefined||!Number.isFinite(price)||price<0)
  throw new Error('The Sink variant has no valid selling price to apply.');
 return {rate:price};
}

export function quoteRateCatalogPricePatch(line:QuoteLine):Partial<QuoteLine>{
 if(line.kind!=='rate'||!line.rateReference?.snapshot)
  throw new Error('This line has no linked Rate Book selection.');
 const source=line.rateReference.snapshot;
 if(source.pricingBehavior==='cost-reference')
  throw new Error('Private cost-only references cannot set customer selling prices.');
 const price=source.sellRate;
 if(price===undefined||!Number.isFinite(price)||price<0)
  throw new Error('This Rate Book entry has no valid selling price to apply.');
 if(line.pricingMode==='direct'&&source.unit==='flat')return {amount:price};
 if(line.pricingMode!=='quantity-rate'||source.unit==='flat')
  throw new Error('The line pricing method differs from its Catalog unit.');
 return {rate:price};
}
