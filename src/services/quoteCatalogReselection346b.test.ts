import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {QuoteLine} from '../types/quote';
import type {StockMaterial} from '../types/settings';
import type {SinkModel} from '../types/sink';
import type {RateBookItem} from '../types/rateBook';
import type {OtherCatalogItem} from '../store/otherCatalogStore';
import {
 liveMaterialSelection,liveSinkSelection,liveRateSelection,liveOtherSelection,
} from './quoteCatalogLiveReselection';
import {quoteMaterialSourcePatch,quoteMaterialSlabRepricePatch} from './quoteMaterialSourceRefresh';
import {quoteSinkSourcePatch,quoteRateSourcePatch,quoteSinkCatalogPricePatch,quoteRateCatalogPricePatch} from './quoteCatalogLineEditing';
import {quoteOtherSourcePatch,quoteOtherCatalogPricePatch} from './quoteOtherSelection';
import {createQuoteMaterialCostSnapshot} from './quoteMaterialSnapshot';
import {resolveStockMaterialCostReference} from '../types/settings';
import {createQuoteSinkSnapshot} from './quoteSinkSnapshot';
import {createQuoteRateSnapshot,rateSnapshotLinePatch} from './quoteRateSnapshot';
import {createQuoteOtherSnapshot,otherSnapshotLinePatch} from './quoteOtherSnapshot';
import {summarizeQuoteInternalPricing} from './quoteInternalPricing';
import {quoteCloudLineReference,quoteCloudLineMetadata} from './quoteCloudLineMetadata';

const now='2026-11-14T13:00:00.000Z';
const material=(cost=20):StockMaterial=>({
 id:'stone',name:'White Quartz',materialType:'Quartz',unit:'sf',
 stockProgram:true,active:true,variants:[{
  id:'polished',active:true,default:true,thickness:'3cm',finish:'Polished',
  purchaseOptions:[{id:'supplier',label:'Stock program',default:true,active:true,
   pricingBasis:'sf',costPerSf:cost}],
 }],
});
const sink=(cost=80,sell=200):SinkModel=>({
 id:'sink',name:'Sink 3218',category:'kitchen',active:true,
 createdAt:now,updatedAt:now,variants:[{
  id:'black',label:'Black',configuration:'single',ada:false,
  active:true,default:true,internalCost:cost,sellPrice:sell,history:[],
 }],
});
const rate=(cost=5,sell=20):RateBookItem=>({
 id:'labor',name:'Installation',category:'fabrication-install',unit:'sf',
 pricingBehavior:'suggested',internalCost:cost,sellRate:sell,active:true,
 divisionOverrides:[],history:[],createdAt:now,updatedAt:now,
});
const other=(cost=30,sell=90):OtherCatalogItem=>({
 id:'drain',name:'Drain assembly',category:'Plumbing',unit:'each',
 active:true,updatedAt:now,variants:[{
  id:'matte',label:'Matte',active:true,default:true,
  internalCost:cost,sellPrice:sell,sku:'DRN-M',
 }],
});
const line=(kind:QuoteLine['kind'],patch:Partial<QuoteLine>):QuoteLine=>({
 id:'line-'+kind,kind,description:kind,pricingMode:'quantity-rate',
 customerVisible:true,includeInTotal:true,...patch,
});
const source=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

