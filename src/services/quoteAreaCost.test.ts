import {describe,expect,it} from 'vitest';
import {calculateAreaCustomerPrice,DEFAULT_SLAB_YIELD,projectAreaCost} from './quoteAreaCost';
import type {Quote} from '../types/quote';
const fixture=():Quote=>({
  id:'q',sections:[{id:'k',title:'Kitchen',customerVisible:true,scope:{
    takeoffPieces:[{id:'p',name:'top',count:1,lengthIn:120,widthIn:60}],
    takeoffMaterialReference:{stockProgram:true,pricingSource:'manual-line-rate',
      sourceCostPerSf:12,snapshot:{capturedAt:'x',materialId:'mat',materialName:'Quartz',materialType:'Quartz',
        stockProgram:true,areaSf:50,slabCost:700}},
    takeoffSinks:[{id:'sink',category:'kitchen',name:'3218',count:2,includeInPricing:true,
      sinkReference:{snapshot:{capturedAt:'x',sinkModelId:'sink',sinkModelName:'3218',
        category:'kitchen',variantId:'v',variantLabel:'standard',configuration:'single',
        ada:false,internalCost:80}}}],
  }}],lines:[
    {id:'material',sectionId:'k',kind:'material',description:'Countertops',pricingMode:'quantity-rate',
      quantity:50,rate:45,includeInTotal:true,customerVisible:true},
    {id:'sinkrow',sectionId:'k',kind:'sink',description:'Sink',pricingMode:'quantity-rate',
      quantity:2,rate:140,includeInTotal:true,customerVisible:false,takeoffSinkId:'sink'}
  ],
}) as Quote;
describe('Area slab yield and internal margin',()=>{
  it('defaults yield to 65% and uses purchased whole slabs not measured SF',()=>{
    const q=fixture();const cost=projectAreaCost(q,q.sections[0]);
    expect(DEFAULT_SLAB_YIELD).toBe(.65);
    expect(cost.measuredSf).toBe(50);
    expect(cost.suggestedSlabs).toBe(2);
    expect(cost.materialCost).toBe(1400);
    expect(cost.sinkCost).toBe(160);
    expect(cost.totalKnownCost).toBe(1560);
    expect(cost.priceTotal).toBe(2530);
    expect(cost.marginPercent).toBeCloseTo(38.3,1);
  });
  it('slab quantity override and customer pricing choice do not impact physical cost',()=>{
    const q=fixture();
    q.sections[0].scope!.slabYield=.5;
    q.sections[0].scope!.slabCountOverride=3;
    const base=projectAreaCost(q,q.sections[0]);
    expect(base.suggestedSlabs).toBe(2);
    expect(base.materialCost).toBe(2100);
    q.lines[0].pricingMode='direct';q.lines[0].amount=2200;
    expect(projectAreaCost(q,q.sections[0]).materialCost).toBe(2100);
    q.lines[0].pricingMode='slab-multiplier';q.lines[0].amount=4200;
    expect(projectAreaCost(q,q.sections[0]).materialCost).toBe(2100);
  });
  it('never invents supplier size or a complete margin when cost is unknown',()=>{
    const q=fixture();q.sections[0].scope!.takeoffMaterialReference=undefined;
    const c=projectAreaCost(q,q.sections[0]);
    expect(c.slabCount).toBeUndefined();
    expect(c.materialCost).toBeUndefined();
    expect(c.complete).toBe(false);
    expect(c.marginPercent).toBeUndefined();
  });
  it('prices three calculator modes but rejects unfinished multiplier inputs',()=>{
    expect(calculateAreaCustomerPrice('manual',{sf:50,amount:2500})).toBe(2500);
    expect(calculateAreaCustomerPrice('sf',{sf:50,rate:49})).toBe(2450);
    expect(calculateAreaCustomerPrice('multiplier',{sf:50,slabs:2,costPerSlab:700,multiplier:2.6})).toBe(3640);
    expect(calculateAreaCustomerPrice('multiplier',{sf:50,slabs:2,multiplier:2.6})).toBeUndefined();
  });
});
