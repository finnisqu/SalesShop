import {describe,expect,it} from 'vitest';
import type {OtherCatalogItem,OtherCatalogVariant} from '../store/otherCatalogStore';
import {createQuoteOtherSnapshot,otherSnapshotLinePatch,compareQuoteOtherSnapshot}
 from './quoteOtherSnapshot';
import {quoteLineTotal,type QuoteLine} from '../types/quote';
import {summarizeQuoteInternalPricing} from './quoteInternalPricing';

const variant:OtherCatalogVariant={
 id:'v-black',label:'Matte black',sku:'BK-01',active:true,default:true,
 specification:'18 inch',material:'Porcelain',finish:'Matte',
 availableColors:['Black','Graphite'],internalCost:42,sellPrice:95,
};
const item:OtherCatalogItem={
 id:'accessory-1',name:'Vanity drain',category:'Plumbing',
 brand:'Test Brand',supplier:'Stock supplier',sku:'DRAIN',unit:'each',
 active:true,variants:[variant],updatedAt:'2026-11-01T00:00:00Z',
};

describe('OTHER catalog quote-time snapshots',()=>{
 it('keeps public selling values separate from private buying costs',()=>{
  const snapshot=createQuoteOtherSnapshot(item,variant,'2026-11-12T10:00:00Z');
  const line=otherSnapshotLinePatch(snapshot);
  expect(snapshot).toMatchObject({
   itemId:'accessory-1',variantId:'v-black',
   itemName:'Vanity drain',variantLabel:'Matte black',
   specification:'18 inch',material:'Porcelain',finish:'Matte',
   internalCost:42,sellPrice:95,availableColors:['Black','Graphite'],
  });
  expect(line).toMatchObject({
   description:'Test Brand Vanity drain · Matte black',
   pricingMode:'quantity-rate',quantity:1,rate:95,
   unitCost:42,productCode:'BK-01',supplierName:'Stock supplier',
   customerVisible:true,includeInTotal:true,
   otherReference:{itemId:'accessory-1',variantId:'v-black'},
  });
  expect(line.amount).toBeUndefined();
 });
 it('uses selling price in customer totals and private cost in internal margins',()=>{
  const patch=otherSnapshotLinePatch(createQuoteOtherSnapshot(item,variant));
  const line:QuoteLine={...patch,id:'line-other',kind:'item',quantity:2} as QuoteLine;
  expect(quoteLineTotal(line)).toBe(190);
  expect(summarizeQuoteInternalPricing([line])).toMatchObject({
   customerTotal:190,knownInternalCost:84,grossSpread:106,
   costedLineCount:1,costRequiredLineCount:1,complete:true,
  });
 });
 it('copies mutable color arrays into the snapshot',()=>{
  const snapshot=createQuoteOtherSnapshot(item,variant);
  variant.availableColors?.push('Silver');
  expect(snapshot.availableColors).toEqual(['Black','Graphite']);
  variant.availableColors?.pop();
 });
 it('allows an unpriced product without inventing its selling price',()=>{
  const snapshot=createQuoteOtherSnapshot(item,{...variant,sellPrice:undefined});
  expect(otherSnapshotLinePatch(snapshot).rate).toBeUndefined();
 });
 it('recognizes color, unit, and supplier revisions even without a price change',()=>{
  const original=createQuoteOtherSnapshot(item,variant);
  const variantChanged=createQuoteOtherSnapshot(item,{
   ...variant,availableColors:['Black','White'],
  });
  expect(compareQuoteOtherSnapshot(original,variantChanged)).toEqual({
   changed:true,sellPriceChanged:false,internalCostChanged:false,sourceChanged:true,
  });
  const supplierChanged=createQuoteOtherSnapshot({
   ...item,supplier:'New supplier',unit:'slab',
  },variant);
  expect(compareQuoteOtherSnapshot(original,supplierChanged).sourceChanged).toBe(true);
  expect(original.availableColors).toEqual(['Black','Graphite']);
 });
 it('detects later prices and spec changes without repricing an existing line',()=>{
  const quoted=createQuoteOtherSnapshot(item,variant);
  const current=createQuoteOtherSnapshot({...item,updatedAt:'2026-11-13T00:00:00Z'},
    {...variant,sellPrice:110,internalCost:48,finish:'Gloss'});
  expect(compareQuoteOtherSnapshot(quoted,current)).toEqual({
   changed:true,sellPriceChanged:true,internalCostChanged:true,sourceChanged:true,
  });
  expect(quoted.sellPrice).toBe(95);
  expect(quoted.internalCost).toBe(42);
 });
});
