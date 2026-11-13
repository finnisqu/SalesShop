import {describe,expect,it} from 'vitest';
import type {QuoteLine,QuoteLineMaterialReference} from '../types/quote';
import type {StockMaterial} from '../types/settings';
import {resolveStockMaterialCostReference} from '../types/settings';
import {createQuoteMaterialCostSnapshot,compareQuoteMaterialSnapshot} from './quoteMaterialSnapshot';
import {
 quoteMaterialSourcePatch,quoteMaterialSlabRepricePatch,quoteMaterialSlabRepricePreview,
} from './quoteMaterialSourceRefresh';

const stone=(cost=800):StockMaterial=>({
 id:'stone',name:'Arctic White',brand:'Example',supplier:'Distributor',
 materialType:'Quartz',stockProgram:true,unit:'sf',active:true,
 variants:[{
  id:'3cm',active:true,default:true,thickness:'3cm',finish:'Polished',
  formatKind:'slab',lengthIn:130,widthIn:65,
  purchaseOptions:[{id:'standard',label:'Stock',default:true,active:true,
   pricingBasis:'slab',costPerSf:14.5,costPerUnit:cost}],
 }],
});
function quotedLine(overrides:Partial<QuoteLine>={}):QuoteLine{
 const material=stone();
 const reference=resolveStockMaterialCostReference(material,'3cm','standard');
 const materialReference:QuoteLineMaterialReference={
  materialId:'stone',variantId:'3cm',purchaseOptionId:'standard',
  stockProgram:true,pricingSource:'manual-line-rate',
  sourceCostPerSf:reference.costPerSf,catalogSlabCost:reference.slabCost,
  snapshot:createQuoteMaterialCostSnapshot(material,reference,'2026-11-01T00:00:00Z'),
 };
 return {
  id:'line',kind:'material',description:'Customer-selected Arctic White',
  pricingMode:'quantity-rate',quantity:45,rate:62,amount:undefined,
  customerVisible:true,includeInTotal:true,internalCost:1600,
  materialReference,...overrides,
 };
}
function slabLine(overrides:Partial<QuoteLine>={}):QuoteLine{
 const line=quotedLine({pricingMode:'slab-multiplier',quantity:undefined,rate:undefined,
  amount:3200,materialReference:{
   ...quotedLine().materialReference!,
   pricingSource:'slab-multiplier',sourceSlabCost:800,catalogSlabCost:800,
   slabCostOverride:false,slabMultiplier:2,slabCount:2,customerPricePerSlab:1600,
  }});
 return {...line,...overrides};
}

