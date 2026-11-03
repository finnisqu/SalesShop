import type {Quote,QuoteSplashEdge,QuoteTakeoffPiece} from '../types/quote';
import {patchQuoteTakeoff,patchQuoteTakeoffSinks,ensureSmartTakeoffLine,
  setQuoteTakeoffSinkCharge} from './quoteTakeoffsLite';

export type QuoteScopeRowKind='piece'|'splash'|'sink'|'line';
export interface QuoteScopeRowRef {
  kind:QuoteScopeRowKind;id:string;sectionId?:string;
  /** Optional edge key for independently editable mobile splash subrows. */
  edge?:QuoteSplashEdge;
}
export type QuoteScopeBulkOperation='exclude'|'restore'|'move'|'delete';

const splashField:Record<QuoteSplashEdge,'backsplash'|'leftSplash'|'rightSplash'>={
  back:'backsplash',left:'leftSplash',right:'rightSplash'
};
const splashEdges=['back','left','right'] as const;

/** Convert a legacy all-splashes exclusion to per-edge state when restoring a
 * single edge; otherwise restoring just one would implicitly restore all. */
function patchIndividualSplash(piece:QuoteTakeoffPiece,edge:QuoteSplashEdge,
 operation:'exclude'|'restore'):QuoteTakeoffPiece {
  const exclusions={...piece.excludedSplashEdges};
  if(piece.excludeSplashFromQuote){
    for(const item of splashEdges){
      if(piece[splashField[item]])exclusions[item]=true;
    }
  }
  exclusions[edge]=operation==='exclude';
  return {...piece,excludeSplashFromQuote:false,excludedSplashEdges:exclusions};
}

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
    const key=row.kind+':'+(row.sectionId??'general')+':'+row.id+':'+(row.edge??'');
    if(seen.has(key))continue;
    seen.add(key);
    if(row.kind==='line'){
      const line=next.lines.find(item=>item.id===row.id);
      if(operation==='delete'){
        if(line&&!line.takeoffSinkId&&line.quantitySource?.syncMode!=='live')
          next={...next,lines:next.lines.filter(item=>item.id!==row.id)};
        continue;
      }
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
      if(operation==='delete'){
       next=patchQuoteTakeoffSinks(next,sectionId,
         (source.scope?.takeoffSinks??[]).filter(item=>item.id!==row.id));
       continue;
      }
      if(operation!=='move'){
        if(operation==='exclude'){
          next=patchQuoteTakeoffSinks(next,sectionId,
            (source.scope?.takeoffSinks??[]).map(item=>item.id===row.id?
              {...item,includeInPricing:false,excludedFromContract:true}:item));
        }else{
          next=setQuoteTakeoffSinkCharge(next,sectionId,row.id,true);
          const changed=next.sections.find(item=>item.id===sectionId);
          next=patchQuoteTakeoffSinks(next,sectionId,(changed?.scope?.takeoffSinks??[]).map(item=>
            item.id===row.id?{...item,excludedFromContract:false}:item));
        }
        next={...next,sections:next.sections.map(item=>item.id===sectionId?
          {...item,scope:{...item.scope,exclusionPricingReviewed:false}}:item)};
      }else if(targetSectionId&&targetSectionId!==sectionId){
        if(next.sections.some(item=>item.id===targetSectionId&&
          item.scope?.takeoffSinks?.some(existing=>existing.id===sink.id)))continue;
        const originalLine=next.lines.find(item=>item.sectionId===sectionId&&item.takeoffSinkId===sink.id);
        next=patchQuoteTakeoffSinks(next,sectionId,
          (source.scope?.takeoffSinks??[]).filter(item=>item.id!==row.id));
        const dest=next.sections.find(item=>item.id===targetSectionId);
        next=patchQuoteTakeoffSinks(next,targetSectionId,
          [...(dest?.scope?.takeoffSinks??[]),sink],
          sink.includeInPricing?new Set([sink.id]):undefined);
        const replacement=next.lines.find(item=>item.sectionId===targetSectionId&&item.takeoffSinkId===sink.id);
        if(originalLine&&replacement)next={...next,lines:next.lines.map(item=>
          item.id===replacement.id?{...item,id:originalLine.id}:item)};
        else if(originalLine&&!replacement)next={...next,lines:[...next.lines,
          {...originalLine,sectionId:targetSectionId,includeInTotal:false,customerVisible:false}]};
      }
      continue;
    }
    const piece=source.scope?.takeoffPieces?.find(item=>item.id===row.id);
    if(!piece)continue;
    const edge=row.edge;
    if(operation==='delete'){
      if(row.kind==='splash'){
        next=patchQuoteTakeoff(next,sectionId,
         (source.scope?.takeoffPieces??[]).map(item=>item.id===row.id
          ?edge
            ?{...item,[splashField[edge]]:false,
              excludedSplashEdges:{...item.excludedSplashEdges,[edge]:false}}
            :{...item,backsplash:false,leftSplash:false,rightSplash:false,
              excludeSplashFromQuote:false,excludedSplashEdges:{}}:item));
      }else{
        next=patchQuoteTakeoff(next,sectionId,
         (source.scope?.takeoffPieces??[]).filter(item=>item.id!==row.id));
      }
      continue;
    }
    // A splash subrow is not independent geometry: it cannot be moved without
    // its parent Piece. Moving the Piece keeps all splash flags intact.
    if(operation==='move'&&row.kind==='splash')continue;
    if(operation==='move'){
      if(!targetSectionId||targetSectionId===sectionId)continue;
      next=patchQuoteTakeoff(next,sectionId,
        (source.scope?.takeoffPieces??[]).filter(item=>item.id!==piece.id));
      const dest=next.sections.find(item=>item.id===targetSectionId);
      next=patchQuoteTakeoff(next,targetSectionId,[...(dest?.scope?.takeoffPieces??[]),piece]);
      next=ensureSmartTakeoffLine(next,targetSectionId);
    }else{
      const changed=row.kind==='splash'
        ?row.edge?patchIndividualSplash(piece,row.edge,operation)
          :{...piece,excludeSplashFromQuote:operation==='exclude',excludedSplashEdges:{}}
        :{...piece,excludedFromQuote:operation==='exclude'};
      next=patchQuoteTakeoff(next,sectionId,
        (source.scope?.takeoffPieces??[]).map(item=>item.id===piece.id?changed:item));
      next={...next,sections:next.sections.map(item=>item.id===sectionId?
        {...item,scope:{...item.scope,exclusionPricingReviewed:false}}:item)};
    }
  }
  return next;
}
