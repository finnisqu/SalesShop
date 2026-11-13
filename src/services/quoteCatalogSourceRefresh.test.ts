import {describe,expect,it} from 'vitest';
import type {QuoteLine} from '../types/quote';
import type {SinkModel} from '../types/sink';
import type {RateBookItem} from '../types/rateBook';
import {createQuoteSinkSnapshot,sinkSnapshotLinePatch} from './quoteSinkSnapshot';
import {createQuoteRateSnapshot,rateSnapshotLinePatch} from './quoteRateSnapshot';
import {
 quoteSinkSourcePatch,quoteSinkCatalogPricePatch,
 quoteRateSourcePatch,quoteRateCatalogPricePatch,catalogSellingOverride,
} from './quoteCatalogLineEditing';

const model:SinkModel={
 id:'sink-model',name:'3218 Bowl',category:'kitchen',
 material:'Stainless steel',active:true,
 variants:[{id:'undermount',label:'Undermount',configuration:'single',
  ada:false,active:true,default:true,internalCost:100,sellPrice:225,history:[]}],
 createdAt:'2026-11-01',updatedAt:'2026-11-01',
};
const rate:RateBookItem={
 id:'fabrication',name:'Fabrication',category:'fabrication-install',
 unit:'sf',pricingBehavior:'suggested',internalCost:5,sellRate:15,
 divisionOverrides:[],history:[],active:true,
 createdAt:'2026-11-01',updatedAt:'2026-11-01',
};
const sinkLine=():QuoteLine=>({
 id:'sink-line',kind:'sink',customerVisible:true,includeInTotal:true,
 ...sinkSnapshotLinePatch(createQuoteSinkSnapshot(model,model.variants[0])),
 pricingMode:'quantity-rate',quantity:4,rate:260,internalCost:495,
 description:'Custom customer sink',
});
const rateLine=():QuoteLine=>({
 id:'rate-line',kind:'rate',customerVisible:true,includeInTotal:true,
 ...rateSnapshotLinePatch(createQuoteRateSnapshot(rate)),
 pricingMode:'quantity-rate',quantity:125,rate:18,
 description:'Customer-approved fabrication',
});

