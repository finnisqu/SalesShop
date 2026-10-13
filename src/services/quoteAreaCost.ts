import {quoteLineTotal,roundCurrency,type Quote,type QuoteSection} from '../types/quote';
import {totalBillableTakeoffSf} from './quoteTakeoffsLite';
import {summarizeQuoteInternalPricing} from './quoteInternalPricing';

export const DEFAULT_SLAB_YIELD=.65;
const positive=(v:number|undefined)=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:undefined;
const nonnegative=(v:number|undefined)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:undefined;
export type AreaPricingChoice='manual'|'sf'|'multiplier';
export interface AreaCostProjection {
  measuredSf:number;slabAreaSf?:number;yield:number;usableSfPerSlab?:number;
  suggestedSlabs?:number;slabCount?:number;slabCost?:number;
  materialCost?:number;costSource:'slab'|'derived-sf'|'manual'|'unknown';
  sinkCost?:number;missingSinkCosts:number;otherCost:number;
  totalKnownCost:number;priceTotal:number;grossSpread:number;
  marginPercent?:number;complete:boolean;explanation:string;
}

/** Slab consumption and production buying cost are independent of the
 * customer-facing pricing mode (manual, SF or multiplier). No invented slab size. */
export function projectAreaCost(quote:Quote,section:QuoteSection):AreaCostProjection{
  const scope=section.scope;
  const measuredSf=totalBillableTakeoffSf(scope?.takeoffPieces??[]);
  const ref=scope?.takeoffMaterialReference;
  const setting=scope?.slabYield;
  const yieldFraction=setting!==undefined&&Number.isFinite(setting)&&setting>0&&setting<=1
    ?setting:DEFAULT_SLAB_YIELD;
  const snapshot=ref?.snapshot;
  const area=positive(snapshot?.areaSf)
    ??(positive(snapshot?.lengthIn)&&positive(snapshot?.widthIn)
      ?snapshot!.lengthIn!*snapshot!.widthIn!/144:undefined);
  const usablePerSlab=area?area*yieldFraction:undefined;
  const suggestedSlabs=measuredSf>0&&usablePerSlab?Math.ceil(measuredSf/usablePerSlab):undefined;
  const override=scope?.slabCountOverride;
  const count=override!==undefined&&Number.isInteger(override)&&override>0?override:suggestedSlabs;
  const slabCost=nonnegative(ref?.sourceSlabCost)??nonnegative(snapshot?.slabCost)
    ??nonnegative(ref?.catalogSlabCost);
  const costSf=nonnegative(ref?.sourceCostPerSf)??nonnegative(snapshot?.costPerSf);
  const fromSlab=slabCost!==undefined&&count!==undefined?roundCurrency(slabCost*count):undefined;
  // A catalog SF buying cost can provide a clearly labeled fallback. The
  // real slab count is still required before estimating purchase cost.
  const fromSf=area!==undefined&&count!==undefined&&costSf!==undefined
    ?roundCurrency(costSf*area*count):undefined;
  const lines=quote.lines.filter(l=>l.sectionId===section.id);
  const primary=lines.find(l=>l.quantitySource?.syncMode==='live'&&l.quantitySource.field==='countertopSf')
    ??lines.find(l=>l.kind==='material'&&!l.takeoffSinkId);
  const manualOverride=nonnegative(primary?.internalCost);
  const materialCost=manualOverride??fromSlab??fromSf;
  let sinkCost=0,missingSinkCosts=0;
  for(const sink of scope?.takeoffSinks??[]){
    const cost=nonnegative(sink.sinkReference?.snapshot?.internalCost);
    if(cost===undefined){missingSinkCosts++;continue;}
    sinkCost+=cost*sink.count;
  }
  sinkCost=roundCurrency(sinkCost);
  const other=lines.filter(l=>l!==primary&&!l.takeoffSinkId);
  const otherSummary=summarizeQuoteInternalPricing(other);
  const priceTotal=roundCurrency(lines.reduce((total,l)=>total+quoteLineTotal(l),0));
  const known=roundCurrency((materialCost??0)+sinkCost+otherSummary.knownInternalCost);
  const complete=materialCost!==undefined&&missingSinkCosts===0
    &&otherSummary.costedLineCount===otherSummary.costRequiredLineCount;
  const spread=roundCurrency(priceTotal-known);
  const margin=complete&&priceTotal>0?Math.round(spread/priceTotal*1000)/10:undefined;
  return {
    measuredSf,slabAreaSf:area,yield:yieldFraction,usableSfPerSlab:usablePerSlab,
    suggestedSlabs,slabCount:count,slabCost,materialCost,
    costSource:manualOverride!==undefined?'manual':fromSlab!==undefined?'slab':
      fromSf!==undefined?'derived-sf':'unknown',
    sinkCost:missingSinkCosts===(scope?.takeoffSinks?.length??0)&&missingSinkCosts>0?undefined:sinkCost,
    missingSinkCosts,otherCost:otherSummary.knownInternalCost,
    totalKnownCost:known,priceTotal,grossSpread:spread,marginPercent:margin,complete,
    explanation:usablePerSlab===undefined?'Select a slab with recorded dimensions to suggest a slab count.':
      measuredSf.toFixed(2)+' SF ÷ ('+area!.toFixed(2)+' SF/slab × '+
      Math.round(yieldFraction*100)+'% yield) = '+(suggestedSlabs??'—')+' suggested slabs',
  };
}

export function calculateAreaCustomerPrice(mode:AreaPricingChoice,input:{
  amount?:number;sf:number;rate?:number;slabs?:number;costPerSlab?:number;multiplier?:number;
}):number|undefined{
  if(mode==='manual')return nonnegative(input.amount);
  if(mode==='sf')return nonnegative(input.rate)!==undefined
    ?roundCurrency(input.sf*input.rate!):undefined;
  if(nonnegative(input.costPerSlab)===undefined||positive(input.multiplier)===undefined
    ||input.slabs===undefined||!Number.isInteger(input.slabs)||input.slabs<=0)return undefined;
  return roundCurrency(input.slabs*input.costPerSlab!*input.multiplier!);
}
