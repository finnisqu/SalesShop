import type {Quote,QuoteSection} from '../types/quote';
import {isGeneralTakeoffSection} from './quoteCustomerPresentation';

export interface AreaDuplicateResult { quote:Quote; newAreaId:string }
/** One-operation, undoable clone of an Area and all of its billable lines.
 * Remap every takeoff child and managed sink reference so editing a duplicate
 * cannot alter or detach the original area's material/sink/quantity links. */
export function duplicateQuoteArea(quote:Quote,sourceAreaId:string,
  newId:(kind:string)=>string=(kind)=>kind+'_'+crypto.randomUUID()
):AreaDuplicateResult|undefined {
  const source=quote.sections.find(section=>section.id===sourceAreaId);
  if(!source||isGeneralTakeoffSection(source))return undefined;
  const newAreaId=newId('section');
  const area=structuredClone(source) as QuoteSection;
  area.id=newAreaId;
  // A newly duplicated Area is not an additional physical slab purchase member.
  if(area.scope?.sharedSlabPool)area.scope.sharedSlabPool=undefined;
  area.title=source.title.trim()?source.title.trim()+' copy':'Area copy';
  const sinkIdMap=new Map<string,string>();
  if(area.scope?.takeoffPieces){
    area.scope.takeoffPieces=area.scope.takeoffPieces.map(piece=>({
      ...piece,id:newId('piece'),
    }));
  }
  if(area.scope?.takeoffSinks){
    area.scope.takeoffSinks=area.scope.takeoffSinks.map(sink=>{
      const id=newId('sinktakeoff');
      sinkIdMap.set(sink.id,id);
      return {...sink,id};
    });
  }
  const newLines=quote.lines.filter(line=>line.sectionId===sourceAreaId).map(line=>{
    const copy=structuredClone(line);
    copy.id=newId('line');
    copy.sectionId=newAreaId;
    if(copy.takeoffSinkId)copy.takeoffSinkId=sinkIdMap.get(copy.takeoffSinkId);
    if(copy.quantitySource?.sectionId===sourceAreaId){
      copy.quantitySource={...copy.quantitySource,sectionId:newAreaId};
    }
    return copy;
  });
  const index=quote.sections.findIndex(section=>section.id===sourceAreaId);
  return {
    newAreaId,
    quote:{
      ...quote,
      sections:[...quote.sections.slice(0,index+1),area,...quote.sections.slice(index+1)],
      lines:[...quote.lines,...newLines],
    },
  };
}

/** Copy reusable takeoffs from another quote without mixing customer identities,
 * revision history, pooled slabs or source line/child IDs.
 * Selling prices are opt-in, because a prior customer's price is not a
 * safe default for the new job. */
export function copyQuoteAreaFromSource(
 target:Quote,source:Quote,areaId:string,includeSellingPrices=false,
 newId:(kind:string)=>string=(kind)=>kind+'_'+crypto.randomUUID(),
):AreaDuplicateResult|undefined {
 if(target.id===source.id||target.documentType==='pricing-schedule')return undefined;
 const duplicate=duplicateQuoteArea(source,areaId,newId);
 if(!duplicate)return undefined;
 const newAreaId=duplicate.newAreaId;
 const created=duplicate.quote.sections.find(section=>section.id===newAreaId);
 if(!created)return undefined;
 const section=structuredClone(created) as QuoteSection;
 section.title=source.sections.find(area=>area.id===areaId)?.title??section.title;
 if(section.scope?.sharedSlabPool)section.scope.sharedSlabPool=undefined;
 if(!includeSellingPrices&&section.scope?.takeoffSinks){
  section.scope.takeoffSinks=section.scope.takeoffSinks.map(sink=>({
   ...sink,unitPrice:undefined,includeInPricing:false,internalCostOverride:undefined,
  }));
 }
 const lines=duplicate.quote.lines.filter(line=>line.sectionId===newAreaId)
  .map(line=>{
   if(includeSellingPrices)return line;
   return {
    ...line,rate:undefined,amount:undefined,internalCost:undefined,rateReference:undefined,
    ...(line.takeoffSinkId?{includeInTotal:false}:{}),
   };
  });
 return {
  newAreaId,
  quote:{...target,sections:[...target.sections,section],lines:[...target.lines,...lines]},
 };
}

/** Copy several Areas as one independent, undoable change; if any source Area
 * is invalid, leave the destination unchanged rather than partially copying. */
export function copyQuoteAreasFromSource(
 target:Quote,source:Quote,areaIds:readonly string[],includeSellingPrices=false,
 newId:(kind:string)=>string=(kind)=>kind+'_'+crypto.randomUUID(),
):{quote:Quote;newAreaIds:string[]}|undefined {
 if(!areaIds.length||new Set(areaIds).size!==areaIds.length)return undefined;
 if(areaIds.some(id=>!source.sections.some(section=>section.id===id
  &&!isGeneralTakeoffSection(section))))return undefined;
 let current=target;
 const newAreaIds:string[]=[];
 for(const id of areaIds){
  const result=copyQuoteAreaFromSource(current,source,id,includeSellingPrices,newId);
  if(!result)return undefined;
  current=result.quote;
  newAreaIds.push(result.newAreaId);
 }
 return {quote:current,newAreaIds};
}
