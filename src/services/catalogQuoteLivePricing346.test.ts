import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {StockMaterial} from '../types/settings';
import type {RateBookItem} from '../types/rateBook';
import {resolveCatalogQuoteLiveSource} from './catalogQuoteLiveSource';
import {buildCatalogQuoteLinePatch} from './catalogQuoteInsertion';
import {quoteTotal,type QuoteLine} from '../types/quote';
import {summarizeQuoteInternalPricing} from './quoteInternalPricing';

const date='2026-11-14T00:00:00.000Z';
const stock:StockMaterial={
 id:'stone-1',name:'Calacatta Quartz',materialType:'Quartz',unit:'sf',
 stockProgram:true,active:true,internalCost:55,
 variants:[
  {id:'polished',active:true,default:true,finish:'Polished',thickness:'3cm',
   purchaseOptions:[{id:'supplier-a',label:'Old supplier',active:true,
    default:true,pricingBasis:'sf',costPerSf:18}]},
  {id:'honed',active:true,default:false,finish:'Honed',thickness:'3cm',
   purchaseOptions:[{id:'supplier-b',label:'Second supplier',active:true,
    default:true,pricingBasis:'sf',costPerSf:24}]},
 ],
};
const rate:RateBookItem={
 id:'install',name:'Installation',category:'fabrication-install',unit:'sf',
 pricingBehavior:'suggested',internalCost:5,sellRate:15,
 divisionOverrides:[],history:[],active:true,createdAt:date,updatedAt:date,
};
const materialSource={kind:'material' as const,material:stock};
const rateSource={kind:'rate' as const,item:rate};
const code=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 346 — live Catalog pricing snapshots before Quote insertion',()=>{
 it('freezes the latest Material supplier buying cost, never a customer selling rate',()=>{
  const live:StockMaterial={...stock,variants:stock.variants!.map(variant=>
   variant.id==='polished'?{...variant,purchaseOptions:variant.purchaseOptions.map(option=>
    ({...option,costPerSf:33}))}:variant)};
  const current=resolveCatalogQuoteLiveSource(materialSource,{materials:[live]});
  expect(current?.kind).toBe('material');
  const patch=buildCatalogQuoteLinePatch(current!,{quantity:20});
  expect(patch).toMatchObject({quantity:20,pricingMode:'quantity-rate',
   materialReference:{materialId:'stone-1',variantId:'polished',
    purchaseOptionId:'supplier-a',sourceCostPerSf:33,
    snapshot:{costPerSf:33}}});
  expect(patch.rate).toBeUndefined();
  expect(patch.amount).toBeUndefined();
  expect(stock.variants![0].purchaseOptions[0].costPerSf).toBe(18);
 });
 it('uses a new active default variant and supplier program if no explicit variant was selected',()=>{
  const changed:StockMaterial={...stock,variants:stock.variants!.map(variant=>({
   ...variant,default:variant.id==='honed',
   purchaseOptions:variant.purchaseOptions.map(option=>({...option,costPerSf:29})),
  }))};
  const source=resolveCatalogQuoteLiveSource(materialSource,{materials:[changed]});
  const patch=buildCatalogQuoteLinePatch(source!);
  expect(patch.materialReference).toMatchObject({
   variantId:'honed',purchaseOptionId:'supplier-b',
   sourceCostPerSf:29,snapshot:{variantId:'honed',costPerSf:29},
  });
  expect(patch.rate).toBeUndefined();
 });
 it('rejects a removed/retired Material variant or supplier program instead of silently switching',()=>{
  const edited:StockMaterial={...stock,variants:stock.variants!.map(variant=>
   variant.id==='polished'?{...variant,active:false}:variant)};
  const latest=resolveCatalogQuoteLiveSource({...materialSource,variantId:'polished'},
   {materials:[edited]});
  expect(()=>buildCatalogQuoteLinePatch(latest!))
   .toThrow(/selected material variant is inactive/);
  const programRetired:StockMaterial={...stock,variants:stock.variants!.map(variant=>
   variant.id==='polished'?{...variant,purchaseOptions:variant.purchaseOptions.map(option=>({
    ...option,active:false,
   }))}:variant)};
  const current=resolveCatalogQuoteLiveSource(materialSource,{materials:[programRetired]});
  expect(()=>buildCatalogQuoteLinePatch(current!,{variantId:'polished',purchaseOptionId:'supplier-a'}))
   .toThrow(/supplier purchase program/);
  expect(resolveCatalogQuoteLiveSource(materialSource,{materials:[]})).toBeNull();
 });
 it('uses latest Rate Book selling price and internal reference, without repricing prior snapshots',()=>{
  const live:RateBookItem={...rate,updatedAt:'2026-11-14T12:00:00Z',
   internalCost:7,sellRate:26};
  const source=resolveCatalogQuoteLiveSource(rateSource,{rateItems:[live]});
  const patch=buildCatalogQuoteLinePatch(source!,{quantity:20});
  expect(patch).toMatchObject({rate:26,quantity:20,
   rateReference:{rateBookItemId:'install',snapshot:{
    sellRate:26,internalCost:7,sourceUpdatedAt:'2026-11-14T12:00:00Z',
   }}});
  const prior=buildCatalogQuoteLinePatch(rateSource,{quantity:20});
  expect(prior.rate).toBe(15);
  expect(prior.rateReference?.snapshot?.internalCost).toBe(5);
 });
 it('keeps cost-reference rates private, even when the live Catalog changes its cost',()=>{
  const costOnly:RateBookItem={...rate,pricingBehavior:'cost-reference',
   internalCost:12,sellRate:999,updatedAt:'2026-11-14T11:00:00Z'};
  const selected=resolveCatalogQuoteLiveSource(rateSource,{rateItems:[costOnly]});
  const patch=buildCatalogQuoteLinePatch(selected!,{quantity:2});
  expect(patch).toMatchObject({rate:undefined,amount:undefined,
   customerVisible:false,includeInTotal:false,
   rateReference:{snapshot:{internalCost:12,pricingBehavior:'cost-reference'}}});
 });
 it('rejects a removed or inactive Rate before creating a Quote',()=>{
  expect(resolveCatalogQuoteLiveSource(rateSource,{rateItems:[]})).toBeNull();
  const current=resolveCatalogQuoteLiveSource(rateSource,{
   rateItems:[{...rate,active:false}],
  });
  expect(()=>buildCatalogQuoteLinePatch(current!))
   .toThrow(/Rate Book item is inactive/);
 });
 it('resolves the latest material default/program and Rate from stores at commit time',()=>{
  const modal=code('components/CatalogQuoteInsert.tsx');
  expect(modal).toContain('materials:useCompanySettingsStore.getState().hydrated');
  expect(modal).toContain('rateItems:useRateBookStore.getState().hydrated');
  expect(modal).toContain('const latestSource=resolveCatalogQuoteLiveSource(initialSource,');
  expect(modal).toContain("variantId: source.kind === 'material' ? variantId||undefined :");
  expect(modal).toContain("purchaseOptionId: source.kind === 'material' ? purchaseOptionId||undefined : undefined");
  expect(modal).not.toContain('purchaseOptionId: source.kind === \'material\' ? selectedOption?.id');
  expect(modal).not.toContain("variantId: source.kind === 'material' ? materialVariant?.id");
  expect(modal.indexOf('try {\n      if(targetId!==TARGET_NEW'))
   .toBeLessThan(modal.indexOf('const patch = buildCatalogQuoteLinePatch(source'));
 });
});
