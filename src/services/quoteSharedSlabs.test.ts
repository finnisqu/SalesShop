import {describe,expect,it} from 'vitest';
import type {Quote,QuoteSection,QuoteSlabPool} from '../types/quote';
import {quoteTotal} from '../types/quote';
import {allocatedSharedSlabCost,createQuoteSlabPool,estimateQuoteSlabPool,effectiveQuoteSlabEstimates,
 slabPoolMaterialKey,slabPoolsFromAreaScopes} from './quoteSharedSlabs';
import {projectAreaCost} from './quoteAreaCost';
const section=(id:string,sf:number,variant='white'):QuoteSection=>({
 id,title:id,customerVisible:true,customerDisplayMode:'detail',
 scope:{takeoffMaterial:'Quartz',takeoffMaterialReference:{
  stockProgram:false,pricingSource:'manual-line-rate',materialId:'mat-1',variantId:variant},
  takeoffPieces:[{id:'piece-'+id,name:id,count:1,lengthIn:sf*12,widthIn:12,
    backsplash:false,leftSplash:false,rightSplash:false}]},
});
const base=():Quote=>({id:'q',status:'Draft',documentType:'quote',
 sections:[section('kitchen',40),section('vanity',12)],lines:[
  {id:'sell-k',sectionId:'kitchen',kind:'material',description:'Kitchen',pricingMode:'direct',
   amount:2000,includeInTotal:true,customerVisible:true},
  {id:'sell-v',sectionId:'vanity',kind:'material',description:'Vanity',pricingMode:'direct',
   amount:600,includeInTotal:true,customerVisible:true},
 ]} as Quote);
