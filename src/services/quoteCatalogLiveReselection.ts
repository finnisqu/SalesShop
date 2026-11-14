import type {StockMaterial,MaterialVariant} from '../types/settings';
import type {SinkModel,SinkVariant} from '../types/sink';
import type {OtherCatalogItem,OtherCatalogVariant} from '../store/otherCatalogStore';
import type {RateBookItem} from '../types/rateBook';

/** Existing Quote source pickers must re-read Catalog at the moment of an
 * explicit refresh/reselection. React-rendered rows are not save evidence:
 * another tab or cloud hydration may retire or reprice them before the click.
 * These helpers return the live identity only, never a customer price patch.
 */
export function liveMaterialSelection(
 materials:readonly StockMaterial[],materialId:string,variantId:string,
 purchaseOptionId?:string,
):{material:StockMaterial;variant:MaterialVariant}{
 const material=materials.find(item=>item.id===materialId&&item.active);
 if(!material)throw new Error('This Material is no longer active or available.');
 const variant=(material.variants??[]).find(item=>item.id===variantId&&item.active!==false);
 if(!variant)throw new Error('This Material variant is no longer active or available.');
 const options=variant.purchaseOptions??[];
 const active=options.filter(item=>item.active!==false);
 if(options.length&&!active.length)
  throw new Error('This Material variant has no active supplier purchase program.');
 if(purchaseOptionId&&!active.some(item=>item.id===purchaseOptionId))
  throw new Error('The selected supplier purchase program is no longer active or available.');
 return {material,variant};
}

export function liveSinkSelection(
 models:readonly SinkModel[],modelId:string,variantId:string,
):{model:SinkModel;variant:SinkVariant}{
 const model=models.find(item=>item.id===modelId&&item.active);
 if(!model)throw new Error('This Sink model is no longer active or available.');
 const variant=model.variants.find(item=>item.id===variantId&&item.active);
 if(!variant)throw new Error('This Sink variant is no longer active or available.');
 return {model,variant};
}

export function liveRateSelection(items:readonly RateBookItem[],itemId:string):RateBookItem{
 const item=items.find(entry=>entry.id===itemId&&entry.active);
 if(!item)throw new Error('This Rate Book item is no longer active or available.');
 return item;
}

export function liveOtherSelection(
 items:readonly OtherCatalogItem[],itemId:string,variantId:string,
):{item:OtherCatalogItem;variant:OtherCatalogVariant}{
 const item=items.find(entry=>entry.id===itemId&&entry.active);
 if(!item)throw new Error('This OTHER product is no longer active or available.');
 const variant=item.variants.find(entry=>entry.id===variantId&&entry.active);
 if(!variant)throw new Error('This OTHER variant is no longer active or available.');
 return {item,variant};
}