describe('Catalog source refresh does not reprice a customer quote',()=>{
 it('keeps sink customer rate, quantity, visibility and manual total cost on refresh',()=>{
  const before=sinkLine();
  const updated:SinkModel={...model,updatedAt:'2026-11-13',
   variants:[{...model.variants[0],internalCost:130,sellPrice:325,
    finish:'Satin',availableColors:['Black']}]};
  const snapshot=createQuoteSinkSnapshot(updated,updated.variants[0]);
  const patch=quoteSinkSourcePatch(before,snapshot);
  expect(patch).toMatchObject({description:'Custom customer sink',
   sinkReference:{sinkModelId:'sink-model',variantId:'undermount',
    snapshot:{internalCost:130,sellPrice:325,finish:'Satin'}}});
  for(const key of ['rate','quantity','pricingMode','amount','internalCost','customerVisible','includeInTotal'])
   expect(patch).not.toHaveProperty(key);
  const after={...before,...patch};
  expect(after).toMatchObject({rate:260,quantity:4,internalCost:495});
  expect(quoteSinkCatalogPricePatch(after)).toEqual({rate:325});
  expect(before.sinkReference?.snapshot?.sellPrice).toBe(225);
 });
 it('allows a sink variant change without changing the quoted selling price',()=>{
  const newVariant={...model.variants[0],id:'radius',label:'Radius corners',
   internalCost:150,sellPrice:370};
  const patch=quoteSinkSourcePatch(sinkLine(),
   createQuoteSinkSnapshot({...model,variants:[newVariant]},newVariant));
  expect(patch).toMatchObject({description:'3218 Bowl · Radius corners',
   sinkReference:{variantId:'radius',snapshot:{sellPrice:370}}});
  expect({...sinkLine(),...patch}).toMatchObject({quantity:4,rate:260});
 });
 it('refreshes rate cost and pricing metadata without overwriting custom selling',()=>{
  const before=rateLine();
  const changed=createQuoteRateSnapshot({...rate,internalCost:7,sellRate:23,
   updatedAt:'2026-11-13'});
  const patch=quoteRateSourcePatch(before,changed);
  expect(patch).toMatchObject({description:'Customer-approved fabrication',
   rateReference:{rateBookItemId:'fabrication',
    snapshot:{internalCost:7,sellRate:23}}});
  for(const key of ['rate','amount','pricingMode','quantity','internalCost',
   'customerVisible','includeInTotal','quantitySource'])
   expect(patch).not.toHaveProperty(key);
  const after={...before,...patch};
  expect(after).toMatchObject({rate:18,quantity:125});
  expect(quoteRateCatalogPricePatch(after)).toEqual({rate:23});
 });
 it('keeps fixed flat Rate Book amounts until explicit repricing',()=>{
  const flat=createQuoteRateSnapshot({...rate,id:'trip',unit:'flat',sellRate:150});
  const line:QuoteLine={id:'flat',kind:'rate',
   customerVisible:true,includeInTotal:true,...rateSnapshotLinePatch(flat),
   pricingMode:'direct',amount:180,description:'Approved trip fee'};
  const revised=createQuoteRateSnapshot({...rate,id:'trip',unit:'flat',sellRate:210});
  const patch=quoteRateSourcePatch(line,revised);
  expect(patch).not.toHaveProperty('amount');
  expect(patch).not.toHaveProperty('pricingMode');
  expect({...line,...patch}).toMatchObject({pricingMode:'direct',amount:180});
  expect(quoteRateCatalogPricePatch({...line,...patch})).toEqual({amount:210});
  expect(catalogSellingOverride({...line,...patch})).toBe(true);
 });
 it('rejects changing a linked Rate unit or private billing designation',()=>{
  const before=rateLine();
  expect(()=>quoteRateSourcePatch(before,
   createQuoteRateSnapshot({...rate,unit:'each'}))).toThrow(/different unit/);
  expect(()=>quoteRateSourcePatch(before,
   createQuoteRateSnapshot({...rate,pricingBehavior:'cost-reference'})))
   .toThrow(/private cost-only/);
  const privateSource=createQuoteRateSnapshot({...rate,pricingBehavior:'cost-reference'});
  const privateLine={...before,...rateSnapshotLinePatch(privateSource)} as QuoteLine;
  expect(()=>quoteRateCatalogPricePatch(privateLine)).toThrow(/cost-only/);
  expect(quoteRateSourcePatch(privateLine,createQuoteRateSnapshot({
   ...rate,pricingBehavior:'cost-reference',internalCost:9,
  }))).not.toHaveProperty('customerVisible');
 });
 it('rejects attempting to reprice non-linked or incompatible line pricing',()=>{
  expect(()=>quoteSinkCatalogPricePatch({...sinkLine(),sinkReference:undefined}))
   .toThrow(/no linked Sink/);
  expect(()=>quoteSinkCatalogPricePatch({...sinkLine(),pricingMode:'direct'}))
   .toThrow(/Qty × rate/);
  expect(()=>quoteRateCatalogPricePatch({...rateLine(),rateReference:undefined}))
   .toThrow(/no linked Rate Book/);
  expect(()=>quoteRateCatalogPricePatch({...rateLine(),pricingMode:'direct'}))
   .toThrow(/pricing method differs/);
 });
 it('still initializes the selling price from Catalog for an entirely new source',()=>{
  const freshSink={...sinkLine(),sinkReference:undefined,rate:undefined};
  const sinkPatch=quoteSinkSourcePatch(freshSink,
   createQuoteSinkSnapshot(model,model.variants[0]));
  expect(sinkPatch.rate).toBe(225);
  expect(sinkPatch.quantity).toBe(4);
  const freshRate={...rateLine(),rateReference:undefined,rate:undefined};
  const ratePatch=quoteRateSourcePatch(freshRate,createQuoteRateSnapshot(rate));
  expect(ratePatch.rate).toBe(15);
 });
});
