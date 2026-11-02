import {describe,it,expect} from 'vitest';
import type {Quote,QuoteSection,QuoteTakeoffPiece,QuoteLine} from '../types/quote';
import {quoteLinesTotal} from '../types/quote';
import {applyQuoteScopeRowBatch} from './quoteScopeRowBatch';
import {auditQuoteDraft} from './quoteDraftAudit';
import {patchQuoteTakeoff,patchQuoteTakeoffSinks,ensureSmartTakeoffLine,
  totalBillableTakeoffSf,takeoffCustomerDetails} from './quoteTakeoffsLite';

const piece=(id:string):QuoteTakeoffPiece=>({id,name:'Kitchen top',lengthIn:48,widthIn:24,count:1,
 backsplash:true,splashHeightIn:4});
const section=(id:string,title:string):QuoteSection=>({id,title,customerVisible:true,
 scope:{takeoffPieces:[],takeoffSinks:[],takeoffMaterial:'Quartz'}});
const quote=():Quote=>({
 id:'q',title:'Bid',documentType:'quote',status:'Draft',sections:[section('k','Kitchen'),section('b','Bath')],
 lines:[],customerColumns:{quantity:false,rate:false,lineAmount:true}
} as unknown as Quote);
const row=(kind:'piece'|'splash'|'sink'|'line',id:string,sectionId?:string)=>({kind,id,sectionId});
describe('single-table scoped quote rows',()=>{
 it('deletes a selected mix of piece, splash, sink and manual charge in one immutable quote update',()=>{
  const original=quote();
  let q=patchQuoteTakeoff(original,'k',[piece('p'),piece('keep')]);
  q=patchQuoteTakeoffSinks(q,'k',[{id:'s',name:'1813',category:'vanity',
   count:1,includeInPricing:true,unitPrice:75}]);
  q={...q,lines:[...q.lines,{id:'fee',kind:'item',description:'Fee',pricingMode:'direct',
   amount:30,includeInTotal:true,customerVisible:true,sectionId:'k'}]};
  const deleted=applyQuoteScopeRowBatch(q,[
   row('piece','p','k'),row('sink','s','k'),row('line','fee','k'),
   row('splash','keep','k'),
  ],'delete');
  expect(q.sections[0].scope?.takeoffPieces?.map(p=>p.id)).toEqual(['p','keep']);
  expect(deleted.sections[0].scope?.takeoffPieces?.map(p=>p.id)).toEqual(['keep']);
  expect(deleted.sections[0].scope?.takeoffPieces?.[0].backsplash).toBe(false);
  expect(deleted.sections[0].scope?.takeoffSinks).toEqual([]);
  expect(deleted.lines.find(l=>l.id==='fee')).toBeUndefined();
  expect(deleted.lines.some(l=>l.takeoffSinkId==='s')).toBe(false);
 });

 it('retains measured top geometry but excludes it from the live priced SF; Undo source stays immutable',()=>{
  let q=patchQuoteTakeoff(quote(),'k',[piece('p')]);
  q=ensureSmartTakeoffLine(q,'k');
  q={...q,lines:q.lines.map(l=>({...l,rate:50}))};
  expect(quoteLinesTotal(q.lines)).toBe(466.5);
  const excluded=applyQuoteScopeRowBatch(q,[row('piece','p','k')],'exclude');
  expect(excluded.sections[0].scope?.takeoffPieces?.[0].lengthIn).toBe(48);
  expect(excluded.sections[0].scope?.takeoffPieces?.[0].excludedFromQuote).toBe(true);
  expect(excluded.sections[0].scope?.countertopSf).toBe(0);
  expect(quoteLinesTotal(excluded.lines)).toBe(0);
  expect(q.sections[0].scope?.countertopSf).toBe(9.33);
  const restored=applyQuoteScopeRowBatch(excluded,[row('piece','p','k')],'restore');
  expect(restored.sections[0].scope?.countertopSf).toBe(9.33);
  expect(quoteLinesTotal(restored.lines)).toBe(466.5);
 });
 it('can strike through just the splash without discarding its selections',()=>{
  const q=patchQuoteTakeoff(quote(),'k',[piece('p')]);
  const updated=applyQuoteScopeRowBatch(q,[row('splash','p','k')],'exclude');
  expect(updated.sections[0].scope?.takeoffPieces?.[0].backsplash).toBe(true);
  expect(updated.sections[0].scope?.takeoffPieces?.[0].excludeSplashFromQuote).toBe(true);
  expect(totalBillableTakeoffSf(updated.sections[0].scope!.takeoffPieces!)).toBe(8);
  expect(updated.sections[0].scope?.splashLf).toBe(0);
 });
 it('keeps excluded sink selections for restoration, out of prices and customer specs',()=>{
  const q=patchQuoteTakeoffSinks(quote(),'k',[{
    id:'s',name:'Vanity sink',category:'vanity',count:2,includeInPricing:true,unitPrice:125,
  }]);
  expect(quoteLinesTotal(q.lines)).toBe(250);
  const excluded=applyQuoteScopeRowBatch(q,[row('sink','s','k')],'exclude');
  expect(excluded.sections[0].scope?.takeoffSinks?.[0]).toMatchObject({
    name:'Vanity sink',excludedFromContract:true,includeInPricing:false});
  expect(quoteLinesTotal(excluded.lines)).toBe(0);
  expect(excluded.lines).toHaveLength(1);
  expect(excluded.lines[0].includeInTotal).toBe(false);
  expect(excluded.lines[0].id).toBe(q.lines[0].id);
  expect(takeoffCustomerDetails(excluded.sections[0]).sinks).toEqual([]);
  const restored=applyQuoteScopeRowBatch(excluded,[row('sink','s','k')],'restore');
  expect(quoteLinesTotal(restored.lines)).toBe(250);
  expect(takeoffCustomerDetails(restored.sections[0]).sinks).toEqual(['2 × Vanity sink']);
  const moved=applyQuoteScopeRowBatch(restored,[row('sink','s','k')],'move','b');
  expect(moved.sections[1].scope?.takeoffSinks?.[0].id).toBe('s');
  expect(moved.lines).toHaveLength(1);
  expect(moved.lines[0]).toMatchObject({id:q.lines[0].id,sectionId:'b'});
 });
 it('excludes/restores a custom charge and allows moving multiple lines in one pure change',()=>{
  const charge=(id:string):QuoteLine=>({id,kind:'item',description:'Install',pricingMode:'direct',
    amount:100,includeInTotal:true,customerVisible:true,sectionId:'k'});
  const q={...quote(),lines:[charge('a'),charge('b')]};
  const refs=[row('line','a','k'),row('line','b','k')];
  const hidden=applyQuoteScopeRowBatch(q,refs,'exclude');
  expect(quoteLinesTotal(hidden.lines)).toBe(0);
  expect(hidden.lines.every(l=>!l.customerVisible&&!l.includeInTotal)).toBe(true);
  const restored=applyQuoteScopeRowBatch(hidden,refs,'restore');
  expect(quoteLinesTotal(restored.lines)).toBe(200);
  const moved=applyQuoteScopeRowBatch(restored,refs,'move','b');
  expect(moved.lines.map(l=>l.sectionId)).toEqual(['b','b']);
  expect(q.lines.map(l=>l.sectionId)).toEqual(['k','k']);
 });
 it('blocks issuing a manual selling price until exclusions are explicitly reviewed',()=>{
  let q=patchQuoteTakeoff(quote(),'k',[piece('p')]);
  q=ensureSmartTakeoffLine(q,'k');
  q={...q,lines:q.lines.map(line=>({...line,pricingMode:'direct' as const,amount:480}))};
  const excluded=applyQuoteScopeRowBatch(q,[row('splash','p','k')],'exclude');
  expect(quoteLinesTotal(excluded.lines)).toBe(480);
  expect(auditQuoteDraft(excluded).blockers.some(f=>f.id==='area:k:excluded-pricing')).toBe(true);
  const reviewed={...excluded,sections:excluded.sections.map(section=>section.id==='k'
    ?{...section,scope:{...section.scope,exclusionPricingReviewed:true}}:section)};
  expect(auditQuoteDraft(reviewed).blockers.some(f=>f.id==='area:k:excluded-pricing')).toBe(false);
  const changedAgain=applyQuoteScopeRowBatch(reviewed,[row('piece','p','k')],'exclude');
  expect(auditQuoteDraft(changedAgain).blockers.some(f=>f.id==='area:k:excluded-pricing')).toBe(true);
 });
 it('never moves a splash subrow independently of its parent Piece',()=>{
  const q=patchQuoteTakeoff(quote(),'k',[piece('p')]);
  const unchanged=applyQuoteScopeRowBatch(q,[row('splash','p','k')],'move','b');
  expect(unchanged.sections[0].scope?.takeoffPieces?.[0].id).toBe('p');
  expect(unchanged.sections[1].scope?.takeoffPieces??[]).toHaveLength(0);
  const moved=applyQuoteScopeRowBatch(q,[row('piece','p','k')],'move','b');
  expect(moved.sections[0].scope?.takeoffPieces??[]).toHaveLength(0);
  expect(moved.sections[1].scope?.takeoffPieces?.[0]).toMatchObject({
   id:'p',backsplash:true,
  });
 });
 it('does not let an invalid destination or a managed source line corrupt the quote',()=>{
  const q=quote();
  expect(applyQuoteScopeRowBatch(q,[row('line','not-found')],'move','not-an-area')).toBe(q);
 });
});