const spec={id:'pool',label:'Kitchen and vanity',slabAreaSf:80,slabCost:600,yield:.65};
describe('explicit shared physical slab buying',()=>{
 it('counts one physical slab across kitchen and vanity instead of two',()=>{
  const quote=base();
  const pool=createQuoteSlabPool(quote,['kitchen','vanity'],spec)!;
  expect(pool.materialKey).toBe(slabPoolMaterialKey(quote.sections[0]));
  const projected=estimateQuoteSlabPool(quote,pool);
  expect(projected.valid).toBe(true);
  expect(projected.slabCount).toBe(1);
  expect(projected.independentSlabCount).toBe(2);
  expect(projected.totalBuyingCost).toBe(600);
  expect(projected.allocation.kitchen+projected.allocation.vanity).toBe(600);
  const originalSelling=quoteTotal(quote);
  quote.slabPools=[pool];
  quote.sections.forEach(area=>{area.scope!.sharedSlabPool=pool;});
  expect(slabPoolsFromAreaScopes(quote.sections)).toEqual([pool]);
  const k=projectAreaCost(quote,quote.sections[0]);
  const v=projectAreaCost(quote,quote.sections[1]);
  expect(k.materialCost).toBe(projected.allocation.kitchen);
  expect(v.materialCost).toBe(projected.allocation.vanity);
  expect(k.materialCost!+v.materialCost!).toBe(600);
  expect(allocatedSharedSlabCost(quote,'kitchen')?.physicalSlabs).toBe(1);
  expect(quoteTotal(quote)).toBe(originalSelling);
 });
 it('never joins different variants or Areas already belonging to a group',()=>{
  const quote=base();
  quote.sections[1]=section('vanity',12,'gray');
  expect(createQuoteSlabPool(quote,['kitchen','vanity'],spec)).toBeNull();
  quote.sections[1]=section('vanity',12);
  quote.slabPools=[createQuoteSlabPool(quote,['kitchen','vanity'],spec)!];
  expect(createQuoteSlabPool(quote,['kitchen','vanity'],{...spec,id:'other'})).toBeNull();
 });
 it('does not share slabs on an ambiguous free-text material label alone',()=>{
  const quote=base();
  for(const area of quote.sections)delete area.scope!.takeoffMaterialReference;
  expect(quote.sections[0].scope?.takeoffMaterial).toBe('Quartz');
  expect(slabPoolMaterialKey(quote.sections[0])).toBeNull();
  expect(createQuoteSlabPool(quote,['kitchen','vanity'],spec)).toBeNull();
 });
 it('requires matching supplier and slab format, not merely a shared catalog material ID',()=>{
  const quote=base();
  const snapshot={
    capturedAt:'2026-11-02',materialId:'mat-1',materialName:'Quartz',
    materialType:'Quartz' as const,stockProgram:false,supplier:'Supplier A',
    lengthIn:120,widthIn:64,
  };
  quote.sections[0].scope!.takeoffMaterialReference!.snapshot=snapshot;
  quote.sections[1].scope!.takeoffMaterialReference!.snapshot={...snapshot,supplier:'Supplier B'};
  expect(createQuoteSlabPool(quote,['kitchen','vanity'],spec)).toBeNull();
  quote.sections[1].scope!.takeoffMaterialReference!.snapshot={...snapshot,widthIn:63};
  expect(createQuoteSlabPool(quote,['kitchen','vanity'],spec)).toBeNull();
 });
 it('rejects a manual count below the combined SF/yield floor',()=>{
  const quote=base(),tooSmall={...spec,slabAreaSf:65,slabCountOverride:1};
  expect(createQuoteSlabPool(quote,['kitchen','vanity'],tooSmall)).toBeNull();
  expect(createQuoteSlabPool(quote,['kitchen','vanity'],{
    ...tooSmall,slabCountOverride:2,
  })?.slabCountOverride).toBe(2);
 });
 it('invalidates an old pool after a material change without changing sales totals',()=>{
  const quote=base();
  quote.slabPools=[createQuoteSlabPool(quote,['kitchen','vanity'],spec)!];
  const before=quoteTotal(quote);
  quote.sections[1]=section('vanity',12,'new-variant');
  expect(estimateQuoteSlabPool(quote,quote.slabPools[0]).valid).toBe(false);
  expect(allocatedSharedSlabCost(quote,'kitchen')).toBeNull();
  expect(quoteTotal(quote)).toBe(before);
 });
 it('requires a measured and correctly sized pool; supports an explicit whole-slab override',()=>{
  const quote=base();
  expect(createQuoteSlabPool(quote,['kitchen','vanity'],{...spec,slabAreaSf:0})).toBeNull();
  expect(createQuoteSlabPool(quote,['kitchen','vanity'],{...spec,slabCountOverride:1.5})).toBeNull();
  const two=createQuoteSlabPool(quote,['kitchen','vanity'],{...spec,slabCountOverride:2})!;
  const estimate=estimateQuoteSlabPool(quote,two);
  expect(estimate.slabCount).toBe(2);
  expect(estimate.totalBuyingCost).toBe(1200);
 });
 it('uses full purchasing cost once, distributes rounding cents and honors manual material overrides',()=>{
  const quote=base();
  quote.slabPools=[createQuoteSlabPool(quote,['kitchen','vanity'],{...spec,slabCost:123.45})!];
  const a=projectAreaCost(quote,quote.sections[0]),b=projectAreaCost(quote,quote.sections[1]);
  expect(Number(((a.materialCost??0)+(b.materialCost??0)).toFixed(2))).toBe(123.45);
  quote.lines[0].internalCost=250;
  expect(projectAreaCost(quote,quote.sections[0]).materialCost).toBe(250);
 });
 it('automatically shares buying for matching fully-costed Catalog variants without changing quotes',()=>{
  const quote=base(),before=JSON.stringify(quote),selling=quoteTotal(quote);
  for(const area of quote.sections){
   area.scope!.slabAreaOverrideSf=80;
   area.scope!.slabCostOverride=600;
  }
  const unchanged=JSON.stringify(quote);
  const pooled=effectiveQuoteSlabEstimates(quote);
  expect(pooled).toHaveLength(1);
  expect(pooled[0].pool.id.startsWith('auto:')).toBe(true);
  expect(pooled[0].slabCount).toBe(1);
  expect(pooled[0].independentSlabCount).toBe(2);
  const k=projectAreaCost(quote,quote.sections[0]);
  const v=projectAreaCost(quote,quote.sections[1]);
  expect(Number(((k.materialCost??0)+(v.materialCost??0)).toFixed(2))).toBe(600);
  expect(quoteTotal(quote)).toBe(selling);
  expect(JSON.stringify(quote)).toBe(unchanged);
  expect(before).not.toBe(unchanged);
 });
 it('leaves unpriced and incompatible variants separate without silently inventing costs',()=>{
  const quote=base();
  expect(effectiveQuoteSlabEstimates(quote)).toHaveLength(0);
  quote.sections.forEach(area=>{
   area.scope!.slabAreaOverrideSf=80;
   area.scope!.slabCostOverride=600;
  });
  quote.sections[1].scope!.takeoffMaterialReference!.variantId='different';
  expect(effectiveQuoteSlabEstimates(quote)).toHaveLength(0);
  expect(allocatedSharedSlabCost(quote,'kitchen')).toBeNull();
 });
 it('keeps explicitly configured pools authoritative over automatic pooling',()=>{
  const quote=base();
  quote.sections.forEach(area=>{
   area.scope!.slabAreaOverrideSf=80;
   area.scope!.slabCostOverride=600;
  });
  quote.slabPools=[createQuoteSlabPool(quote,['kitchen','vanity'],spec)!];
  const pooled=effectiveQuoteSlabEstimates(quote);
  expect(pooled).toHaveLength(1);
  expect(pooled[0].pool.id).toBe('pool');
 });

});
