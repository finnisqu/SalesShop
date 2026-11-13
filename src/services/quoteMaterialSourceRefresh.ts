import type {QuoteLine,QuoteLineMaterialReference} from '../types/quote';
import {
  resolveStockMaterialCostReference,
  type StockMaterial,
} from '../types/settings';
import {createQuoteMaterialCostSnapshot} from './quoteMaterialSnapshot';
import {calculateQuoteSlabMultiplierPrice} from './quoteSlabPricing';

const sameCost=(a?:number,b?:number)=>
  a===undefined||b===undefined?a===b:Math.abs(a-b)<0.005;

function safeMaterialName(material:StockMaterial,thickness?:string,finish?:string){
 return [material.brand,material.name,thickness,finish].filter(Boolean).join(' · ');
}

/** Explicit Catalog selection/refresh changes material identity and private
 * buying references. It MUST NOT silently change a customer selling price.
 * In slab-multiplier mode, the original formula inputs stay locked until the
 * seller intentionally requests a recalculation. */
export function quoteMaterialSourcePatch(
 line:QuoteLine,material:StockMaterial,variantId:string,purchaseOptionId?:string,
 guideMultiplier=2.2,
):Partial<QuoteLine>{
 if(line.kind!=='material')throw new Error('This line is not a Material charge.');
 if(!material.active)throw new Error('This Catalog material is inactive.');
 const variant=(material.variants??[]).find(v=>v.id===variantId&&v.active!==false);
 if(!variant)throw new Error('This material variant is inactive or unavailable.');
 const options=(variant.purchaseOptions??[]).filter(v=>v.active!==false);
 if(purchaseOptionId&&!options.some(option=>option.id===purchaseOptionId))
  throw new Error('The selected supplier purchase program is inactive or unavailable.');
 const reference=resolveStockMaterialCostReference(material,variant.id,purchaseOptionId);
 // In an older record, the resolver may fall back; never substitute another
 // explicitly selected variant or supplier program.
 if(reference.variant?.id!==variant.id||
   (purchaseOptionId&&reference.purchaseOption?.id!==purchaseOptionId))
  throw new Error('The selected Material Catalog source is unavailable.');
 const snapshot=createQuoteMaterialCostSnapshot(material,reference);
 const original=line.materialReference;
 const slabMode=line.pricingMode==='slab-multiplier';
 const existingSource=Boolean(original?.materialId||original?.customMaterialName||original?.snapshot);
 const lockedCost=slabMode&&existingSource;
 const sourceSlabCost=slabMode
  ?lockedCost?original?.sourceSlabCost:reference.slabCost
  :original?.sourceSlabCost;
 const slabMultiplier=slabMode?(original?.slabMultiplier??guideMultiplier):original?.slabMultiplier;
 const slabCount=original?.slabCount;
 const initialPricing=slabMode&&!existingSource&&line.amount===undefined
  ?calculateQuoteSlabMultiplierPrice({
    slabCost:sourceSlabCost,multiplier:slabMultiplier,slabCount,
   }):undefined;
 const sameSelection=original?.materialId===material.id&&
  (original?.variantId??original?.snapshot?.variantId)===variant.id&&
  (original?.purchaseOptionId??original?.snapshot?.purchaseOptionId)===reference.purchaseOption?.id;
 const materialReference:QuoteLineMaterialReference={
  ...(original??{stockProgram:material.stockProgram,pricingSource:'manual-line-rate'}),
  materialId:material.id,
  customMaterialName:undefined,
  variantId:variant.id,
  purchaseOptionId:reference.purchaseOption?.id,
  stockProgram:material.stockProgram,
  pricingSource:slabMode?'slab-multiplier':original?.pricingSource??'manual-line-rate',
  sourceCostPerSf:reference.costPerSf,
  catalogSlabCost:reference.slabCost,
  sourceSlabCost,
  slabCostOverride:slabMode?!sameCost(sourceSlabCost,reference.slabCost):original?.slabCostOverride,
  slabMultiplier,
  slabCount,
  customerPricePerSlab:initialPricing?.customerPricePerSlab??original?.customerPricePerSlab,
  snapshot,
 };
 return {
  description:sameSelection?line.description:safeMaterialName(material,variant.thickness,variant.finish),
  materialReference,
  ...(initialPricing?{amount:initialPricing.customerTotal}:{}),
 };
}

/** A deliberately separate seller action. Only this operation may recalculate
 * the customer slab total from a newly captured Catalog buying reference. */
export function quoteMaterialSlabRepricePatch(line:QuoteLine):Partial<QuoteLine>{
 if(line.kind!=='material'||line.pricingMode!=='slab-multiplier')
  throw new Error('This charge is not priced by the slab multiplier.');
 const original=line.materialReference;
 if(!original?.snapshot)throw new Error('Choose a Catalog Material before recalculating.');
 const slabCost=original.catalogSlabCost;
 const pricing=calculateQuoteSlabMultiplierPrice({
  slabCost,multiplier:original.slabMultiplier,slabCount:original.slabCount,
 });
 if(!pricing)throw new Error('Set a valid Catalog slab cost, multiplier, and slab count before recalculating.');
 return {
  amount:pricing.customerTotal,
  materialReference:{
   ...original,
   sourceSlabCost:slabCost,
   slabCostOverride:false,
   customerPricePerSlab:pricing.customerPricePerSlab,
  },
 };
}

/** Preview a potential customer-total change before offering the action. */
export function quoteMaterialSlabRepricePreview(line:QuoteLine):number|undefined{
 if(line.kind!=='material'||line.pricingMode!=='slab-multiplier')return undefined;
 const ref=line.materialReference;
 if(!ref?.snapshot)return undefined;
 return calculateQuoteSlabMultiplierPrice({
  slabCost:ref.catalogSlabCost,multiplier:ref.slabMultiplier,slabCount:ref.slabCount,
 })?.customerTotal;
}
