import { describe,expect,it } from 'vitest';
import { DEFAULT_BUILDER_LEVEL_RATES,upgradeBuilderLevelGuide } from '../store/materialLevelGuideStore';
import { builderLevelRateReference,selectableBuilderLevels } from './builderLevelRate';
import { materialLevelCostBand,resolveMaterialLevel,resolveMaterialPricingRecommendation,type MaterialLevelGuideDocument,type MaterialLevelRule } from '../types/materialLevelGuide';

const legacyRules:MaterialLevelRule[]=[
  {id:'builder_level_1',label:'Level 1',maxMaterialCost:9,customerRate:34,active:true},
  {id:'builder_level_2',label:'Level 2',maxMaterialCost:12,customerRate:44,active:true},
  {id:'builder_level_3',label:'Level 3',maxMaterialCost:14,customerRate:54,active:true},
  {id:'builder_level_4',label:'Level 4',maxMaterialCost:16,customerRate:60,active:true},
  {id:'builder_level_5',label:'Level 5',maxMaterialCost:19,customerRate:68,active:true},
  {id:'builder_level_6',label:'Level 6',maxMaterialCost:21,customerRate:75,active:true},
  {id:'builder_level_7',label:'Level 7',maxMaterialCost:23,customerRate:85,active:true},
];
function guide(rules=legacyRules):MaterialLevelGuideDocument{
  return {schemaVersion:3,id:'standard-builder-level-guide',name:'Builder',rules,
    slabPricingThresholdCostPerSf:23,slabPricingMultiplier:2.2,
    history:[],updatedAt:'2026-10-06T15:52:00.000Z'};
}
describe('Stock / Builder quote Levels 0–8',()=>{
  it('upgrades the old untouched 1–7 defaults to a full editable nine-level guide',()=>{
    const upgraded=upgradeBuilderLevelGuide(guide());
    const rules=selectableBuilderLevels(upgraded.rules);
    expect(rules.map(rule=>rule.label)).toEqual(Array.from({length:9},(_,i)=>'Level '+i));
    expect(rules.map(rule=>rule.customerRate)).toEqual([...DEFAULT_BUILDER_LEVEL_RATES]);
    expect(upgraded.history[0]?.note).toContain('historical granite/quartz');
    expect(upgraded.history[0]?.rules).toEqual(legacyRules);
    expect(upgraded.slabPricingThresholdCostPerSf).toBe(23);
    expect(upgradeBuilderLevelGuide(upgraded)).toBe(upgraded);
  });
  it('does not replace company-customized rates and still supplies missing 0 and 8',()=>{
    const customized=guide(legacyRules.map(rule=>rule.id==='builder_level_1'
      ?{...rule,customerRate:52}:rule));
    customized.slabPricingThresholdCostPerSf=25;
    const upgraded=upgradeBuilderLevelGuide(customized);
    expect(upgraded.rules.find(rule=>rule.id==='builder_level_1')?.customerRate).toBe(52);
    expect(upgraded.rules.find(rule=>rule.id==='builder_level_0')?.customerRate).toBe(34);
    expect(upgraded.rules.find(rule=>rule.id==='builder_level_8')?.customerRate).toBe(125);
    expect(upgraded.slabPricingThresholdCostPerSf).toBe(25);
  });
  it('snapshots source ID, selected price and quoted division independently of future edits',()=>{
    const upgraded=upgradeBuilderLevelGuide(guide());
    const rule=upgraded.rules.find(rule=>rule.id==='builder_level_2')!;
    const ref=builderLevelRateReference(upgraded,rule,'Residential Builder','2026-10-12T14:00:00Z');
    expect(ref.rateBookItemId).toBe('builder_level_2');
    expect(ref.snapshot).toMatchObject({name:'Stock / Builder Level 2',sellRate:54,
      unit:'sf',category:'material',pricingDivision:'Residential Builder',
      capturedAt:'2026-10-12T14:00:00Z'});
    rule.customerRate=999;
    expect(ref.snapshot?.sellRate).toBe(54);
  });
  it('restores the exact seven historical material cost bands without assigning 7/8 unknown ranges',()=>{
    const upgraded=upgradeBuilderLevelGuide(guide());
    const expected=[
      [0,9,34],[1,12,44],[2,14,54],[3,16,60],
      [4,19,68],[5,21,75],[6,23,85],
    ];
    expected.forEach(([level,ceiling,rate])=>{
      const rule=upgraded.rules.find(r=>r.id==='builder_level_'+level)!;
      expect(rule.maxMaterialCost).toBe(ceiling);
      expect(rule.customerRate).toBe(rate);
    });
    expect(materialLevelCostBand(upgraded.rules,upgraded.rules[0])).toContain('Granite only');
    expect(materialLevelCostBand(upgraded.rules,upgraded.rules[1])).toContain('First quartz');
    for(const level of [7,8]){
      const extra=upgraded.rules.find(r=>r.id==='builder_level_'+level)!;
      expect(extra.costBandConfirmed).toBe(false);
      expect(materialLevelCostBand(upgraded.rules,extra)).toContain('not assigned');
    }
    expect(resolveMaterialLevel(upgraded.rules,8,undefined,'Granite')?.rule.id).toBe('builder_level_0');
    expect(resolveMaterialLevel(upgraded.rules,8,undefined,'Quartz')?.rule.id).toBe('builder_level_1');
    const guidePolicy={...upgraded,slabPricingThresholdCostPerSf:23};
    expect(resolveMaterialPricingRecommendation(guidePolicy,23.01,undefined,'Quartz').mode).toBe('slab-review');
  });
  it('upgrades previously shipped Level 0–8 rates while retaining user-edited values',()=>{
    const previous:MaterialLevelRule[]=[
      [0,7,34],[1,9,54],[2,12,65],[3,14,75],[4,16,85],
      [5,19,95],[6,21,105],[7,23,115],[8,26,125],
    ].map(([level,maxMaterialCost,customerRate])=>({
      id:'builder_level_'+level,label:'Level '+level,maxMaterialCost,customerRate,active:true,
    }));
    const shipped=guide(previous);shipped.slabPricingThresholdCostPerSf=26;
    const updated=upgradeBuilderLevelGuide(shipped);
    expect(updated.rules.slice(0,7).map(r=>r.customerRate)).toEqual([34,44,54,60,68,75,85]);
    expect(updated.slabPricingThresholdCostPerSf).toBe(23);
    expect(updated.history[0].rules).toEqual(previous);
    expect(upgradeBuilderLevelGuide(updated)).toBe(updated);
    const customized=guide(previous.map(r=>r.id==='builder_level_2'?{...r,customerRate:58}:r));
    customized.slabPricingThresholdCostPerSf=26;
    const preserved=upgradeBuilderLevelGuide(customized);
    expect(preserved.rules.find(r=>r.id==='builder_level_2')?.customerRate).toBe(58);
    expect(preserved.rules.find(r=>r.id==='builder_level_2')?.maxMaterialCost).toBe(14);
    expect(upgradeBuilderLevelGuide(preserved)).toBe(preserved);
  });

});
