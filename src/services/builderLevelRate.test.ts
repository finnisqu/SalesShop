import { describe,expect,it } from 'vitest';
import { DEFAULT_BUILDER_LEVEL_RATES,upgradeBuilderLevelGuide } from '../store/materialLevelGuideStore';
import { builderLevelRateReference,selectableBuilderLevels } from './builderLevelRate';
import type { MaterialLevelGuideDocument,MaterialLevelRule } from '../types/materialLevelGuide';

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
    expect(upgraded.history[0]?.note).toContain('Before Stock');
    expect(upgraded.history[0]?.rules).toEqual(legacyRules);
    expect(upgraded.slabPricingThresholdCostPerSf).toBe(26);
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
    expect(ref.snapshot).toMatchObject({name:'Stock / Builder Level 2',sellRate:65,
      unit:'sf',category:'material',pricingDivision:'Residential Builder',
      capturedAt:'2026-10-12T14:00:00Z'});
    rule.customerRate=999;
    expect(ref.snapshot?.sellRate).toBe(65);
  });
});
