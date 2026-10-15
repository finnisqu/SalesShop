import {describe,expect,it} from 'vitest';
import {editedQuotePriceValue} from './quotePriceInput';
import {calculateAreaCustomerPrice} from './quoteAreaCost';
describe('18D Beta numeric editing cannot silently restore an old price',()=>{
  it('keeps unchanged inputs but treats a deleted rate as missing, not the last saved rate',()=>{
    const edits:{rate?:number}={rate:undefined};
    expect(editedQuotePriceValue({},'rate',55)).toBe(55);
    expect(editedQuotePriceValue(edits,'rate',55)).toBeUndefined();
    expect(calculateAreaCustomerPrice('sf',{sf:8.67,
      rate:editedQuotePriceValue(edits,'rate',55)})).toBeUndefined();
    expect(editedQuotePriceValue({rate:0},'rate',55)).toBe(0);
  });
  it('preserves an explicit blank flat amount and unprovided multiplier separately',()=>{
    expect(editedQuotePriceValue({amount:undefined},'amount',1234)).toBeUndefined();
    expect(editedQuotePriceValue({amount:0},'amount',1234)).toBe(0);
    expect(editedQuotePriceValue({multiplier:undefined},'multiplier',2.2)).toBeUndefined();
    expect(editedQuotePriceValue({},'multiplier',2.2)).toBe(2.2);
  });
});
