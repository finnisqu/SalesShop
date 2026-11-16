import type {AreaCostProjection} from './quoteAreaCost';
export type PricingAreaFilter='all'|'selling'|'cost'|'ready';
export type PricingAreaStatus={blockers:number;measuredSf:number;costComplete?:boolean};
/** Triage does not alter quote data, selling prices or issuing eligibility. */
export function pricingAreaMatches(filter:PricingAreaFilter,area:PricingAreaStatus):boolean{
 const needsSell=area.blockers>0;
 const needsCost=area.measuredSf>0&&!area.costComplete;
 if(filter==='selling')return needsSell;
 if(filter==='cost')return needsCost;
 if(filter==='ready')return !needsSell&&!needsCost;
 return true;
}
/** Missing buying cost belongs in Materials; labor and other estimate gaps
 * belong in Calculator. Both are advisory only, not customer pricing gates. */
export function nextInternalCostTab(cost:Pick<AreaCostProjection,'costCoverage'>):'materials'|'calculator'{
 return !cost.costCoverage.material||!cost.costCoverage.sinks?'materials':'calculator';
}
/** A spread on partial costs must never be labeled a fully-loaded margin. */
export function pricingAreaMarginLabel(cost:Pick<AreaCostProjection,'marginPercent'|'knownCostSpreadPercent'|'complete'>):string{
 if(cost.complete&&cost.marginPercent!==undefined)
  return 'Estimated fully-loaded margin '+cost.marginPercent.toFixed(1)+'%';
 if(cost.knownCostSpreadPercent!==undefined)
  return 'Known-cost spread '+cost.knownCostSpreadPercent.toFixed(1)+'% (partial estimate · Margin incomplete)';
 return 'Margin incomplete';
}
