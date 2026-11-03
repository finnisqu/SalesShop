import {describe,expect,it} from 'vitest';
import type {Quote,QuoteLine,QuoteTakeoffPiece,QuoteTakeoffSink} from '../types/quote';
import {quoteTotal} from '../types/quote';
import {patchQuoteTakeoff,patchQuoteTakeoffSinks,ensureSmartTakeoffLine} from './quoteTakeoffsLite';
import {duplicateQuoteScopeRows} from './quoteScopeRowDuplicate';
import {quoteDeliveryApprovalKey,approvedCustomerDraft} from './quoteDeliveryApproval';

const piece:QuoteTakeoffPiece={id:'p1',name:'Kitchen countertop',lengthIn:48,
 widthIn:24,count:1,backsplash:true,splashHeightIn:4,edgeProfile:'Flat'};
const sink:QuoteTakeoffSink={id:'s1',category:'kitchen',name:'Sink 3218',
 count:2,unitPrice:125,includeInPricing:true};
const charge:QuoteLine={id:'fee',sectionId:'k',kind:'item',description:'Delivery',
 pricingMode:'direct',amount:75,includeInTotal:true,customerVisible:true};
const q=():Quote=>({
 id:'q',quoteNumber:'DRAFT-1',title:'Duplicate rows',status:'Draft',
 documentType:'quote',revision:0,originalQuoteDate:'2026-11-02',
 quoteDate:'2026-11-02',createdAt:'2026-11-02T20:00:00Z',
 updatedAt:'2026-11-02T20:00:00Z',customerNotes:'',internalNotes:'',history:[],
 customerColumns:{quantity:true,rate:true,lineAmount:true},
 sections:[{id:'k',title:'Kitchen',customerVisible:true,
 scope:{takeoffMaterial:'Quartz',takeoffPieces:[],takeoffSinks:[]}}],
 lines:[],
});
const nextId=()=>{
 const used=new Map<string,number>();
 return (kind:string)=>{const n=(used.get(kind)??0)+1;used.set(kind,n);return kind+'-copy-'+n;};
};
const setup=()=>{
 let quote=patchQuoteTakeoff(q(),'k',[piece]);
 quote=ensureSmartTakeoffLine(quote,'k');
 quote={...quote,lines:quote.lines.map(line=>({...line,rate:54}))};
 quote=patchQuoteTakeoffSinks(quote,'k',[sink]);
 return {...quote,lines:[...quote.lines,charge]};
};
describe('Quick Quote Takeoffs duplication',()=>{
 it('duplicates geometry with independent IDs and live priced SF updated once',()=>{
  const original=setup();
  const oldTotal=quoteTotal(original);
  const copied=duplicateQuoteScopeRows(original,[{kind:'piece',id:'p1',sectionId:'k'}],nextId())!;
  const pieces=copied.quote.sections[0].scope?.takeoffPieces??[];
  expect(copied.duplicated).toBe(1);
  expect(pieces.map(p=>p.id)).toEqual(['p1','piece-copy-1']);
  expect(pieces[1]).toMatchObject({
   name:'Kitchen countertop copy',lengthIn:48,widthIn:24,backsplash:true,edgeProfile:'Flat'});
  expect(copied.quote.lines.filter(l=>l.quantitySource?.syncMode==='live')).toHaveLength(1);
  expect(quoteTotal(copied.quote)).toBeGreaterThan(oldTotal);
  pieces[1].lengthIn=80;
  expect(original.sections[0].scope?.takeoffPieces?.[0].lengthIn).toBe(48);
  expect(original.sections[0].scope?.takeoffPieces).toHaveLength(1);
 });
 it('duplicates a sink and creates exactly one independent managed charge',()=>{
  const original=setup();
  const before=quoteTotal(original);
  const copied=duplicateQuoteScopeRows(original,[{kind:'sink',id:'s1',sectionId:'k'}],nextId())!;
  const sinks=copied.quote.sections[0].scope?.takeoffSinks??[];
  expect(sinks.map(s=>s.id)).toEqual(['s1','sinktakeoff-copy-1']);
  expect(sinks[1]).toMatchObject({name:'Sink 3218',count:2,unitPrice:125});
  const lines=copied.quote.lines.filter(l=>l.takeoffSinkId);
  expect(lines).toHaveLength(2);
  expect(new Set(lines.map(l=>l.id)).size).toBe(2);
  expect(lines.map(l=>l.takeoffSinkId)).toEqual(['s1','sinktakeoff-copy-1']);
  expect(quoteTotal(copied.quote)).toBeCloseTo(before+250,2);
  expect(original.lines.filter(l=>l.takeoffSinkId)).toHaveLength(1);
 });
 it('duplicates a free-standing charge, preserving its price and discount status',()=>{
  const original=setup();
  const copied=duplicateQuoteScopeRows(original,[{kind:'line',id:'fee',sectionId:'k'}],nextId())!;
  const fees=copied.quote.lines.filter(l=>l.description==='Delivery');
  expect(fees).toHaveLength(2);
  expect(fees[1]).toMatchObject({id:'line-copy-1',sectionId:'k',amount:75});
  expect(quoteTotal(copied.quote)).toBeCloseTo(quoteTotal(original)+75,2);
 });
 it('copies a splash only by copying its parent piece, never invents splash billing',()=>{
  const original=setup();
  const copied=duplicateQuoteScopeRows(original,[{kind:'splash',id:'p1',sectionId:'k'}],nextId())!;
  expect(copied.quote.sections[0].scope?.takeoffPieces).toHaveLength(2);
  expect(copied.quote.lines.filter(l=>l.quantitySource?.syncMode==='live')).toHaveLength(1);
 });
 it('deduplicates parent and splash selection and keeps mixed actions atomic',()=>{
  const original=setup();
  const copied=duplicateQuoteScopeRows(original,[
   {kind:'splash',id:'p1',sectionId:'k'},
   {kind:'piece',id:'p1',sectionId:'k'},
   {kind:'sink',id:'s1',sectionId:'k'},
   {kind:'line',id:'fee',sectionId:'k'},
  ],nextId())!;
  expect(copied.duplicated).toBe(3);
  expect(copied.quote.sections[0].scope?.takeoffPieces).toHaveLength(2);
  expect(copied.quote.sections[0].scope?.takeoffSinks).toHaveLength(2);
  expect(copied.quote.lines.filter(l=>l.description==='Delivery')).toHaveLength(2);
  expect(original.sections[0].scope?.takeoffSinks).toHaveLength(1);
 });
 it('refuses invalid or managed price lines rather than making duplicate charges',()=>{
  const original=setup();
  const managed=original.lines.find(l=>l.quantitySource?.syncMode==='live')!;
  expect(duplicateQuoteScopeRows(original,[{kind:'line',id:managed.id,sectionId:'k'}]))
   .toBeUndefined();
  expect(duplicateQuoteScopeRows(original,[{kind:'line',id:'missing',sectionId:'k'}]))
   .toBeUndefined();
  expect(duplicateQuoteScopeRows(original,[
   {kind:'piece',id:'p1',sectionId:'k'},{kind:'sink',id:'missing',sectionId:'k'},
  ])).toBeUndefined();
  expect(original.sections[0].scope?.takeoffPieces).toHaveLength(1);
 });
 it('invalidates any previous approval after a billable duplicate',()=>{
  const original=setup(),key=quoteDeliveryApprovalKey(original);
  expect(approvedCustomerDraft(original,key,key)).toBe(true);
  const copied=duplicateQuoteScopeRows(original,[{kind:'piece',id:'p1',sectionId:'k'}],nextId())!;
  expect(approvedCustomerDraft(copied.quote,key,key)).toBe(false);
 });
});
