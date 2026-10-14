import type {Quote} from '../types/quote';

/**
 * Duplicate a document's work into a fresh draft and remap every quote-owned
 * database ID. Normalized quote_sections and quote_lines upsert on
 * (organization_id,id), so reusing source IDs would mutate the original.
 * Catalog material IDs and external rate-book references remain shared.
 */
export function copySalesDocument(source:Quote,shell:Quote):Quote{
  const sections=structuredClone(source.sections);
  const lines=structuredClone(source.lines);
  const sectionIds=new Map(sections.map(s=>[s.id,crypto.randomUUID()]));
  const sinkIds=new Map<string,string>();
  for(const section of sections){
    const oldId=section.id;
    section.id=sectionIds.get(oldId)!;
    const scope=section.scope;
    if(!scope)continue;
    scope.takeoffPieces=scope.takeoffPieces?.map(piece=>({...piece,id:crypto.randomUUID()}));
    scope.takeoffSinks=scope.takeoffSinks?.map(sink=>{
      const id=crypto.randomUUID();
      sinkIds.set(sink.id,id);
      return {...sink,id};
    });
  }
  const updatedLines=lines.map(line=>({
    ...line,
    id:crypto.randomUUID(),
    sectionId:line.sectionId?(sectionIds.get(line.sectionId)??line.sectionId):undefined,
    quantitySource:line.quantitySource?{
      ...line.quantitySource,
      sectionId:sectionIds.get(line.quantitySource.sectionId)??line.quantitySource.sectionId,
    }:undefined,
    takeoffSinkId:line.takeoffSinkId?(sinkIds.get(line.takeoffSinkId)??line.takeoffSinkId):undefined,
  }));
  const copy:Quote={
    ...structuredClone(source),
    ...shell,
    templateId:source.templateId,
    templateOrigin:{sourceQuoteId:source.id,sourceRevision:source.revision,
      sourceTitle:source.title},
    status:'Draft',revision:0,revisionLabel:'',
    quoteNumber:shell.quoteNumber,
    originalQuoteDate:shell.originalQuoteDate,quoteDate:shell.quoteDate,
    ownerUserId:shell.ownerUserId,
    sections,lines:updatedLines,
    projectMaterials:source.projectMaterials?.map(item=>({...structuredClone(item),id:crypto.randomUUID()})),
    customerColumns:{...source.customerColumns},
    pricingSchedule:source.pricingSchedule?structuredClone(source.pricingSchedule):undefined,
    history:[],
    sentAt:undefined,viewedAt:undefined,signedAt:undefined,archivedAt:undefined,
    parentQuoteId:undefined,changeOrderNumber:undefined,
  };
  return copy;
}
