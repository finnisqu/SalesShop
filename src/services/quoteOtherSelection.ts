import type {QuoteLine} from '../types/quote';
import type {OtherCatalogItem,OtherCatalogVariant} from '../store/otherCatalogStore';
import {createQuoteOtherSnapshot,otherSnapshotLinePatch} from './quoteOtherSnapshot';

/** Updating a Catalog reference is NEVER implicit repricing. Selection refreshes
 * identity, specifications and private supplier unit-cost. Quoted sell and
 * manual total-cost overrides survive until separately edited by the seller. */
export function quoteOtherSourcePatch(
 line:QuoteLine,item:OtherCatalogItem,variant:OtherCatalogVariant,
):Partial<QuoteLine>{
 if(line.kind!=='item'||!line.otherReference)
  throw new Error('This charge is not linked to an OTHER Catalog item.');
 if(!item.active||!variant.active||!item.variants.some(v=>v.id===variant.id&&v.active))
  throw new Error('This Catalog product or variant is inactive. Choose an active selection.');
 const quotedUnit=line.otherReference.snapshot.unit??'each';
 const nextUnit=item.unit??'each';
 if(quotedUnit!==nextUnit)
  throw new Error('The selected product uses a different unit. Add it as a new charge instead.');
 const sameSource=line.otherReference.itemId===item.id&&line.otherReference.variantId===variant.id;
 const next=otherSnapshotLinePatch(createQuoteOtherSnapshot(item,variant));
 return {
  description:sameSource?line.description:next.description,
  otherReference:next.otherReference,
  productCode:next.productCode,
  supplierName:next.supplierName,
  unitLabel:next.unitLabel,
  unitCost:next.unitCost,
  costCategory:'product',
  // Neither pricingMode nor quantity, sell rate, amount, customer visibility
  // nor manual internalCost are patched: they belong to the quote, not Catalog.
 };
}

/** Seller must explicitly apply the current Catalog sell rate. This never
 * clears the prior snapshot and never converts a fixed-total price. */
export function quoteOtherCatalogPricePatch(line:QuoteLine):Partial<QuoteLine>{
 if(line.kind!=='item'||!line.otherReference)
  throw new Error('This charge has no linked OTHER Catalog selection.');
 if(line.pricingMode!=='quantity-rate')
  throw new Error('Switch this charge to Qty × rate before applying a Catalog unit price.');
 const price=line.otherReference.snapshot.sellPrice;
 if(price===undefined||!Number.isFinite(price)||price<0)
  throw new Error('This Catalog variant has no valid selling price to apply.');
 return {rate:price};
}
