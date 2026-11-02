import type {QuoteSection} from '../types/quote';

/** A multiplier selling price depends on slab basis only, not production-cost estimates. */
export function changesMultiplierSellBasis(
 patch:Partial<NonNullable<QuoteSection['scope']>>,
):boolean{
 return ['slabYield','slabAreaOverrideSf','slabCountOverride','slabCostOverride']
   .some(key=>Object.prototype.hasOwnProperty.call(patch,key));
}
