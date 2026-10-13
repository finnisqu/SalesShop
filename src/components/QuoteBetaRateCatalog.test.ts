import {describe,it,expect} from 'vitest';
import {quoteLineTotal,type Quote,type QuoteLine} from '../types/quote';
import type {RateBookItem} from '../types/rateBook';
import {summarizeQuoteInternalPricing} from '../services/quoteInternalPricing';
import {rateItemToQuotePatch} from './QuoteBetaRateCatalog';

const example=(patch:Partial<RateBookItem>={}):RateBookItem=>({
  id:'trip',category:'add-on',name:'Trip Fee',unit:'flat',internalCost:80,
  sellRate:150,pricingBehavior:'suggested',
  divisionOverrides:[{division:'Retail',internalCost:75,sellRate:180}],
  history:[],active:true,createdAt:'2026-10-01',updatedAt:'2026-10-01',...patch,
});
const quote={id:'q',pricingDivision:'Retail'} as Quote;
describe('Rate Book selection for quote Add-ons',()=>{
  it('captures division sell price and supplier cost with no hand-entered Rate',()=>{
    const patch=rateItemToQuotePatch(example(),quote);
    expect(patch.description).toBe('Trip Fee');
    expect(patch.pricingMode).toBe('quantity-rate');
    expect(patch.quantity).toBe(1);
    expect(patch.rate).toBe(180);
    expect(patch.rateReference?.snapshot?.internalCost).toBe(75);
    expect(patch.rateReference?.rateBookItemId).toBe('trip');
    const line={id:'line',...patch} as QuoteLine;
    expect(quoteLineTotal(line)).toBe(180);
    const more={...line,quantity:3};
    expect(quoteLineTotal(more)).toBe(540);
    expect(summarizeQuoteInternalPricing([more]).knownInternalCost).toBe(225);
    const changed={...more,rate:200};
    expect(quoteLineTotal(changed)).toBe(600);
    expect(changed.rateReference?.snapshot?.sellRate).toBe(180);
  });
  it('keeps cost-only catalog rates private without making up sell prices',()=>{
    const patch=rateItemToQuotePatch(example({id:'install',unit:'sf',
      pricingBehavior:'cost-reference',sellRate:undefined,
      divisionOverrides:[]}),quote);
    expect(patch.includeInTotal).toBe(false);
    expect(patch.customerVisible).toBe(false);
    expect(patch.rate).toBeUndefined();
    expect(patch.rateReference?.snapshot?.internalCost).toBe(80);
  });
});
