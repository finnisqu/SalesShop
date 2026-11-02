import {describe,expect,it} from 'vitest';
import type {Quote,QuoteSection,QuoteSlabPool} from '../types/quote';
import {quoteTotal} from '../types/quote';
import {allocatedSharedSlabCost,createQuoteSlabPool,estimateQuoteSlabPool,
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
});
