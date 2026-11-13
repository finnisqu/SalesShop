import type {QuoteLine,QuoteOtherSnapshot} from '../types/quote';
import type {OtherCatalogItem,OtherCatalogVariant} from '../store/otherCatalogStore';

/** A quote captures these values once. Later Catalog edits never reprice it. */
export function createQuoteOtherSnapshot(
 item:OtherCatalogItem,variant:OtherCatalogVariant,
 capturedAt=new Date().toISOString(),
):QuoteOtherSnapshot{
 return {
  capturedAt,itemId:item.id,itemName:item.name,category:item.category,
  variantId:variant.id,variantLabel:variant.label,
  brand:item.brand,supplier:item.supplier,sku:item.sku,variantSku:variant.sku,
  unit:item.unit??'each',specification:variant.specification,
  material:variant.material,finish:variant.finish,
  availableColors:variant.availableColors?.slice(),
  notes:variant.notes??item.notes,internalCost:variant.internalCost,
  sellPrice:variant.sellPrice,sourceUpdatedAt:item.updatedAt,
 };
}

export function otherSnapshotLinePatch(snapshot:QuoteOtherSnapshot):Partial<QuoteLine>{
 const label=[snapshot.brand,snapshot.itemName].filter(Boolean).join(' ');
 const variant=snapshot.variantLabel.trim();
 return {
  description:variant&&variant.toLowerCase()!=='standard'?label+' · '+variant:label,
  pricingMode:'quantity-rate',quantity:1,rate:snapshot.sellPrice,
  amount:undefined,customerVisible:true,includeInTotal:true,
  unitLabel:snapshot.unit,unitCost:snapshot.internalCost,
  productCode:snapshot.variantSku??snapshot.sku,supplierName:snapshot.supplier,
  costCategory:'product',
  otherReference:{itemId:snapshot.itemId,variantId:snapshot.variantId,snapshot},
 };
}

export function compareQuoteOtherSnapshot(quoted:QuoteOtherSnapshot,current:QuoteOtherSnapshot){
 const equalMoney=(a?:number,b?:number)=>a===undefined||b===undefined?a===b:Math.abs(a-b)<.005;
 const sellPriceChanged=!equalMoney(quoted.sellPrice,current.sellPrice);
 const internalCostChanged=!equalMoney(quoted.internalCost,current.internalCost);
 const sourceChanged=quoted.itemName!==current.itemName||
  quoted.category!==current.category||quoted.brand!==current.brand||
  quoted.supplier!==current.supplier||quoted.unit!==current.unit||
  quoted.variantLabel!==current.variantLabel||
  quoted.variantSku!==current.variantSku||quoted.sku!==current.sku||
  quoted.specification!==current.specification||
  quoted.finish!==current.finish||quoted.material!==current.material||
  quoted.notes!==current.notes||
  JSON.stringify(quoted.availableColors??[])!==JSON.stringify(current.availableColors??[])||
  quoted.sourceUpdatedAt!==current.sourceUpdatedAt;
 return {changed:sellPriceChanged||internalCostChanged||sourceChanged,
  sellPriceChanged,internalCostChanged,sourceChanged};
}
