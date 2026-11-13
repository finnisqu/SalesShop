import {describe,expect,it} from 'vitest';
import type {QuoteLine} from '../types/quote';
import type {OtherCatalogItem,OtherCatalogVariant} from '../store/otherCatalogStore';
import {createQuoteOtherSnapshot,otherSnapshotLinePatch} from './quoteOtherSnapshot';
import {quoteOtherSourcePatch,quoteOtherCatalogPricePatch} from './quoteOtherSelection';

const original:OtherCatalogVariant={
 id:'black',label:'Matte black',active:true,default:true,
 internalCost:40,sellPrice:95,sku:'BK-1',finish:'Matte',availableColors:['Black'],
};
const item:OtherCatalogItem={
 id:'drain',name:'Sink drain',category:'Plumbing',active:true,
 brand:'Vendor',supplier:'Wholesale',unit:'each',
 variants:[original],updatedAt:'2026-11-12T12:00:00Z',
};
const quoted=():QuoteLine=>({
 id:'quote-line',kind:'item',customerVisible:true,includeInTotal:true,
 ...otherSnapshotLinePatch(createQuoteOtherSnapshot(item,original,'2026-11-12T12:00:00Z')),
 // This seller-edited rate and manual total cost are independent of Catalog.
 pricingMode:'quantity-rate',quantity:3,rate:125,internalCost:140,
 description:'Customer-specified drain',
});

describe('explicit OTHER Catalog selection within Quick Quotes',()=>{
 it('refreshes private cost and specs but never reprices the customer',()=>{
  const line=quoted();
  const revised:OtherCatalogItem={...item,updatedAt:'2026-11-13T10:00:00Z',
   variants:[{...original,internalCost:52,sellPrice:175,finish:'Satin'}]};
  const patch=quoteOtherSourcePatch(line,revised,revised.variants[0]);
  expect(patch).toMatchObject({
   description:'Customer-specified drain',unitCost:52,
   otherReference:{itemId:'drain',variantId:'black',snapshot:{
    internalCost:52,sellPrice:175,finish:'Satin'}},
  });
  expect(patch).not.toHaveProperty('rate');
  expect(patch).not.toHaveProperty('pricingMode');
  expect(patch).not.toHaveProperty('quantity');
  expect(patch).not.toHaveProperty('internalCost');
  const next={...line,...patch};
  expect(next.rate).toBe(125);
  expect(next.quantity).toBe(3);
  expect(next.internalCost).toBe(140);
  expect(line.otherReference?.snapshot?.sellPrice).toBe(95);
  expect(quoteOtherCatalogPricePatch(next)).toEqual({rate:175});
 });
 it('changes active variants without silently replacing the quoted sell price',()=>{
  const newVariant:OtherCatalogVariant={
   ...original,id:'chrome',label:'Chrome',sku:'CH-1',
   sellPrice:80,internalCost:29,
  };
  const alternate={...item,variants:[original,newVariant]};
  const patch=quoteOtherSourcePatch(quoted(),alternate,newVariant);
  expect(patch).toMatchObject({
   description:'Vendor Sink drain · Chrome',
   productCode:'CH-1',unitCost:29,
   otherReference:{variantId:'chrome',snapshot:{sellPrice:80}},
  });
  expect({...quoted(),...patch}).toMatchObject({quantity:3,rate:125});
 });
 it('rejects inactive or stale variants, and different unit prices',()=>{
  expect(()=>quoteOtherSourcePatch(quoted(),{...item,active:false},original))
   .toThrow(/inactive/);
  expect(()=>quoteOtherSourcePatch(quoted(),item,{...original,id:'removed'}))
   .toThrow(/inactive/);
  expect(()=>quoteOtherSourcePatch(quoted(),{...item,variants:[{...original,active:false}]},original))
   .toThrow(/inactive/);
  expect(()=>quoteOtherSourcePatch(quoted(),{...item,unit:'sf'},original))
   .toThrow(/different unit/);
 });
 it('does not overwrite an explicitly fixed customer total',()=>{
  const fixed={...quoted(),pricingMode:'direct' as const,amount:350};
  const updated={...item,variants:[{...original,internalCost:60,sellPrice:180}]};
  const patch=quoteOtherSourcePatch(fixed,updated,updated.variants[0]);
  expect({...fixed,...patch}).toMatchObject({pricingMode:'direct',amount:350,rate:125});
  expect(()=>quoteOtherCatalogPricePatch({...fixed,...patch}))
   .toThrow(/Qty × rate/);
 });
 it('requires valid Catalog sell price for explicit repricing',()=>{
  const line=quoted();
  expect(quoteOtherCatalogPricePatch(line)).toEqual({rate:95});
  expect(()=>quoteOtherCatalogPricePatch({
   ...line,otherReference:{...line.otherReference!,
    snapshot:{...line.otherReference!.snapshot,sellPrice:undefined}},
  })).toThrow(/no valid selling price/);
 });
});
