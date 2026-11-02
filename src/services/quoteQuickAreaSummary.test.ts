import {describe,expect,it} from 'vitest';
import type {Quote,QuoteSection} from '../types/quote';
import {quickAreaPrimary,quickAreaSummary,quickGeneralSummary,quickRoundedSf} from './quoteQuickAreaSummary';
import {quoteTotal} from '../types/quote';

const area=(id:string,title:string):QuoteSection=>({
 id,title,customerVisible:true,customerDisplayMode:'detail',
 scope:{countertopSf:id==='k'?43:13,takeoffMaterial:'3CM Valle Nevado Granite',
  takeoffSinks:id==='k'?[{id:'sink-k',category:'kitchen',name:'3218',
   count:1,unitPrice:220,includeInPricing:true}]:[{id:'sink-b',category:'vanity',
    name:'1813',count:2,unitPrice:75,includeInPricing:true}]},
});
const quote=():Quote=>({
 id:'q',title:'Quick quote',status:'Draft',documentType:'quote',
 sections:[area('k','Kitchen'),area('b','Bathroom')],
 lines:[
  {id:'mat-k',sectionId:'k',kind:'material',description:'Stone Kitchen',pricingMode:'quantity-rate',
   quantity:43,rate:36,customerVisible:true,includeInTotal:true},
  {id:'sink-k',sectionId:'k',kind:'sink',takeoffSinkId:'sink-k',description:'3218',
   pricingMode:'quantity-rate',quantity:1,rate:220,customerVisible:false,includeInTotal:true},
  {id:'mat-b',sectionId:'b',kind:'material',description:'Stone Bathroom',pricingMode:'quantity-rate',
   quantity:13,rate:36,customerVisible:true,includeInTotal:true},
  {id:'sink-b',sectionId:'b',kind:'sink',takeoffSinkId:'sink-b',description:'1813',
   pricingMode:'quantity-rate',quantity:2,rate:75,customerVisible:false,includeInTotal:true},
 ]} as Quote);

describe('Quick Quote compact Area price parity',()=>{
 it('rolls stone and sink charges into exactly one total per room',()=>{
  const q=quote();
  const kitchen=quickAreaSummary(q,q.sections[0]);
  const bath=quickAreaSummary(q,q.sections[1]);
  expect(kitchen.materialPrice).toBe(1548);
  expect(kitchen.sinkPrice).toBe(220);
  expect(kitchen.sinkQuantity).toBe(1);
  expect(kitchen.total).toBe(1768);
  expect(bath.materialPrice).toBe(468);
  expect(bath.sinkPrice).toBe(150);
  expect(bath.sinkQuantity).toBe(2);
  expect(bath.total).toBe(618);
  expect(quoteTotal(q)).toBe(2386);
 });
 it('keeps priced sinks in the sink bucket, not specialty',()=>{
  const q=quote();
  q.lines.push({id:'shipping',sectionId:'k',kind:'item',description:'Freight',
   pricingMode:'direct',amount:125,includeInTotal:true,customerVisible:true});
  const kitchen=quickAreaSummary(q,q.sections[0]);
  expect(kitchen.sinkPrice).toBe(220);
  expect(kitchen.specialtyPrice).toBe(125);
  expect(kitchen.specialtyQuantity).toBe(1);
  expect(kitchen.total).toBe(1893);
 });
 it('retains excluded fixtures but removes their selling price and active quantity',()=>{
  const q=quote();
  q.sections[0].scope!.takeoffSinks![0].excludedFromContract=true;
  q.lines[1].includeInTotal=false;
  const result=quickAreaSummary(q,q.sections[0]);
  expect(result.sinkQuantity).toBe(0);
  expect(result.sinkPrice).toBe(0);
  expect(result.total).toBe(1548);
 });
 it('does not treat independently quoted material as two separate primary charges',()=>{
  const q=quote();
  expect(quickAreaPrimary(q,'k')?.id).toBe('mat-k');
  expect(quickAreaPrimary(q,'b')?.id).toBe('mat-b');
 });
 it('keeps general adjustments out of Area totals',()=>{
  const q=quote();
  q.lines.push({id:'f',kind:'item',description:'Delivery',pricingMode:'direct',amount:75,
   customerVisible:true,includeInTotal:true});
  expect(quickAreaSummary(q,q.sections[0]).total).toBe(1768);
  expect(quickGeneralSummary(q).total).toBe(75);
  expect(quoteTotal(q)).toBe(2461);
 });
 it('supports manual SF-only quoting with explicit customer billing rounding',()=>{
  const q=quote();
  q.sections[0].scope={...q.sections[0].scope,
   takeoffPieces:[],countertopSf:42.83,billableSfRounding:'whole-up'};
  const data=quickAreaSummary(q,q.sections[0]);
  expect(data.measuredSf).toBe(42.83);
  expect(data.billedSf).toBe(43);
  expect(quickRoundedSf(12.51,'whole-up')).toBe(13);
  expect(quickRoundedSf(12.51,'quarter-up')).toBe(12.75);
  expect(quickRoundedSf(12.51,'exact')).toBe(12.51);
 });
 it('never changes the source quote when projecting summary values',()=>{
  const q=quote(),before=JSON.stringify(q);
  quickAreaSummary(q,q.sections[0]);
  quickGeneralSummary(q);
  expect(JSON.stringify(q)).toBe(before);
 });
});
