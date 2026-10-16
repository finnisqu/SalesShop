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
    expect(cost.knownCostSpreadPercent).toBeCloseTo(38.3,1);
    expect(cost.marginPercent).toBeUndefined();
    expect(cost.complete).toBe(false);
    expect(cost.missingCostItems).toEqual(['Fabrication / shop cost','Installation cost']);
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
  it('accepts fractional bought slabs without changing the rounded selling slab count or price',()=>{
    const q=fixture();
    const original=projectAreaCost(q,q.sections[0]);
    const selling=calculateAreaCustomerPrice('multiplier',{sf:50,slabs:original.slabCount,
      costPerSlab:700,multiplier:2});
    expect(selling).toBe(2800);
    q.sections[0].scope!.slabPurchaseQuantityOverride=1.25;
    const revised=projectAreaCost(q,q.sections[0]);
    expect(revised.suggestedSlabs).toBe(2);
    expect(revised.slabCount).toBe(2);
    expect(revised.purchaseSlabs).toBe(1.25);
    expect(revised.materialCost).toBe(875);
    expect(revised.totalKnownCost).toBe(1035);
    expect(revised.priceTotal).toBe(original.priceTotal);
    expect(calculateAreaCustomerPrice('multiplier',{sf:50,slabs:revised.slabCount,
      costPerSlab:700,multiplier:2})).toBe(selling);
  });
  it('adds optional shop and installation costs without changing selling amount',()=>{
    const q=fixture();
    const base=projectAreaCost(q,q.sections[0]);
    q.sections[0].scope!.shopCostOverride=125.5;
    q.sections[0].scope!.installCostOverride=180;
    const cost=projectAreaCost(q,q.sections[0]);
    expect(cost.shopCost).toBe(125.5);
    expect(cost.installCost).toBe(180);
    expect(cost.totalKnownCost).toBeCloseTo(base.totalKnownCost+305.5,2);
    expect(cost.priceTotal).toBe(base.priceTotal);
    expect(cost.complete).toBe(true);
    expect(cost.missingCostItems).toEqual([]);
    expect(cost.marginPercent).toBeLessThan(base.knownCostSpreadPercent!);
    q.sections[0].scope!.takeoffSinks![0].internalCostOverride=50;
    expect(projectAreaCost(q,q.sections[0]).sinkCost).toBe(100);
  });
  it('applies spreadsheet sample per-SF shop and installation costs without repricing customers',()=>{
    const q=fixture();const base=projectAreaCost(q,q.sections[0]);
    q.sections[0].scope!.shopCostRateSf=14;
    q.sections[0].scope!.installCostRateSf=5.5;
    q.sections[0].scope!.targetMargin=.25;
    const cost=projectAreaCost(q,q.sections[0]);
    expect(cost.shopCost).toBe(700);
    expect(cost.installCost).toBe(275);
    expect(cost.totalKnownCost).toBe(base.totalKnownCost+975);
    expect(cost.priceTotal).toBe(base.priceTotal);
    expect(cost.complete).toBe(true);
    expect(cost.missingCostItems).toEqual([]);
    expect(cost.marginPercent).toBeLessThan(base.knownCostSpreadPercent!);
    q.sections[0].scope!.shopCostOverride=100;
    expect(projectAreaCost(q,q.sections[0]).shopCost).toBe(100);
  });
  it('explicit zero labor costs count as entered; blank costs are still unknown',()=>{
    const q=fixture(),first=projectAreaCost(q,q.sections[0]);
    expect(first.costCoverage).toEqual({
      material:true,sinks:true,shop:false,install:false,other:true,
    });
    expect(first.complete).toBe(false);
    q.sections[0].scope!.shopCostRateSf=0;
    q.sections[0].scope!.installCostOverride=0;
    const second=projectAreaCost(q,q.sections[0]);
    expect(second.complete).toBe(true);
    expect(second.missingCostItems).toEqual([]);
    expect(second.marginPercent).toBeCloseTo(38.3,1);
    expect(second.priceTotal).toBe(first.priceTotal);
  });
  it('does not require a buying cost for a specification-only sink',()=>{
    const q=fixture();
    const source=q.sections[0].scope!.takeoffSinks![0];
    q.sections[0].scope!.takeoffSinks=[
      {...source,includeInPricing:false,sinkReference:undefined},
    ];
    q.lines=q.lines.filter(line=>!line.takeoffSinkId);
    q.sections[0].scope!.shopCostOverride=0;
    q.sections[0].scope!.installCostOverride=0;
    const cost=projectAreaCost(q,q.sections[0]);
    expect(cost.missingSinkCosts).toBe(0);
    expect(cost.sinkCost).toBe(0);
    expect(cost.costCoverage.sinks).toBe(true);
    expect(cost.complete).toBe(true);
  });
  it('reports missing charged sink and additional work costs separately',()=>{
    const q=fixture();
    q.sections[0].scope!.shopCostOverride=0;
    q.sections[0].scope!.installCostOverride=0;
    q.sections[0].scope!.takeoffSinks![0].sinkReference=undefined;
    q.lines.push({id:'extra',sectionId:'k',kind:'item',description:'Extra work',
      pricingMode:'direct',amount:100,includeInTotal:true,customerVisible:true});
    const cost=projectAreaCost(q,q.sections[0]);
    expect(cost.missingSinkCosts).toBe(1);
    expect(cost.missingCostItems).toEqual(['Sink buying costs','Other priced work costs']);
    expect(cost.complete).toBe(false);
    expect(cost.marginPercent).toBeUndefined();
    expect(cost.knownCostSpreadPercent).toBeUndefined();
  });
  it('prices three calculator modes but rejects unfinished multiplier inputs',()=>{
    expect(calculateAreaCustomerPrice('manual',{sf:50,amount:2500})).toBe(2500);
    expect(calculateAreaCustomerPrice('sf',{sf:50,rate:49})).toBe(2450);
    expect(calculateAreaCustomerPrice('multiplier',{sf:50,slabs:2,costPerSlab:700,multiplier:2.6})).toBe(3640);
    expect(calculateAreaCustomerPrice('multiplier',{sf:50,slabs:2,multiplier:2.6})).toBeUndefined();
  });
});
