import {quoteLineTotal,quoteTotal,roundCurrency,type Quote} from '../types/quote';
import {isGeneralTakeoffSection} from './quoteCustomerPresentation';
import {projectAreaCost} from './quoteAreaCost';
import {totalBillableTakeoffSf,roundedBillableTakeoffSf} from './quoteTakeoffsLite';
import {summarizeQuoteInternalPricing} from './quoteInternalPricing';

type Scenario={label:string;price?:number;profit?:number;margin?:number;perSf?:number;perUnit?:number;reason?:string};
export function quotePricingScenarios(quote:Quote,margin=.30,multiplier=2.2,sfRate?:number,units?:number){
 const areas=quote.sections.filter(section=>!isGeneralTakeoffSection(section)).map(section=>{
  const lines=quote.lines.filter(line=>line.sectionId===section.id&&line.includeInTotal);
  const sf=totalBillableTakeoffSf(section.scope?.takeoffPieces??[]);
  const sellSf=roundedBillableTakeoffSf(section.scope?.takeoffPieces??[],section.scope?.billableSfRounding);
  const primary=lines.find(line=>line.quantitySource?.syncMode==='live'&&line.quantitySource.field==='countertopSf')
   ??lines.find(line=>line.kind==='material'&&!line.takeoffSinkId);
  return {section,lines,sf,sellSf,primary,cost:projectAreaCost(quote,section)};
 }).filter(row=>row.lines.length||row.sf);
 const ids=new Set(areas.map(a=>a.section.id));
 const general=summarizeQuoteInternalPricing(quote.lines.filter(line=>!line.sectionId||
   !ids.has(line.sectionId)));
 const knownCosts=roundCurrency(general.knownInternalCost+areas.reduce((n,a)=>n+a.cost.totalKnownCost,0));
 const missing=areas.flatMap(a=>a.cost.missingCostItems.map(item=>(a.section.title||'Area')+': '+item));
 if(general.costedLineCount<general.costRequiredLineCount)
  missing.push('General: missing internal line costs');
 const complete=!missing.length, totalSf=roundCurrency(areas.reduce((n,a)=>n+a.sf,0));
 const current=quoteTotal(quote);
 const make=(label:string,price?:number,reason?:string):Scenario=>{
  if(price===undefined||!Number.isFinite(price))return {label,reason:reason||'Missing estimates'};
  const p=roundCurrency(price),profit=complete?roundCurrency(p-knownCosts):undefined;
  return {label,price:p,profit,margin:profit!==undefined&&p>0?Math.round(profit/p*1000)/10:undefined,
   perSf:totalSf?roundCurrency(p/totalSf):undefined,perUnit:units&&units>0?roundCurrency(p/units):undefined};
 };
 const measured=areas.filter(a=>a.sf>0);
 const extra=current-measured.reduce((n,a)=>n+(a.primary?quoteLineTotal(a.primary):0),0);
 const bySf=measured.every(a=>sfRate!==undefined||a.primary?.rate!==undefined)
  ?make('Square-foot pricing',extra+measured.reduce((n,a)=>n+a.sf*(sfRate??a.primary?.rate??0),0))
  :make('Square-foot pricing',undefined,'Enter SF selling rates for all measured Areas');
 const slabReady=measured.every(a=>a.cost.slabCost!==undefined&&(
  a.section.scope?.sharedSlabPool?a.cost.materialCost!==undefined:a.cost.slabCount!==undefined));
 const bySlab=slabReady?make('Slab multiplier',extra+measured.reduce((n,a)=>n+multiplier*(
  a.section.scope?.sharedSlabPool?a.cost.materialCost??0:(a.cost.slabCost??0)*(a.cost.slabCount??0)),0))
  :make('Slab multiplier',undefined,'Enter slab purchase cost, size and count');
 return {knownCosts,complete,missing,totalSf,areaCount:areas.length,
  current:make('Current quote',current),
  target:complete&&margin>=0&&margin<1?make('Target margin',knownCosts/(1-margin)):
   make('Target margin',undefined,'Complete all private costs first'),
  bySf,bySlab};
}
