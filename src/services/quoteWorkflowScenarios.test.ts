import {describe,expect,it} from 'vitest';
import type {Quote,QuoteLine,QuoteTakeoffPiece,QuoteTakeoffSink} from '../types/quote';
import {quoteTotal,quoteLinesTotal} from '../types/quote';
import {
  patchQuoteTakeoff,patchQuoteTakeoffSinks,ensureSmartTakeoffLine,splitTakeoffPieces,
  totalBillableTakeoffSf,
} from './quoteTakeoffsLite';
import {auditQuoteDraft} from './quoteDraftAudit';
import {duplicateQuoteArea} from './quoteAreaDuplicate';

const at='2026-10-14T19:00:00.000Z';
const quote=():Quote=>({
  id:'quote-scenario',quoteNumber:'DRAFT-scenario',documentType:'quote',
  originalQuoteDate:'2026-10-14',quoteDate:'2026-10-14',revision:0,
  status:'Draft',title:'Workflow test',companyName:'Sample builder',
  contactName:'Demo customer',contactEmail:'demo@example.com',
  sections:[],lines:[],customerColumns:{quantity:true,rate:true,lineAmount:true},
  customerNotes:'',internalNotes:'',history:[],createdAt:at,updatedAt:at,
});
const piece=(id:string,lengthIn:number,widthIn:number,count=1,backsplash=false):QuoteTakeoffPiece=>({
  id,name:id,lengthIn,widthIn,count,backsplash,
});
const area=(q:Quote,id:string,title:string):Quote=>({
  ...q,sections:[...q.sections,{id,title,customerVisible:true,customerDisplayMode:'summary'}],
});
function measureAndPrice(q:Quote,id:string,pieces:QuoteTakeoffPiece[],rate:number):Quote {
  const next=ensureSmartTakeoffLine(patchQuoteTakeoff(q,id,pieces,at),id);
  return {...next,lines:next.lines.map(line=>line.sectionId===id&&line.quantitySource?.syncMode==='live'
    ?{...line,rate}:line)};
}
function takeoffSink(id:string,name:string,rate:number):QuoteTakeoffSink{
  return {id,category:name.toLowerCase().includes('vanity')?'vanity':'kitchen',
    name,count:1,includeInPricing:true,unitPrice:rate};
}
const live=(q:Quote,areaId:string):QuoteLine|undefined=>q.lines.find(l=>l.sectionId===areaId
  &&l.quantitySource?.field==='countertopSf'&&l.quantitySource.syncMode==='live');

describe('QUOTES beta release gate · representative real-world workflows',()=>{
  it('residential vanity · 4-inch splash + one sink sells once and Review has no pricing blockers',()=>{
    const base=area(quote(),'vanity','Guest vanity');
    const measured=measureAndPrice(base,'vanity',[piece('counter',48,22,1,true)],55);
    const withSink=patchQuoteTakeoffSinks(measured,'vanity',[takeoffSink('sink-1714','Vanity 1714',95)]);
    expect(totalBillableTakeoffSf(withSink.sections[0].scope?.takeoffPieces??[])).toBe(8.67);
    expect(withSink.lines.filter(line=>line.takeoffSinkId==='sink-1714')).toHaveLength(1);
    expect(quoteTotal(withSink)).toBe(571.85);
    expect(auditQuoteDraft(withSink).blockers).toEqual([]);
    // Updating an existing takeoff sink must replace its row, not add another.
    const revised=patchQuoteTakeoffSinks(withSink,'vanity',[takeoffSink('sink-1714','Vanity 1714',105)]);
    expect(revised.lines).toHaveLength(2);
    expect(quoteTotal(revised)).toBe(581.85);
  });

  it('two-Area kitchen · totals, sinks, independent duplicate IDs, and review blockers stay coherent',()=>{
    let q=area(area(quote(),'run','Kitchen perimeter'),'island','Island');
    q=measureAndPrice(q,'run',[piece('run-p',96,25.5,1,true)],50);
    q=measureAndPrice(q,'island',[piece('island-p',72,36)],65);
    q=patchQuoteTakeoffSinks(q,'run',[takeoffSink('s3218','Kitchen 3218 Single',220)]);
    const run=quoteLinesTotal(q.lines.filter(l=>l.sectionId==='run'));
    const island=quoteLinesTotal(q.lines.filter(l=>l.sectionId==='island'));
    expect(run).toBe(1203.5);
    expect(island).toBe(1170);
    expect(quoteTotal(q)).toBe(run+island);
    expect(auditQuoteDraft(q).blockers).toEqual([]);
    const duplicate=duplicateQuoteArea(q,'island',kind=>kind+'_'+Math.random().toString(36).slice(2));
    expect(duplicate).toBeDefined();
    const cloneId=duplicate!.newAreaId;
    const clonedLine=live(duplicate!.quote,cloneId);
    expect(clonedLine).toBeDefined();
    expect(clonedLine?.quantitySource?.sectionId).toBe(cloneId);
    expect(clonedLine?.id).not.toBe(live(q,'island')?.id);
    expect(quoteTotal(duplicate!.quote)).toBe(quoteTotal(q)+island);
    expect(auditQuoteDraft(duplicate!.quote).blockers).toEqual([]);
  });

  it('repeated units / multifamily-style Quick Quote · moving ALL pieces leaves no phantom zero-quantity charge',()=>{
    // Multifamily-specific template is still a placeholder. Test its repeated-unit
    // geometry using the current available Quick Quote Area model instead.
    const q=area(quote(),'building-a','Building A · 24 repeated vanities');
    const units=piece('unit-model',60,25.5,24,true);
    const original=measureAndPrice(q,'building-a',[units],35);
    expect(original.sections[0].scope?.countertopSf).toBe(295);
    expect(quoteTotal(original)).toBe(10325);
    const moved=splitTakeoffPieces(original,'building-a',['unit-model'],'Building B');
    const nextArea=moved.sections.find(s=>s.id!=='building-a')!;
    expect(moved.sections[0].scope?.takeoffPieces).toEqual([]);
    expect(live(moved,'building-a')).toBeUndefined();
    expect(live(moved,nextArea.id)).toMatchObject({quantity:295,rate:35});
    expect(quoteTotal(moved)).toBe(quoteTotal(original));
    expect(auditQuoteDraft(moved).blockers).toEqual([]);
  });

  it('splitting some repeated pieces preserves remaining charge and manual/sink rows',()=>{
    let q=area(quote(),'units','Repeated plans');
    const items=[piece('unit-a',60,25.5,10,true),piece('unit-b',72,25.5,6,true)];
    q=measureAndPrice(q,'units',items,45);
    q=patchQuoteTakeoffSinks(q,'units',[takeoffSink('sink-x','Vanity 1813',95)]);
    const originalTotal=quoteTotal(q);
    const moved=splitTakeoffPieces(q,'units',['unit-b'],'Another plan');
    const nextArea=moved.sections.find(s=>s.id!=='units')!;
    expect(live(moved,'units')).toBeDefined();
    expect(live(moved,nextArea.id)).toBeDefined();
    expect(moved.lines.find(l=>l.takeoffSinkId==='sink-x')?.sectionId).toBe('units');
    expect(quoteTotal(moved)).toBe(originalTotal);
    expect(auditQuoteDraft(moved).blockers).toEqual([]);
    expect(moved.lines.filter(l=>l.quantitySource?.syncMode==='live')).toHaveLength(2);
  });
});
