import type {QuoteLine,QuoteRateSnapshot} from '../types/quote';
import {rateSnapshotLinePatch} from './quoteRateSnapshot';
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
