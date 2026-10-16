import {describe,expect,it} from 'vitest';
import type {MaterialLevelGuideDocument} from '../types/materialLevelGuide';
import type {StockMaterial} from '../types/settings';
import {snapshotStockBuilderLevels} from './stockBuilderRateTemplate';
import {createTemplateSchedule} from './salesDocumentTemplates';

function guide():MaterialLevelGuideDocument{
  return {schemaVersion:3,id:'company-levels',name:'Approved Builder Levels',
    updatedAt:'2026-10-14T12:00:00Z',slabPricingThresholdCostPerSf:23,slabPricingMultiplier:2.2,
    history:[],rules:[
      {id:'level0',label:'Level 0',maxMaterialCost:9,customerRate:34,active:true,graniteOnly:true},
      {id:'level1',label:'Level 1',maxMaterialCost:12,customerRate:44,active:true},
      {id:'level2',label:'Level 2',maxMaterialCost:15,customerRate:54,active:true},
      {id:'level7',label:'Level 7',maxMaterialCost:23,customerRate:115,active:true,costBandConfirmed:false},
      {id:'inactive',label:'Discontinued',maxMaterialCost:30,customerRate:200,active:false},
    ]};
}
function material(id:string,name:string,type:StockMaterial['materialType'],cost?:number,
  opts:Partial<StockMaterial>={}):StockMaterial{
  return {id,name,materialType:type,unit:'sf',internalCost:cost,
    active:true,stockProgram:true,...opts};
}
describe('Builder Rate Schedule from Company stock levels',()=>{
  it('populates approved priced material-level cards with actual stocked colors',()=>{
    const stock=[
      material('g1','Azul Plata','Granite',8),
      material('g2','Moon White','Granite',10),
      material('q1','Bright White','Quartz',10),
      material('q2','Sparkling Black','Quartz',14),
    ];
    const {rates,summary}=snapshotStockBuilderLevels(stock,guide());
    expect(summary).toMatchObject({stockCount:4,assignedCount:4,unassigned:[],levelCount:4});
    expect(rates.map(r=>[r.level,r.materialType,r.rate])).toEqual([
      ['Level 0','Granite',34],
      ['Level 1','Granite',44],
      ['Level 1','Quartz',44],
      ['Level 2','Quartz',54],
    ]);
    expect(rates[0]).toMatchObject({unit:'sf',priceMode:'priced',
      name:'Level 0 Granite',sourceBuilderLevelRuleId:'level0',
      sourceBuilderLevelGuideUpdatedAt:'2026-10-14T12:00:00Z',
      colorIds:['g1'],colorsText:'Azul Plata',showLevelOnCustomer:true});
    expect(rates[1].colorsText).toBe('Moon White');
    expect(rates[2].colorsText).toBe('Bright White');
  });
  it('explicit builder level wins over automatic cost suggestions; overrides use approved sell rate',()=>{
    const {rates}=snapshotStockBuilderLevels([
      material('q1','Custom Quartz','Quartz',5,{builderLevelId:'level7'}),
    ],guide());
    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({level:'Level 7',rate:115,sourceBuilderLevelRuleId:'level7'});
    expect(rates[0].rate).not.toBe(5);
  });
  it('preserves duplicate color names from different brands with distinct stock IDs',()=>{
    const {rates}=snapshotStockBuilderLevels([
      material('a','Sparkling Black','Quartz',11,{brand:'Vicostone'}),
      material('b','Sparkling Black','Quartz',11,{brand:'Other Brand'}),
    ],guide());
    expect(rates).toHaveLength(1);
    expect(rates[0].colorIds).toHaveLength(2);
    expect(rates[0].colorsText).toContain('Other Brand · Sparkling Black');
    expect(rates[0].colorsText).toContain('Vicostone · Sparkling Black');
  });
  it('ignores inactive/nonstock materials and flags missing, incompatible or above-ceiling assignments',()=>{
    const {rates,summary}=snapshotStockBuilderLevels([
      material('yes','Granite Stock','Granite',8),
      material('no-cost','Unpriced Quartz','Quartz'),
      material('high','Premium Quartz','Quartz',28),
      material('wrong','Invalid assigned Quartz','Quartz',12,{builderLevelId:'level0'}),
      material('other','Cultured Marble','Cultured Marble',7),
      material('inactive','Inactive','Granite',8,{active:false}),
      material('non-stock','Special order','Quartz',10,{stockProgram:false}),
      material('bad-level','Inactive level','Granite',8,{builderLevelId:'inactive'}),
    ],guide());
    expect(rates).toHaveLength(1);
    expect(summary).toMatchObject({stockCount:6,assignedCount:1,levelCount:1});
    expect(summary.unassigned).toHaveLength(5);
    expect(summary.unassigned.find(x=>x.materialId==='no-cost')?.reason).toContain('purchase cost');
    expect(summary.unassigned.find(x=>x.materialId==='high')?.reason).toContain('above the level guide');
    expect(summary.unassigned.find(x=>x.materialId==='wrong')?.reason).toContain('reserved for Granite');
    expect(summary.unassigned.find(x=>x.materialId==='other')?.reason).toContain('Assign');
    expect(summary.unassigned.find(x=>x.materialId==='bad-level')?.reason).toContain('missing or inactive');
  });
  it('reads modern variant purchase costs instead of legacy generic prices',()=>{
    const m=material('modern','Modern Quartz','Quartz',3,{
      variants:[{id:'v',active:true,default:true,
        formatKind:'slab',lengthIn:120,widthIn:60,
        purchaseOptions:[{id:'p',label:'Stock',active:true,default:true,pricingBasis:'sf',costPerSf:13}]}],
    });
    const {rates}=snapshotStockBuilderLevels([m],guide());
    expect(rates[0].level).toBe('Level 2');
    expect(rates[0].rate).toBe(54);
  });
  it('creates an independently editable Builder Rate Schedule from stock tiers and non-material add-ons',()=>{
    const stock=[material('g','Granite Color','Granite',7),
      material('q','Quartz Color','Quartz',11)];
    const companyRates=[
      {id:'generic',name:'Generic material',category:'material',unit:'sf',active:true,
        sellRate:999,pricingBehavior:'suggested',divisionOverrides:[],history:[]},
      {id:'sink',name:'Kitchen sink',category:'sink',unit:'each',active:true,
        sellRate:220,pricingBehavior:'suggested',divisionOverrides:[],history:[]},
    ] as unknown as Parameters<typeof createTemplateSchedule>[4];
    const current=guide();
    const schedule=createTemplateSchedule('builder','builder-rates','company-rates',undefined,
      companyRates,stock,current);
    expect(schedule.publishSource).toBe('rate-sheet');
    expect(schedule.builder?.rates).toHaveLength(3);
    expect(schedule.builder?.rates.filter(rate=>rate.kind==='material-level')).toHaveLength(2);
    expect(schedule.builder?.rates.find(r=>r.name==='Kitchen sink')?.rate).toBe(220);
    expect(schedule.builder?.rates.some(rate=>rate.rate===999)).toBe(false);
    expect(schedule.builder?.stockLevelImport).toMatchObject({
      guideName:'Approved Builder Levels',stockCount:2,assignedCount:2,
    });
    expect(schedule.customerItems).toHaveLength(3);
    const rate=schedule.builder!.rates.find(r=>r.kind==='material-level')!;
    expect(rate.rate).toBe(34);
    expect(rate.colorsText).toBe('Granite Color');
    current.rules[0].customerRate=999;
    stock[0].name='Changed in Catalog';
    expect(rate.rate).toBe(34);
    expect(rate.colorsText).toBe('Granite Color');
    const newSchedule=createTemplateSchedule('second','builder-rates','company-rates',undefined,
      companyRates,stock,current);
    expect(newSchedule.builder?.rates.find(r=>r.kind==='material-level')?.rate).toBe(999);
  });
});
