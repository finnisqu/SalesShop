import type { QuoteLineRateReference, QuoteRateSnapshot } from '../types/quote';
import type { MaterialLevelGuideDocument, MaterialLevelRule } from '../types/materialLevelGuide';
import type { RateBookDivision } from '../types/rateBook';

/** Quote rate references snapshot selected values so future guide edits cannot reprice a bid. */
export function builderLevelRateReference(
  guide: Pick<MaterialLevelGuideDocument,'id'|'updatedAt'>,
  rule: MaterialLevelRule,
  division?: RateBookDivision,
  capturedAt=new Date().toISOString(),
): QuoteLineRateReference {
  const snapshot:QuoteRateSnapshot={
    capturedAt,rateBookItemId:rule.id,category:'material',name:'Stock / Builder '+rule.label,
    code:'BUILDER-'+rule.label.replace(/\D/g,''),unit:'sf',pricingBehavior:'suggested',
    pricingDivision:division,sellRate:rule.customerRate,
    notes:guide.id+' · '+rule.label+' · material cost ceiling $'+rule.maxMaterialCost.toFixed(2)+'/SF',
    sourceUpdatedAt:guide.updatedAt,
  };
  return {rateBookItemId:rule.id,snapshot};
}

/** Numeric level order stays stable when the guide is edited or sorted by cost. */
export function selectableBuilderLevels(rules:MaterialLevelRule[]) {
  return rules.filter(rule=>rule.active&&Number.isFinite(rule.customerRate)
    &&rule.customerRate>=0).sort((a,b)=>{
    const level=(rule:MaterialLevelRule)=>Number(rule.label.match(/\d+/)?.[0]??999);
    return level(a)-level(b)||a.maxMaterialCost-b.maxMaterialCost;
  });
}
