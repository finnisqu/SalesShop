import {describe,expect,it} from 'vitest';
import {resolveMaterialPricingRecommendation} from '../types/materialLevelGuide';
import {builderLevelRateReference} from './builderLevelRate';
import type {MaterialLevelRule} from '../types/materialLevelGuide';

const granite:MaterialLevelRule={id:'level-0',label:'Level 0',maxMaterialCost:26,
 customerRate:34,active:true,graniteOnly:true};
const quartz:MaterialLevelRule={id:'level-1',label:'Level 1',maxMaterialCost:40,
 customerRate:54,active:true};
const guide={
 id:'material-guide',updatedAt:'2026-11-02T15:00:00Z',
 slabPricingThresholdCostPerSf:50,slabPricingMultiplier:2.2,
 rules:[granite,quartz],
};

describe('Quick Quote advisory material pricing',()=>{
 it('never suggests a granite-only level for a quartz selection',()=>{
  const suggestion=resolveMaterialPricingRecommendation(guide,24,undefined,'quartz');
  expect(suggestion.mode).toBe('level');
  if(suggestion.mode==='level'){
   expect(suggestion.level.rule.id).toBe('level-1');
   expect(suggestion.level.customerRate).toBe(54);
  }
 });
 it('keeps the granite level available for a qualifying granite selection',()=>{
  const suggestion=resolveMaterialPricingRecommendation(guide,24,undefined,'granite');
  expect(suggestion.mode).toBe('level');
  if(suggestion.mode==='level')expect(suggestion.level.rule.id).toBe('level-0');
 });
 it('asks for a buying cost rather than inventing a rate',()=>{
  expect(resolveMaterialPricingRecommendation(guide,undefined,undefined,'quartz').mode).toBe('needs-cost');
 });
 it('requests a separate slab review for above-threshold material',()=>{
  expect(resolveMaterialPricingRecommendation(guide,62,undefined,'quartz').mode).toBe('slab-review');
 });
 it('stores a snapshot when a salesperson explicitly selects the suggestion',()=>{
  const snapshot=builderLevelRateReference(guide,quartz,'Residential Builder',
   '2026-11-02T16:00:00Z');
  expect(snapshot.snapshot?.sellRate).toBe(54);
  expect(snapshot.snapshot?.pricingDivision).toBe('Residential Builder');
  expect(snapshot.rateBookItemId).toBe('level-1');
  const changed={...quartz,customerRate:64};
  expect(changed.customerRate).toBe(64);
  expect(snapshot.snapshot?.sellRate).toBe(54);
 });
});
