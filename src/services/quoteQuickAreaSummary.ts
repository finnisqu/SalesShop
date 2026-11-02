import type {Quote,QuoteLine,QuoteSection} from '../types/quote';
import {quoteLineAmount,quoteLinesTotal} from '../types/quote';
import {roundedBillableTakeoffSf,totalBillableTakeoffSf} from './quoteTakeoffsLite';
import {isGeneralTakeoffSection} from './quoteCustomerPresentation';

/** One source for the compact seller view: never create extra customer charges. */
export function quickAreaPrimary(quote:Quote,areaId:string):QuoteLine|undefined{
 const lines=quote.lines.filter(line=>line.sectionId===areaId);
 return lines.find(line=>line.quantitySource?.syncMode==='live'
  &&line.quantitySource.field==='countertopSf')
  ??lines.find(line=>line.kind==='material'&&!line.takeoffSinkId)
  ??lines.find(line=>line.kind==='item'&&!line.takeoffSinkId
   &&line.quantitySource?.field==='countertopSf');
}
export function quickAreaSummary(quote:Quote,area:QuoteSection){
 const scope=area.scope,pieces=scope?.takeoffPieces??[];
 const primary=quickAreaPrimary(quote,area.id);
 const lines=quote.lines.filter(line=>line.sectionId===area.id);
 const measuredSf=pieces.length?totalBillableTakeoffSf(pieces):scope?.countertopSf??primary?.quantity??0;
 const billedSf=pieces.length?roundedBillableTakeoffSf(pieces,scope?.billableSfRounding):
  scope?.countertopSf??primary?.quantity??0;
 const sinkLines=lines.filter(line=>line.takeoffSinkId||line.kind==='sink');
 const sinkQuantity=(scope?.takeoffSinks??[]).filter(sink=>!sink.excludedFromContract)
  .reduce((sum,sink)=>sum+sink.count,0)+
  sinkLines.filter(line=>!line.takeoffSinkId&&line.includeInTotal)
   .reduce((sum,line)=>sum+(line.quantity??1),0);
 const sinkPrice=quoteLinesTotal(sinkLines);
 const specialty=lines.filter(line=>line!==primary&&!sinkLines.includes(line));
 const specialtyQuantity=specialty.filter(line=>line.includeInTotal).length;
 const specialtyPrice=quoteLinesTotal(specialty);
 const materialPrice=primary?.includeInTotal?quoteLineAmount(primary):0;
 return {area,primary,measuredSf,billedSf,materialPrice,sinkQuantity,sinkPrice,
  specialtyQuantity,specialtyPrice,total:quoteLinesTotal(lines),
  hasMeasuredPieces:pieces.length>0,
  hasUnpricedMaterial:pieces.length>0&&!scope?.takeoffMaterial?.trim()||
   (!!primary&&primary.pricingMode==='quantity-rate'&&primary.rate===undefined),
  sinkLines,specialty};
}
export function quickGeneralSummary(quote:Quote){
 const generalIds=new Set(quote.sections.filter(isGeneralTakeoffSection).map(s=>s.id));
 const lines=quote.lines.filter(line=>!line.sectionId||generalIds.has(line.sectionId)
  ||!quote.sections.some(s=>s.id===line.sectionId));
 return {lines,total:quoteLinesTotal(lines)};
}
