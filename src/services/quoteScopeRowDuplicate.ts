import type {Quote,QuoteLine,QuoteTakeoffPiece,QuoteTakeoffSink} from '../types/quote';
import type {QuoteScopeRowRef} from './quoteScopeRowBatch';
import {patchQuoteTakeoff,patchQuoteTakeoffSinks,ensureSmartTakeoffLine} from './quoteTakeoffsLite';

/** A splash has no independent record: it belongs to a measured piece.
 * Duplicating its row copies the whole piece, including all attached splashes.
 * Managed live SF and sink-charge lines cannot be copied as free-standing fees. */
export function duplicateQuoteScopeRows(
 quote:Quote,refs:readonly QuoteScopeRowRef[],
 newId:(kind:string)=>string=(kind)=>kind+'_'+crypto.randomUUID(),
):{quote:Quote;duplicated:number}|undefined{
 if(!refs.length)return undefined;
 const seen=new Set<string>();
 const rows:QuoteScopeRowRef[]=[];
 for(const ref of refs){
  const k=(ref.kind==='splash'?'piece':ref.kind)+':'+(ref.sectionId??'general')+':'+ref.id;
  if(seen.has(k))continue;
  seen.add(k);
  if(ref.kind==='splash')rows.push({...ref,kind:'piece'});
  else rows.push(ref);
 }
 // Validate all selections before creating anything. No half-completed duplicates.
 for(const ref of rows){
  if(ref.kind==='line'){
   const line=quote.lines.find(x=>x.id===ref.id);
   if(!line||line.takeoffSinkId||line.quantitySource?.syncMode==='live')return undefined;
   continue;
  }
  const section=quote.sections.find(x=>x.id===ref.sectionId);
  if(!section)return undefined;
  if(ref.kind==='piece'&&!section.scope?.takeoffPieces?.some(x=>x.id===ref.id))
   return undefined;
  if(ref.kind==='sink'&&!section.scope?.takeoffSinks?.some(x=>x.id===ref.id))
   return undefined;
 }
 let updated=quote;
 for(const ref of rows){
  if(ref.kind==='line'){
   const source=updated.lines.find(x=>x.id===ref.id)!;
   const duplicate:QuoteLine={...structuredClone(source),id:newId('line')};
   const index=updated.lines.findIndex(x=>x.id===ref.id);
   updated={...updated,lines:[
    ...updated.lines.slice(0,index+1),duplicate,...updated.lines.slice(index+1),
   ]};
   continue;
  }
  const section=updated.sections.find(x=>x.id===ref.sectionId)!;
  if(ref.kind==='piece'){
   const pieces=section.scope?.takeoffPieces??[];
   if(pieces.length>=100)return undefined;
   const index=pieces.findIndex(x=>x.id===ref.id);
   const duplicate:QuoteTakeoffPiece={
    ...structuredClone(pieces[index]),id:newId('piece'),
    name:pieces[index].name.trim()?pieces[index].name.trim()+' copy':'Piece copy',
   };
   const next=[...pieces.slice(0,index+1),duplicate,...pieces.slice(index+1)];
   updated=ensureSmartTakeoffLine(patchQuoteTakeoff(updated,section.id,next),section.id);
  }else if(ref.kind==='sink'){
   const sinks=section.scope?.takeoffSinks??[];
   if(sinks.length>=100)return undefined;
   const index=sinks.findIndex(x=>x.id===ref.id);
   const original=sinks[index];
   const duplicate:QuoteTakeoffSink={...structuredClone(original),id:newId('sinktakeoff')};
   const sourceLine=updated.lines.find(line=>line.sectionId===section.id&&line.takeoffSinkId===original.id);
   const next=[...sinks.slice(0,index+1),duplicate,...sinks.slice(index+1)];
   updated=patchQuoteTakeoffSinks(updated,section.id,next);
   // The sink service creates one managed line for a new, included sink.
   // Preserve the source's visibility/strikeout choices, not a default bill.
   if(sourceLine){
    updated={...updated,lines:updated.lines.map(line=>
      line.sectionId===section.id&&line.takeoffSinkId===duplicate.id
       ?{...line,includeInTotal:sourceLine.includeInTotal,
         customerVisible:sourceLine.customerVisible}:line)};
   }
  }
 }
 // Geometry changes invalidate the prior exclusion pricing acknowledgment.
 const affected=new Set(rows.filter(r=>r.kind==='piece'||r.kind==='sink')
  .map(r=>r.sectionId).filter((id):id is string=>!!id));
 if(affected.size)updated={...updated,sections:updated.sections.map(section=>
  affected.has(section.id)?{...section,scope:{...section.scope,exclusionPricingReviewed:false}}:section)};
 return {quote:updated,duplicated:rows.length};
}
