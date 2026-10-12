import { describe, expect, it } from 'vitest';
import type { QuoteLine } from '../types/quote';
import { quoteLinesTotal } from '../types/quote';
import { isGeneralTakeoffSection, presentItemizedQuoteLines, presentGeneralSummary } from './quoteCustomerPresentation';
const priced=(id:string,kind:QuoteLine['kind'],amount:number,customerVisible=true):QuoteLine=>({
  id,sectionId:'a',kind,description:id==='top'?'Kitchen Countertops · Ashen White':id,
  pricingMode:'direct',amount,customerVisible,includeInTotal:true,
});
describe('quote grouping is presentation only',()=>{
  it('folds a hidden priced sink into the visible countertop row without changing the total',()=>{
    const lines=[priced('top','material',1780),priced('sink','sink',220,false)];
    const presented=presentItemizedQuoteLines(lines);
    expect(presented).toHaveLength(1);
    expect(presented[0].description).toContain('Ashen White');
    expect(presented[0].amount).toBe(2000);
    expect(presented[0].aggregated).toBe(true);
    expect(quoteLinesTotal(lines)).toBe(2000);
    const split=presentItemizedQuoteLines(lines.map(l=>({...l,customerVisible:true})));
    expect(split.map(l=>l.amount)).toEqual([1780,220]);
    expect(quoteLinesTotal(lines)).toBe(2000);
  });
  it('gathers all hidden billable charges without leaking their names and keeps non-billable exclusions out',()=>{
    const lines=[priced('top','item',1200),priced('sink','sink',220,false),
      priced('labor','rate',175,false),{...priced('example','rate',900,false),includeInTotal:false}];
    const result=presentItemizedQuoteLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(1595);
  });
  it('does not show excluded priced work on the customer document',()=>{
    const lines=[priced('top','material',1780),
      {...priced('excluded','sink',220),includeInTotal:false}];
    const presented=presentItemizedQuoteLines(lines);
    expect(presented).toHaveLength(1);
    expect(presented[0].amount).toBe(1780);
    expect(quoteLinesTotal(lines)).toBe(1780);
  });
  it('gives a safe unnamed fallback when an Area has no customer-visible priced row',()=>{
    const result=presentItemizedQuoteLines([priced('sink','sink',220,false)]);
    expect(result).toMatchObject([{description:'Included work',amount:220}]);
  });
  it('suppresses General takeoffs as a presentation heading while preserving standard named Areas',()=>{
    expect(isGeneralTakeoffSection({title:'General takeoffs'})).toBe(true);
    expect(isGeneralTakeoffSection({title:'Kitchen'})).toBe(false);
    expect(presentGeneralSummary([priced('top','material',1780),priced('sink','sink',220,false)]))
      .toMatchObject([{description:'Kitchen Countertops · Ashen White',amount:2000}]);
  });
});
