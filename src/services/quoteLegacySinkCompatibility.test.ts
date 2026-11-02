import {describe,expect,it} from 'vitest';
import type {Quote,QuoteTakeoffSink} from '../types/quote';
import {quoteTotal} from '../types/quote';
import {patchQuoteTakeoffSinks,setQuoteTakeoffSinkCharge,takeoffSinkIncludedInQuote} from './quoteTakeoffsLite';
import {auditQuoteDraft} from './quoteDraftAudit';
const sink=(id:string,includeInPricing:boolean):QuoteTakeoffSink=>({
 id,category:'vanity',name:'Vanity bowl',count:2,includeInPricing,unitPrice:95,
});
const legacy=(kind:'spec'|'excluded'|'manual'):Quote=>{
 const selected=sink('legacy',kind!=='spec');
 const lines:Quote['lines']=[
  {id:'top',sectionId:'bath',kind:'item',description:'Countertop',pricingMode:'direct',
   amount:500,customerVisible:true,includeInTotal:true},
 ];
 if(kind==='excluded')lines.push({id:'old',sectionId:'bath',takeoffSinkId:'legacy',
  kind:'sink',description:'Sink',pricingMode:'quantity-rate',rate:95,quantity:2,
  customerVisible:false,includeInTotal:false});
 if(kind==='manual')lines.push({id:'old-manual',sectionId:'bath',kind:'sink',
  description:'Manually priced vanity bowl',pricingMode:'direct',amount:170,
  customerVisible:true,includeInTotal:true});
 return {id:'q',title:'Legacy vanity',documentType:'quote',status:'Draft',
  sections:[{id:'bath',title:'Bath',scope:{takeoffSinks:[selected]}}],
  lines,customerColumns:{quantity:true,rate:true,lineAmount:true}} as Quote;
};
describe('Classic-to-Beta sink billing compatibility',()=>{
 it('preserves a specification-only sink when editing its label',()=>{
  const q=legacy('spec');
  const changed=patchQuoteTakeoffSinks(q,'bath',[{...q.sections[0].scope!.takeoffSinks![0],name:'New label'}]);
  expect(quoteTotal(changed)).toBe(quoteTotal(q));
  expect(changed.lines).toHaveLength(q.lines.length);
  expect(takeoffSinkIncludedInQuote(changed,'bath','legacy')).toBe(false);
  expect(auditQuoteDraft(changed).blockers.some(x=>x.id.startsWith('sink:'))).toBe(false);
 });
 it('does not generate a managed charge from a legacy included flag without a matching line',()=>{
  const q=legacy('manual');
  const next=patchQuoteTakeoffSinks(q,'bath',[{...q.sections[0].scope!.takeoffSinks![0],count:3}]);
  expect(quoteTotal(next)).toBe(670);
  expect(next.lines).toHaveLength(2);
  expect(takeoffSinkIncludedInQuote(next,'bath','legacy')).toBe(false);
 });
 it('preserves an excluded line until explicit opt-in and supports opt-out',()=>{
  const q=legacy('excluded'),total=quoteTotal(q);
  const edited=patchQuoteTakeoffSinks(q,'bath',[{...q.sections[0].scope!.takeoffSinks![0],name:'Revised'}]);
  expect(quoteTotal(edited)).toBe(total);
  expect(edited.lines.find(x=>x.id==='old')?.includeInTotal).toBe(false);
  const billed=setQuoteTakeoffSinkCharge(edited,'bath','legacy',true);
  expect(quoteTotal(billed)).toBe(total+190);
  expect(takeoffSinkIncludedInQuote(billed,'bath','legacy')).toBe(true);
  const unbilled=setQuoteTakeoffSinkCharge(billed,'bath','legacy',false);
  expect(quoteTotal(unbilled)).toBe(total);
  expect(unbilled.lines).toHaveLength(1);
 });
 it('charges a newly added sink once while preserving existing manual sink pricing',()=>{
  const q=legacy('manual');
  const next=patchQuoteTakeoffSinks(q,'bath',[...q.sections[0].scope!.takeoffSinks!,sink('new',true)]);
  expect(quoteTotal(next)).toBe(860);
  expect(next.lines.filter(x=>x.takeoffSinkId==='new')).toHaveLength(1);
  expect(next.lines.find(x=>x.id==='old-manual')).toEqual(q.lines[1]);
 });
 it('distinguishes blank price and explicit $0 after inclusion',()=>{
  const q=legacy('spec');
  q.sections[0].scope!.takeoffSinks![0].unitPrice=undefined;
  const billed=setQuoteTakeoffSinkCharge(q,'bath','legacy',true);
  expect(auditQuoteDraft(billed).blockers.some(x=>x.id==='sink:legacy:price')).toBe(true);
  const free=patchQuoteTakeoffSinks(billed,'bath',[{...billed.sections[0].scope!.takeoffSinks![0],unitPrice:0}]);
  expect(auditQuoteDraft(free).review.some(x=>x.id==='sink:legacy:complimentary')).toBe(true);
 });
});
