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