describe('Batch 346b — existing Quote Catalog reselection and margin preservation',()=>{
 it('uses live Material buying cost and preserves the manually quoted price',()=>{
  const original=material();
  const ref=resolveStockMaterialCostReference(original,'polished','supplier');
  const quoted=line('material',{
   quantity:10,rate:55,materialReference:{
    materialId:'stone',variantId:'polished',purchaseOptionId:'supplier',
    stockProgram:true,pricingSource:'manual-line-rate',
    sourceCostPerSf:20,snapshot:createQuoteMaterialCostSnapshot(original,ref),
   },
  });
  const live=liveMaterialSelection([material(30)],'stone','polished','supplier');
  const patch=quoteMaterialSourcePatch(quoted,live.material,live.variant.id,'supplier');
  expect(patch).not.toHaveProperty('rate');
  expect(patch).not.toHaveProperty('quantity');
  const refreshed={...quoted,...patch};
  expect(refreshed).toMatchObject({rate:55,quantity:10,
   materialReference:{snapshot:{costPerSf:30}}});
  const margin=summarizeQuoteInternalPricing([refreshed]);
  expect(margin).toMatchObject({customerTotal:550,knownInternalCost:300,
   marginPercent:45.5,complete:true});
  expect(quoted.materialReference?.snapshot?.costPerSf).toBe(20);
 });
 it('keeps explicit manual total cost ahead of refreshed Material costs',()=>{
  const current=material(),old=resolveStockMaterialCostReference(current,'polished','supplier');
  const quoted=line('material',{
   rate:55,quantity:10,internalCost:190,
   materialReference:{materialId:'stone',variantId:'polished',purchaseOptionId:'supplier',
    pricingSource:'manual-line-rate',stockProgram:true,
    snapshot:createQuoteMaterialCostSnapshot(current,old)},
  });
  const selected=liveMaterialSelection([material(50)],'stone','polished','supplier');
  const patch=quoteMaterialSourcePatch(quoted,selected.material,selected.variant.id,'supplier');
  expect(patch).not.toHaveProperty('internalCost');
  expect(summarizeQuoteInternalPricing([{...quoted,...patch}]))
   .toMatchObject({customerTotal:550,knownInternalCost:190,
    marginPercent:65.5,complete:true});
 });
 it('rejects retired or removed Material supplier options before refreshing an existing Quote',()=>{
  const removed=material();
  removed.variants![0].purchaseOptions[0].active=false;
  expect(()=>liveMaterialSelection([removed],'stone','polished'))
   .toThrow(/no active supplier purchase program/);
  expect(()=>liveMaterialSelection([removed],'stone','polished','supplier'))
   .toThrow(/no active supplier purchase program/);
  expect(()=>liveMaterialSelection([],'stone','polished'))
   .toThrow(/Material is no longer active/);
  expect(()=>liveMaterialSelection([material()],'stone','missing'))
   .toThrow(/Material variant is no longer active/);
  const old=line('material',{materialReference:{
   stockProgram:true,pricingSource:'manual-line-rate',
  }});
  expect(()=>quoteMaterialSourcePatch(old,removed,'polished'))
   .toThrow(/no active supplier purchase program/);
 });
 it('refreshes a Sink cost snapshot while preserving selling rate and quantity',()=>{
  const original=sink();
  const quoted=line('sink',{quantity:3,rate:300,
   sinkReference:{sinkModelId:'sink',variantId:'black',
    snapshot:createQuoteSinkSnapshot(original,original.variants[0])},
  });
  const selected=liveSinkSelection([sink(120,250)],'sink','black');
  const patch=quoteSinkSourcePatch(quoted,createQuoteSinkSnapshot(selected.model,selected.variant));
  expect(patch).not.toHaveProperty('rate');
  expect(patch).not.toHaveProperty('quantity');
  const refreshed={...quoted,...patch};
  expect(refreshed).toMatchObject({rate:300,quantity:3,
   sinkReference:{snapshot:{internalCost:120,sellPrice:250}}});
  expect(summarizeQuoteInternalPricing([refreshed])).toMatchObject({
   customerTotal:900,knownInternalCost:360,marginPercent:60,
  });
  expect(quoteSinkCatalogPricePatch(refreshed)).toEqual({rate:250});
  expect(quoted.sinkReference?.snapshot?.internalCost).toBe(80);
 });
 it('preserves customer Rate Book pricing while refreshing the latest internal cost',()=>{
  const old=createQuoteRateSnapshot(rate());
  const quoted=line('rate',{...rateSnapshotLinePatch(old),quantity:10,rate:45,
   description:'Approved install price',
  });
  const current=liveRateSelection([rate(9,28)],'labor');
  const snapshot=createQuoteRateSnapshot(current);
  const patch=quoteRateSourcePatch(quoted,snapshot);
  expect(patch).not.toHaveProperty('rate');
  expect(patch).not.toHaveProperty('quantity');
  const refreshed={...quoted,...patch};
  expect(refreshed).toMatchObject({rate:45,quantity:10,
   rateReference:{snapshot:{internalCost:9,sellRate:28}}});
  expect(summarizeQuoteInternalPricing([refreshed])).toMatchObject({
   customerTotal:450,knownInternalCost:90,marginPercent:80,
  });
  expect(quoteRateCatalogPricePatch(refreshed)).toEqual({rate:28});
  expect(old.internalCost).toBe(5);
 });
 it('keeps a private cost-reference Rate unbilled after a cost refresh',()=>{
  const previous={...rate(),pricingBehavior:'cost-reference' as const};
  const first=createQuoteRateSnapshot(previous);
  const quoted=line('rate',{...rateSnapshotLinePatch(first),quantity:10});
  const current=liveRateSelection([{...previous,internalCost:9}],'labor');
  const refreshed={...quoted,...quoteRateSourcePatch(quoted,createQuoteRateSnapshot(current))};
  expect(refreshed).toMatchObject({
   customerVisible:false,includeInTotal:false,
   rate:undefined,rateReference:{snapshot:{internalCost:9}},
  });
  expect(summarizeQuoteInternalPricing([refreshed])).toMatchObject({
   customerTotal:0,knownInternalCost:90,
  });
  expect(()=>quoteRateCatalogPricePatch(refreshed)).toThrow(/cost-only/);
 });
 it('updates OTHER private unit costs but keeps manual selling and total-cost overrides',()=>{
  const old=other();
  const quoted=line('item',{
   ...otherSnapshotLinePatch(createQuoteOtherSnapshot(old,old.variants[0])),
   quantity:2,rate:125,description:'Custom black drain',
  });
  const selected=liveOtherSelection([other(60,160)],'drain','matte');
  const patch=quoteOtherSourcePatch(quoted,selected.item,selected.variant);
  expect(patch).not.toHaveProperty('rate');
  expect(patch).not.toHaveProperty('internalCost');
  const refreshed={...quoted,...patch};
  expect(refreshed).toMatchObject({
   rate:125,quantity:2,description:'Custom black drain',
   unitCost:60,otherReference:{snapshot:{sellPrice:160,internalCost:60}},
  });
  expect(summarizeQuoteInternalPricing([refreshed])).toMatchObject({
   customerTotal:250,knownInternalCost:120,marginPercent:52,
  });
  const manuallyCosted={...quoted,internalCost:85};
  const withOverride={...manuallyCosted,...quoteOtherSourcePatch(
   manuallyCosted,selected.item,selected.variant)};
  expect(summarizeQuoteInternalPricing([withOverride]))
   .toMatchObject({customerTotal:250,knownInternalCost:85,marginPercent:66});
  expect(quoteOtherCatalogPricePatch(refreshed)).toEqual({rate:160});
  expect(quoted.otherReference?.snapshot.internalCost).toBe(30);
 });
 it('rejects removed, retired or stale active selections across Sink, Rate and OTHER',()=>{
  const archivedSink={...sink(),active:false};
  expect(()=>liveSinkSelection([archivedSink],'sink','black')).toThrow(/no longer active/);
  expect(()=>liveSinkSelection([sink()],'sink','missing')).toThrow(/Sink variant/);
  expect(()=>liveRateSelection([{...rate(),active:false}],'labor')).toThrow(/no longer active/);
  expect(()=>liveOtherSelection([other()],'drain','missing')).toThrow(/OTHER variant/);
  expect(()=>liveOtherSelection([],'drain','matte')).toThrow(/OTHER product/);
 });
 it('keeps OTHER cost and source provenance through the existing cloud metadata codec',()=>{
  const latest=other(51,120);
  const quoted=line('item',{...otherSnapshotLinePatch(createQuoteOtherSnapshot(
   latest,latest.variants[0])),
   quantity:4,rate:150,
  });
  const reference=quoteCloudLineReference(quoted);
  const decoded=quoteCloudLineMetadata(JSON.parse(JSON.stringify(reference)));
  expect(decoded).toMatchObject({
   otherReference:{snapshot:{internalCost:51,sellPrice:120,variantId:'matte'}},
   unitCost:51,
  });
  expect(decoded).not.toHaveProperty('rate');
  expect(decoded).not.toHaveProperty('quantity');
  expect(summarizeQuoteInternalPricing([{...quoted,...decoded}]))
   .toMatchObject({customerTotal:600,knownInternalCost:204,marginPercent:66});
 });
 it('forces all four Quote pickers to re-read live Catalog before applying an update',()=>{
  const scenarios=[
   ['components/QuoteMaterialLineFields.tsx',
    'liveMaterialSelection(', 'useCompanySettingsStore.getState().settings.stockMaterials',
    'quoteMaterialSourcePatch('],
   ['components/QuoteSinkLineFields.tsx',
    'liveSinkSelection(', 'useSinkCatalogStore.getState().models',
    'quoteSinkSourcePatch(line,nextSnapshot)'],
   ['components/QuoteRateLineFields.tsx',
    'liveRateSelection(', 'useRateBookStore.getState().items',
    'quoteRateSourcePatch(line,nextSnapshot)'],
   ['components/QuoteOtherLineFields.tsx',
    'liveOtherSelection(', 'useOtherCatalogStore.getState().items',
    'quoteOtherSourcePatch(line,nextItem,nextVariant)'],
  ];
  for(const [file,guard,store,patch] of scenarios){
   const ui=source(file);
   expect(ui,file).toContain(guard);
   expect(ui,file).toContain(store);
   expect(ui,file).toContain(patch);
   expect(ui.indexOf(guard),file).toBeLessThan(ui.lastIndexOf(patch));
  }
 });
 it('keeps slab-multiplier selling totals locked until explicit recalculation',()=>{
  const original=material();
  original.variants![0].formatKind='slab';
  original.variants![0].lengthIn=120;
  original.variants![0].widthIn=60;
  original.variants![0].purchaseOptions[0].pricingBasis='slab';
  original.variants![0].purchaseOptions[0].costPerUnit=750;
  const originalRef=resolveStockMaterialCostReference(original,'polished','supplier');
  const quoted=line('material',{
   pricingMode:'slab-multiplier',amount:3000,
   materialReference:{stockProgram:true,pricingSource:'slab-multiplier',
    materialId:'stone',variantId:'polished',purchaseOptionId:'supplier',
    slabCount:2,slabMultiplier:2,sourceSlabCost:750,catalogSlabCost:750,
    snapshot:createQuoteMaterialCostSnapshot(original,originalRef)},
  });
  const revised=structuredClone(original);
  revised.variants![0].purchaseOptions[0].costPerUnit=950;
  const current=liveMaterialSelection([revised],'stone','polished','supplier');
  const refreshed={...quoted,...quoteMaterialSourcePatch(
   quoted,current.material,current.variant.id,'supplier')};
  expect(refreshed.amount).toBe(3000);
  expect(refreshed.materialReference).toMatchObject({
   sourceSlabCost:750,catalogSlabCost:950,slabCostOverride:true,
  });
  expect(summarizeQuoteInternalPricing([refreshed]))
   .toMatchObject({customerTotal:3000,knownInternalCost:1500,marginPercent:50});
  const reprice=quoteMaterialSlabRepricePatch(refreshed);
  expect(reprice.amount).toBe(3800);
 });
});
