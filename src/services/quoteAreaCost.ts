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
  /** Physical buying quantity, optionally manually fractional. */
  purchaseSlabs?:number;shopCost?:number;installCost?:number;
  materialCost?:number;costSource:'slab'|'derived-sf'|'manual'|'unknown';
  sinkCost?:number;missingSinkCosts:number;otherCost:number;
  totalKnownCost:number;priceTotal:number;grossSpread:number;
  /** Only defined once material, sink, shop, install and other cost are entered. */
  marginPercent?:number;complete:boolean;
  /** Provisional spread on entered costs, not a full margin. */
  knownCostSpreadPercent?:number;
  costCoverage:{material:boolean;sinks:boolean;shop:boolean;install:boolean;other:boolean};
  missingCostItems:string[];explanation:string;
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
  const area=positive(scope?.slabAreaOverrideSf)??positive(snapshot?.areaSf)
    ??(positive(snapshot?.lengthIn)&&positive(snapshot?.widthIn)
      ?snapshot!.lengthIn!*snapshot!.widthIn!/144:undefined);
  const usablePerSlab=area?area*yieldFraction:undefined;
  const suggestedSlabs=measuredSf>0&&usablePerSlab?Math.ceil(measuredSf/usablePerSlab):undefined;
  const override=scope?.slabCountOverride;
  const count=override!==undefined&&Number.isInteger(override)&&override>0?override:suggestedSlabs;
  const purchaseSlabs=positive(scope?.slabPurchaseQuantityOverride)??count;
  const shopCost=nonnegative(scope?.shopCostOverride)??
    (nonnegative(scope?.shopCostRateSf)!==undefined?roundCurrency(measuredSf*scope!.shopCostRateSf!):undefined);
  const installCost=nonnegative(scope?.installCostOverride)??
    (nonnegative(scope?.installCostRateSf)!==undefined?roundCurrency(measuredSf*scope!.installCostRateSf!):undefined);
  const slabCost=nonnegative(scope?.slabCostOverride)??nonnegative(ref?.sourceSlabCost)??nonnegative(snapshot?.slabCost)
    ??nonnegative(ref?.catalogSlabCost);
  const costSf=nonnegative(ref?.sourceCostPerSf)??nonnegative(snapshot?.costPerSf);
  const fromSlab=slabCost!==undefined&&purchaseSlabs!==undefined
    ?roundCurrency(slabCost*purchaseSlabs):undefined;
  // A catalog SF buying cost can provide a clearly labeled fallback. The
  // real slab count is still required before estimating purchase cost.
  const fromSf=area!==undefined&&purchaseSlabs!==undefined&&costSf!==undefined
    ?roundCurrency(costSf*area*purchaseSlabs):undefined;
  const lines=quote.lines.filter(l=>l.sectionId===section.id);
  const primary=lines.find(l=>l.quantitySource?.syncMode==='live'&&l.quantitySource.field==='countertopSf')
    ??lines.find(l=>l.kind==='material'&&!l.takeoffSinkId);
  const manualOverride=nonnegative(primary?.internalCost);
  const materialCost=manualOverride??fromSlab??fromSf;
  let sinkCost=0,missingSinkCosts=0;
  // Specifications-only sinks never create a charge or require a buying cost.
  const pricedSinks=(scope?.takeoffSinks??[]).filter(s=>s.includeInPricing&&s.count>0);
  for(const sink of pricedSinks){
    const cost=nonnegative(sink.internalCostOverride)??nonnegative(sink.sinkReference?.snapshot?.internalCost);
    if(cost===undefined){missingSinkCosts++;continue;}
    sinkCost+=cost*sink.count;
  }
  sinkCost=roundCurrency(sinkCost);
  const other=lines.filter(l=>l!==primary&&!l.takeoffSinkId);
  const otherSummary=summarizeQuoteInternalPricing(other);
  const priceTotal=roundCurrency(lines.reduce((total,l)=>total+quoteLineTotal(l),0));
  const known=roundCurrency((materialCost??0)+sinkCost+otherSummary.knownInternalCost+
    (shopCost??0)+(installCost??0));
  const costCoverage={
    material:materialCost!==undefined,
    sinks:missingSinkCosts===0,
    shop:shopCost!==undefined,
    install:installCost!==undefined,
    other:otherSummary.costedLineCount===otherSummary.costRequiredLineCount,
  };
  const missingCostItems=([
    ['material','Material buying cost'],['sinks','Sink buying costs'],
    ['shop','Fabrication / shop cost'],['install','Installation cost'],
    ['other','Other priced work costs'],
  ] as const).filter(([key])=>!costCoverage[key]).map(([,label])=>label);
  const complete=missingCostItems.length===0;
  const spread=roundCurrency(priceTotal-known);
  const coreCovered=costCoverage.material&&costCoverage.sinks&&costCoverage.other;
  const knownCostSpreadPercent=coreCovered&&priceTotal>0
    ?Math.round(spread/priceTotal*1000)/10:undefined;
  const margin=complete?knownCostSpreadPercent:undefined;
  return {
    measuredSf,slabAreaSf:area,yield:yieldFraction,usableSfPerSlab:usablePerSlab,
    suggestedSlabs,slabCount:count,purchaseSlabs,slabCost,shopCost,installCost,materialCost,
    costSource:manualOverride!==undefined?'manual':fromSlab!==undefined?'slab':
      fromSf!==undefined?'derived-sf':'unknown',
    sinkCost:missingSinkCosts===pricedSinks.length&&missingSinkCosts>0?undefined:sinkCost,
    missingSinkCosts,otherCost:otherSummary.knownInternalCost,
    totalKnownCost:known,priceTotal,grossSpread:spread,
    knownCostSpreadPercent,marginPercent:margin,complete,costCoverage,missingCostItems,
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
