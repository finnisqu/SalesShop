import {describe,it,expect} from 'vitest';
import type {Quote} from '../types/quote';
import {quotePricingScenarios} from './quotePricingScenarios';

const quote=():Quote=>({
 id:'estimate',quoteNumber:'DRAFT-estimate',documentType:'quote',
 originalQuoteDate:'2026-11-02',quoteDate:'2026-11-02',revision:0,status:'Draft',
 title:'Pricing review fixture',customerColumns:{quantity:true,rate:true,lineAmount:true},
 customerNotes:'',internalNotes:'',createdAt:'2026-11-02',updatedAt:'2026-11-02',
 history:[],sections:[{id:'kitchen',title:'Kitchen',customerVisible:true,
  scope:{takeoffPieces:[{id:'p1',name:'top',lengthIn:72,widthIn:20,count:1}],
   takeoffMaterial:'Quartz',slabAreaOverrideSf:20,slabCostOverride:50,
   slabCountOverride:1,shopCostOverride:30,installCostOverride:20}}],
 lines:[{id:'surface',sectionId:'kitchen',kind:'material',
  description:'Quartz',pricingMode:'quantity-rate',quantity:10,rate:50,internalCost:100,
  includeInTotal:true,customerVisible:true,
  quantitySource:{kind:'area-scope',sectionId:'kitchen',field:'countertopSf',
   capturedValue:10,appliedAt:'2026-11-02',syncMode:'live'}}],
});
describe('quote wide pricing scenarios',()=>{
 it('preserves actual total and compares cost-covered scenarios without writing quote',()=>{
  const q=quote(),old=JSON.stringify(q);
  const s=quotePricingScenarios(q);
  expect(s.complete).toBe(true);
  expect(s.knownCosts).toBe(150);
  expect(s.totalSf).toBe(10);
  expect(s.current.price).toBe(500);
  expect(s.current.margin).toBe(70);
  expect(s.target.price).toBe(214.29);
  expect(s.bySf.price).toBe(500);
  expect(s.bySlab.price).toBe(110);
  expect(JSON.stringify(q)).toBe(old);
 });
 it('does not present missing costs as a confirmed margin',()=>{
  const q=quote();
  delete q.sections[0].scope?.shopCostOverride;
  const s=quotePricingScenarios(q);
  expect(s.complete).toBe(false);
  expect(s.target.price).toBeUndefined();
  expect(s.current.margin).toBeUndefined();
  expect(s.missing.join(' ')).toContain('Fabrication');
 });
 it('can compare a temporary per-SF override and per-unit view',()=>{
  const s=quotePricingScenarios(quote(),.30,2.2,60,5);
  expect(s.bySf.price).toBe(600);
  expect(s.bySf.perUnit).toBe(120);
  expect(s.bySlab.perUnit).toBe(22);
 });
});