describe('Material Catalog source refresh safety',()=>{
 it('refreshes private SF buying cost but preserves customer rate, quantity and cost overrides',()=>{
  const current=quotedLine();
  const changed=stone(920);
  changed.variants![0].purchaseOptions![0].costPerSf=16.75;
  const patch=quoteMaterialSourcePatch(current,changed,'3cm','standard');
  expect(patch.materialReference).toMatchObject({
   materialId:'stone',variantId:'3cm',purchaseOptionId:'standard',
   sourceCostPerSf:16.75,catalogSlabCost:920,
   snapshot:{costPerSf:16.75,slabCost:920},
  });
  expect(patch.description).toBe(current.description);
  for(const key of ['quantity','rate','amount','pricingMode','internalCost',
   'includeInTotal','customerVisible'])
   expect(patch).not.toHaveProperty(key);
  expect({...current,...patch}).toMatchObject({rate:62,quantity:45,internalCost:1600});
  expect(current.materialReference?.snapshot?.slabCost).toBe(800);
 });
 it('holds slab-multiplier total and formula inputs when supplier changes price',()=>{
  const current=slabLine();
  const patch=quoteMaterialSourcePatch(current,stone(930),'3cm','standard',2);
  expect(patch).not.toHaveProperty('amount');
  expect(patch.materialReference).toMatchObject({
   sourceSlabCost:800,catalogSlabCost:930,slabCostOverride:true,
   slabMultiplier:2,slabCount:2,customerPricePerSlab:1600,
   snapshot:{slabCost:930},
  });
  const next={...current,...patch};
  expect(next.amount).toBe(3200);
  expect(quoteMaterialSlabRepricePreview(next)).toBe(3720);
  const reprice=quoteMaterialSlabRepricePatch(next);
  expect(reprice).toMatchObject({
   amount:3720,materialReference:{sourceSlabCost:930,catalogSlabCost:930,
    slabCostOverride:false,slabMultiplier:2,slabCount:2,customerPricePerSlab:1860},
  });
  expect(current.amount).toBe(3200);
 });
 it('preserves deliberate slab-cost override and customer amount when reselecting a variant',()=>{
  const current=slabLine({amount:2800,materialReference:{
   ...slabLine().materialReference!,sourceSlabCost:700,slabCostOverride:true,
   customerPricePerSlab:1400,
  }});
  const updated=stone(995);
  updated.variants!.push({...updated.variants![0],id:'2cm',thickness:'2cm'});
  const patch=quoteMaterialSourcePatch(current,updated,'2cm','standard',2);
  expect(patch).not.toHaveProperty('amount');
  expect(patch.materialReference).toMatchObject({
   variantId:'2cm',sourceSlabCost:700,catalogSlabCost:995,
   slabCostOverride:true,customerPricePerSlab:1400,
  });
  expect({...current,...patch}).toMatchObject({amount:2800});
  expect(patch.description).toContain('2cm');
 });
 it('requires exactly the requested active variant and supplier program',()=>{
  const line=quotedLine();
  expect(()=>quoteMaterialSourcePatch(line,{...stone(),active:false},'3cm','standard'))
   .toThrow(/inactive/);
  expect(()=>quoteMaterialSourcePatch(line,stone(),'retired','standard'))
   .toThrow(/variant is inactive or unavailable/);
  expect(()=>quoteMaterialSourcePatch(line,stone(),'3cm','deleted'))
   .toThrow(/purchase program is inactive or unavailable/);
  const removed=stone();
  removed.variants![0].active=false;
  expect(()=>quoteMaterialSourcePatch(line,removed,'3cm','standard'))
   .toThrow(/variant is inactive or unavailable/);
  const program=stone();
  program.variants![0].purchaseOptions![0].active=false;
  expect(()=>quoteMaterialSourcePatch(line,program,'3cm','standard'))
   .toThrow(/purchase program is inactive or unavailable/);
  expect(line.rate).toBe(62);
 });
 it('seeds slab pricing only for the first unpriced Material selection',()=>{
  const unlinked=slabLine({amount:undefined,materialReference:{
    stockProgram:false,pricingSource:'slab-multiplier',
    slabCount:2,slabMultiplier:2,
  }});
  const patch=quoteMaterialSourcePatch(unlinked,stone(),'3cm','standard',2);
  expect(patch.amount).toBe(3200);
  expect(patch.materialReference).toMatchObject({
   sourceSlabCost:800,slabMultiplier:2,slabCount:2,customerPricePerSlab:1600,
  });
 });
 it('never recalculates an existing manually fixed slab total without a click',()=>{
  const custom=slabLine({amount:3456});
  const refresh=quoteMaterialSourcePatch(custom,stone(900),'3cm','standard');
  expect(refresh).not.toHaveProperty('amount');
  expect(quoteMaterialSlabRepricePreview({...custom,...refresh})).toBe(3600);
  expect(quoteMaterialSlabRepricePatch({...custom,...refresh}).amount).toBe(3600);
 });
 it('rejects recalculation without a valid slab cost, count and multiplier',()=>{
  expect(()=>quoteMaterialSlabRepricePatch(quotedLine())).toThrow(/slab multiplier/);
  expect(()=>quoteMaterialSlabRepricePatch(slabLine({materialReference:{
   ...slabLine().materialReference!,slabCount:undefined,
  }}))).toThrow(/valid Catalog slab cost/);
  expect(quoteMaterialSlabRepricePreview(quotedLine())).toBeUndefined();
 });
 it('detects Material variant and supplier changes even with the same purchasing cost',()=>{
  const before=stone();
  const quoted=createQuoteMaterialCostSnapshot(
   before,resolveStockMaterialCostReference(before,'3cm','standard'));
  const changed=stone();
  changed.supplier='New Distributor';
  changed.variants![0].finish='Honed';
  const current=createQuoteMaterialCostSnapshot(
   changed,resolveStockMaterialCostReference(changed,'3cm','standard'));
  expect(compareQuoteMaterialSnapshot(quoted,current)).toMatchObject({
   changed:true,costChanged:false,sourceChanged:true,
  });
 });
});
