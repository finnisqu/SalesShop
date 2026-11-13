import {describe,expect,it} from 'vitest';
import type {QuoteLine,QuoteLineOtherReference} from '../types/quote';
import {quoteCloudLineMetadata,quoteCloudLineReference} from './quoteCloudLineMetadata';

const other:QuoteLineOtherReference={
 itemId:'item-1',variantId:'black',
 snapshot:{
  capturedAt:'2026-11-12T13:00:00Z',itemId:'item-1',
  itemName:'Drain assembly',category:'Plumbing',
  variantId:'black',variantLabel:'Black',internalCost:42,sellPrice:95,
  material:'Brass',availableColors:['Black','Graphite'],
 },
};
const line=(override:Partial<QuoteLine>={}):QuoteLine=>({
 id:'line-1',kind:'item',description:'Drain assembly',pricingMode:'quantity-rate',
 quantity:2,rate:110,customerVisible:true,includeInTotal:true,
 otherReference:other,unitCost:42,productCode:'DRAIN-01',
 supplierName:'Private supplier',unitLabel:'each',costCategory:'product',
 ...override,
});
const roundTrip=(input:QuoteLine)=>quoteCloudLineMetadata(
 JSON.parse(JSON.stringify(quoteCloudLineReference(input)))
);

describe('quote line Catalog metadata cloud round-trip',()=>{
 it('preserves private OTHER variant details, private buying cost and current customer override',()=>{
  const quoted=line();
  const meta=roundTrip(quoted);
  expect(meta.otherReference).toEqual(other);
  expect(meta.unitCost).toBe(42);
  expect(meta.productCode).toBe('DRAIN-01');
  expect(meta.supplierName).toBe('Private supplier');
  expect(meta.rateReference?.otherCatalog?.snapshot?.sellPrice).toBe(95);
  // The sell value is a separate line column, not a Catalog metadata field.
  expect(quoted.rate).toBe(110);
  expect(quoted.otherReference?.snapshot?.sellPrice).toBe(95);
  expect(meta).not.toHaveProperty('rate');
 });
 it('recovers private buying cost on older cloud rows missing estimate.unitCost',()=>{
  const quoted=line({unitCost:undefined,productCode:undefined,
   supplierName:undefined,unitLabel:undefined,costCategory:undefined});
  const meta=roundTrip(quoted);
  expect(meta.otherReference).toEqual(other);
  expect(meta.unitCost).toBe(42);
 });
 it('preserves existing Rate Book snapshot and estimated cost fields',()=>{
  const quoted=line({kind:'rate',otherReference:undefined,unitCost:3.5,
   rateReference:{rateBookItemId:'rate-1',snapshot:{
    capturedAt:'2026-11-12T13:00:00Z',rateBookItemId:'rate-1',
    category:'fabrication-install',name:'Install',unit:'sf',
    pricingBehavior:'suggested',internalCost:3.5,sellRate:9,
   }}});
  const meta=roundTrip(quoted);
  expect(meta.rateReference?.rateBookItemId).toBe('rate-1');
  expect(meta.rateReference?.snapshot?.sellRate).toBe(9);
  expect(meta.unitCost).toBe(3.5);
  expect(meta.otherReference).toBeUndefined();
 });
 it('keeps zero private costs and false absorption flags, not just truthy values',()=>{
  const meta=roundTrip(line({otherReference:undefined,unitCost:0,
   internalOnlyCost:false,productCode:undefined}));
  expect(meta.unitCost).toBe(0);
  expect(meta.internalOnlyCost).toBe(false);
 });
 it('preserves frozen OTHER selling references independently of the quoted selling rate',()=>{
  const source=line({rate:180,quantity:4,internalCost:250,includeInTotal:false});
  const encoded=quoteCloudLineReference(source);
  const decoded=quoteCloudLineMetadata(JSON.parse(JSON.stringify(encoded)));
  expect(decoded.otherReference?.snapshot).toEqual(other.snapshot);
  expect(decoded.unitCost).toBe(42);
  expect(decoded).not.toHaveProperty('rate');
  expect(decoded).not.toHaveProperty('quantity');
  expect(decoded).not.toHaveProperty('internalCost');
  expect(decoded).not.toHaveProperty('includeInTotal');
  expect(source).toMatchObject({rate:180,quantity:4,internalCost:250,includeInTotal:false});
 });
 it('keeps a frozen zero supplier cost after a JSON round-trip without borrowing customer price',()=>{
  const zero={...other,snapshot:{...other.snapshot,internalCost:0,sellPrice:0}};
  const meta=roundTrip(line({otherReference:zero,unitCost:undefined,
    productCode:undefined,supplierName:undefined,costCategory:undefined,unitLabel:undefined}));
  expect(meta.unitCost).toBe(0);
  expect(meta.otherReference?.snapshot.sellPrice).toBe(0);
  expect(meta).not.toHaveProperty('rate');
 });
 it('leaves legacy lines without JSON metadata unchanged',()=>{
  const legacy=line({otherReference:undefined,rateReference:undefined,
   unitCost:undefined,productCode:undefined,supplierName:undefined,
   unitLabel:undefined,costCategory:undefined,internalOnlyCost:undefined});
  expect(quoteCloudLineReference(legacy)).toBeNull();
  expect(quoteCloudLineMetadata(null).otherReference).toBeUndefined();
 });
});
