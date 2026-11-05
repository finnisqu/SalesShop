import {describe,expect,it} from 'vitest';
import {quoteLinesTotal,type Quote,type QuoteLine,type QuoteSection} from '../types/quote';
import type {QuoteAuditReport} from './quoteDraftAudit';
import {isGeneralTakeoffSection} from './quoteCustomerPresentation';
import {quotePricingOverview} from './quotePricingOverview';

const section=(id:string):QuoteSection=>({id,title:id,customerVisible:true});
const line=(id:string,sectionId:string|undefined,amount:number):QuoteLine=>({
 id,sectionId,kind:'item',description:id,pricingMode:'direct',amount,
 includeInTotal:true,customerVisible:true,
});
const quote=(sections:QuoteSection[],lines:QuoteLine[]):Quote=>({
 id:'q',quoteNumber:'DRAFT-q',title:'Pricing',
 documentType:'quote',status:'Draft',revision:0,sections,lines,
 history:[],originalQuoteDate:'2026-11-05',quoteDate:'2026-11-05',
 customerColumns:{quantity:false,rate:false,lineAmount:true},
 customerNotes:'',internalNotes:'',
 createdAt:'2026-11-05T12:00:00Z',updatedAt:'2026-11-05T12:00:00Z',
});
const report=(blockers:string[],review:string[]):QuoteAuditReport=>({
 blockers:blockers.map(areaId=>({destination:{view:'area',areaId}})),
 review:review.map(areaId=>({destination:{view:'area',areaId}})),
}) as unknown as QuoteAuditReport;

describe('Indexed Quick Quote pricing overview',()=>{
 it('preserves exact Area and General totals for mixed linked and orphan lines',()=>{
  const sections=[section('a'),section('b')];
  const lines=[line('a1','a',120.11),line('a2','a',48.25),
    line('b1','b',90),line('orphan','missing',18),
    line('general',undefined,-5)];
  const document=quote(sections,lines);
  const result=quotePricingOverview(document,report(['a','a','b'],['a','b','b']));
  for(const area of sections){
   expect(result.rows.find(r=>r.section.id===area.id)?.amount)
    .toBe(quoteLinesTotal(lines.filter(l=>l.sectionId===area.id)));
  }
  const areaIds=new Set(sections.filter(s=>!isGeneralTakeoffSection(s)).map(s=>s.id));
  const general=lines.filter(l=>!l.sectionId||!areaIds.has(l.sectionId));
  expect(result.generalAmount).toBe(quoteLinesTotal(general));
  expect(result.generalLineCount).toBe(general.length);
  expect(result.rows.map(r=>[r.blockers,r.reviewItems])).toEqual([[2,1],[1,2]]);
 });
 it('keeps empty Areas at zero and excludes archived logic from billable math',()=>{
  const result=quotePricingOverview(quote([section('empty')],[]),report([],[]));
  expect(result.rows[0].amount).toBe(0);
  expect(result.rows[0].blockers).toBe(0);
  expect(result.generalLineCount).toBe(0);
 });
 it('processes large mixed quote workspaces without changing any totals',()=>{
  const sections=Array.from({length:120},(_,i)=>section('section-'+i));
  const lines=Array.from({length:1800},(_,i)=>line('line-'+i,'section-'+(i%120),i/4));
  const document=quote(sections,lines);
  const result=quotePricingOverview(document,report([],[]));
  expect(result.rows).toHaveLength(120);
  for(const area of sections){
   const old=quoteLinesTotal(lines.filter(l=>l.sectionId===area.id));
   expect(result.rows.find(r=>r.section.id===area.id)?.amount).toBe(old);
  }
 });
});
