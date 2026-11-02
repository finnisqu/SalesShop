import {describe,expect,it} from 'vitest';
import type {Quote,QuoteLine,QuoteTakeoffPiece} from '../types/quote';
import {quoteTotal,quoteLinesTotal} from '../types/quote';
import {quickAreaSummary,quickGeneralSummary} from './quoteQuickAreaSummary';
import {patchQuoteTakeoff,patchQuoteTakeoffSinks,ensureSmartTakeoffLine} from './quoteTakeoffsLite';
import {applyQuoteScopeRowBatch} from './quoteScopeRowBatch';
import {quoteDeliveryApprovalKey,approvedCustomerDraft} from './quoteDeliveryApproval';

const piece:QuoteTakeoffPiece={id:'top',name:'Vanity top',lengthIn:60,widthIn:25.5,
 count:1,backsplash:true,splashHeightIn:4};
const initial=():Quote=>({
 id:'q',title:'Builder estimate',status:'Draft',documentType:'quote',revision:0,
 updatedAt:'2026-11-02T20:00:00.000Z',
 customerColumns:{quantity:true,rate:true,lineAmount:true},
 sections:[
  {id:'bath',title:'Bathroom',customerVisible:true,scope:{
   takeoffPieces:[],takeoffSinks:[],takeoffMaterial:'Quartz',billableSfRounding:'whole-up'}},
  {id:'laundry',title:'Laundry',customerVisible:true,scope:{countertopSf:8,takeoffPieces:[],
   takeoffSinks:[],takeoffMaterial:'Quartz'}},
 ],
 lines:[
  {id:'laundry-stone',sectionId:'laundry',kind:'material',
   description:'Quartz',pricingMode:'quantity-rate',quantity:8,rate:54,
   includeInTotal:true,customerVisible:true},
 ],
} as Quote);
const charge=(id:string,sectionId:string|undefined,amount:number):QuoteLine=>({
 id,sectionId,kind:'item',description:id,pricingMode:'direct',
 amount,includeInTotal:true,customerVisible:true,
});
function assertParity(q:Quote){
 const areaTotals=q.sections.map(area=>quickAreaSummary(q,area).total);
 const general=quickGeneralSummary(q).total;
 expect(areaTotals.reduce((sum,value)=>sum+value,general)).toBeCloseTo(quoteTotal(q),7);
 expect(quoteLinesTotal(q.lines)).toBeCloseTo(quoteTotal(q),7);
 for(const section of q.sections){
  const values=quickAreaSummary(q,section);
  expect(values.materialPrice+values.sinkPrice+values.specialtyPrice)
   .toBeCloseTo(values.total,7);
 }
}

describe('Quick Quote pricing parity across the selling workflow',()=>{
 it('keeps line, Area and General totals equal as takeoffs, sinks and charges change',()=>{
  let q=patchQuoteTakeoff(initial(),'bath',[piece]);
  q=ensureSmartTakeoffLine(q,'bath');
  q={...q,lines:q.lines.map(l=>l.sectionId==='bath'?
   {...l,rate:54}:l).concat([charge('Freight',undefined,120)])};
  assertParity(q);
  const billable=quickAreaSummary(q,q.sections[0]).billedSf;
  expect(billable).toBeGreaterThan(0);
  expect(Number.isInteger(billable)).toBe(true);
  q=patchQuoteTakeoffSinks(q,'bath',[{id:'s1',name:'1813',
   category:'vanity',count:2,unitPrice:75,includeInPricing:true}]);
  assertParity(q);
  expect(quickAreaSummary(q,q.sections[0]).sinkPrice).toBe(150);
  expect(quickAreaSummary(q,q.sections[0]).specialtyPrice).toBe(0);
  q={...q,lines:[...q.lines,charge('Service', 'bath',40)]};
  assertParity(q);
  expect(quickGeneralSummary(q).total).toBe(120);
  expect(quickAreaSummary(q,q.sections[0]).specialtyPrice).toBe(40);
 });
 it('does not double count a sink or lose the general total when exclusions change',()=>{
  let q=patchQuoteTakeoff(initial(),'bath',[piece]);
  q=ensureSmartTakeoffLine(q,'bath');
  q={...q,lines:q.lines.map(l=>l.sectionId==='bath'?{...l,rate:54}:l)
   .concat([charge('Delivery',undefined,90)])};
  q=patchQuoteTakeoffSinks(q,'bath',[{id:'s1',name:'1813',
   category:'vanity',count:2,unitPrice:75,includeInPricing:true}]);
  assertParity(q);
  const before=JSON.stringify(q);
  const excluded=applyQuoteScopeRowBatch(q,[{kind:'sink',id:'s1',sectionId:'bath'}],'exclude');
  expect(JSON.stringify(q)).toBe(before);
  assertParity(excluded);
  expect(quickAreaSummary(excluded,excluded.sections[0]).sinkPrice).toBe(0);
  expect(quickGeneralSummary(excluded).total).toBe(90);
  const restored=applyQuoteScopeRowBatch(excluded,[{kind:'sink',id:'s1',sectionId:'bath'}],'restore');
  assertParity(restored);
  expect(quickAreaSummary(restored,restored.sections[0]).sinkPrice).toBe(150);
 });
 it('keeps struck-out takeoff geometry while protecting the approved customer price',()=>{
  let q=patchQuoteTakeoff(initial(),'bath',[piece]);
  q=ensureSmartTakeoffLine(q,'bath');
  q={...q,lines:q.lines.map(l=>l.sectionId==='bath'?{...l,rate:54}:l)};
  const approval=quoteDeliveryApprovalKey(q);
  expect(approvedCustomerDraft(q,approval,approval)).toBe(true);
  const changed=applyQuoteScopeRowBatch(q,[{kind:'piece',id:'top',sectionId:'bath'}],'exclude');
  assertParity(changed);
  expect(changed.sections[0].scope?.takeoffPieces?.[0].excludedFromQuote).toBe(true);
  expect(changed.sections[0].scope?.takeoffPieces?.[0].lengthIn).toBe(60);
  expect(approvedCustomerDraft(changed,approval,approval)).toBe(false);
  const restored=applyQuoteScopeRowBatch(changed,[{kind:'piece',id:'top',sectionId:'bath'}],'restore');
  assertParity(restored);
 });
 it('accounts for unassigned/orphaned charges in General instead of dropping selling value',()=>{
  const q=initial();
  q.lines.push(charge('Fallback charge','deleted-area',20),charge('Delivery',undefined,10));
  assertParity(q);
  expect(quickGeneralSummary(q).total).toBe(30);
 });
});
