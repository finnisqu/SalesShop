import type {Quote} from '../types/quote';
import {patchQuoteTakeoff,patchQuoteTakeoffSinks,ensureSmartTakeoffLine,
  setQuoteTakeoffSinkCharge} from './quoteTakeoffsLite';

export type QuoteScopeRowKind='piece'|'splash'|'sink'|'line';
export interface QuoteScopeRowRef {kind:QuoteScopeRowKind;id:string;sectionId?:string;}
export type QuoteScopeBulkOperation='exclude'|'restore'|'move';

/** Apply one grouped change so Undo restores the complete prior quote.
 * Moving a sink or piece preserves the original takeoff rather than making
 * a duplicate billable row. Managed SF and sink pricing stay synchronized. */
export function applyQuoteScopeRowBatch(quote:Quote,rows:QuoteScopeRowRef[],
  operation:QuoteScopeBulkOperation,targetSectionId?:string):Quote{
  if(!rows.length)return quote;
  if(operation==='move'&&targetSectionId!==undefined&&
    !quote.sections.some(section=>section.id===targetSectionId))return quote;
  let next=quote;
  const seen=new Set<string>();
  for(const row of rows){
    const key=row.kind+':'+(row.sectionId??'general')+':'+row.id;
    if(seen.has(key))continue;
    seen.add(key);
    if(row.kind==='line'){
      const line=next.lines.find(item=>item.id===row.id);
      if(!line||line.quantitySource?.syncMode==='live'||line.takeoffSinkId)continue;
      const sectionId=operation==='move'?targetSectionId:line.sectionId;
      if(operation==='move'&&sectionId===line.sectionId)continue;
      next={...next,lines:next.lines.map(item=>item.id===row.id
        ?operation==='move'?{...item,sectionId}
          :{...item,includeInTotal:operation==='restore',
            customerVisible:operation==='restore'}:item)};
      continue;
    }
    const sectionId=row.sectionId;
    if(!sectionId)continue;
    const source=next.sections.find(section=>section.id===sectionId);
    if(!source)continue;
    if(row.kind==='sink'){
      const sink=source.scope?.takeoffSinks?.find(item=>item.id===row.id);
      if(!sink)continue;
      if(operation!=='move'){
        next=setQuoteTakeoffSinkCharge(next,sectionId,row.id,operation==='restore');
        const changed=next.sections.find(item=>item.id===sectionId);
        next=patchQuoteTakeoffSinks(next,sectionId,(changed?.scope?.takeoffSinks??[]).map(item=>
          item.id===row.id?{...item,excludedFromContract:operation==='exclude'}:item));
      }else if(targetSectionId&&targetSectionId!==sectionId){
        next=patchQuoteTakeoffSinks(next,sectionId,
          (source.scope?.takeoffSinks??[]).filter(item=>item.id!==row.id));
        const dest=next.sections.find(item=>item.id===targetSectionId);
        next=patchQuoteTakeoffSinks(next,targetSectionId,
          [...(dest?.scope?.takeoffSinks??[]),sink],
          sink.includeInPricing?new Set([sink.id]):undefined);
      }
      continue;
    }
    const piece=source.scope?.takeoffPieces?.find(item=>item.id===row.id);
    if(!piece)continue;
    if(operation==='move'){
      if(!targetSectionId||targetSectionId===sectionId)continue;
      next=patchQuoteTakeoff(next,sectionId,
        (source.scope?.takeoffPieces??[]).filter(item=>item.id!==piece.id));
      const dest=next.sections.find(item=>item.id===targetSectionId);
      next=patchQuoteTakeoff(next,targetSectionId,[...(dest?.scope?.takeoffPieces??[]),piece]);
      next=ensureSmartTakeoffLine(next,targetSectionId);
    }else{
      const changed=row.kind==='splash'?{...piece,excludeSplashFromQuote:operation==='exclude'}:
        {...piece,excludedFromQuote:operation==='exclude'};
      next=patchQuoteTakeoff(next,sectionId,
        (source.scope?.takeoffPieces??[]).map(item=>item.id===piece.id?changed:item));
    }
  }
  return next;
}
