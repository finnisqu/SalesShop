import { describe, expect, it } from 'vitest';
import { calculateQuoteSlabMultiplierPrice } from './quoteSlabPricing';

describe('quote slab / multiplier quick math', () => {
  it('prices by actual slab cost, multiplier, and slab count', () => {
    expect(calculateQuoteSlabMultiplierPrice({
      slabCost: 1500,
      multiplier: 2.2,
      slabCount: 1,
    })).toMatchObject({
      customerPricePerSlab: 3300,
      customerTotal: 3300,
    });

    expect(calculateQuoteSlabMultiplierPrice({
      slabCost: 1500,
      multiplier: 2.2,
      slabCount: 2,
    })?.customerTotal).toBe(6600);
  });

  it('allows the salesperson to override the multiplier', () => {
    expect(calculateQuoteSlabMultiplierPrice({
      slabCost: 1500,
      multiplier: 2.4,
      slabCount: 1,
    })?.customerTotal).toBe(3600);
  });

  it('rounds customer money to cents', () => {
    expect(calculateQuoteSlabMultiplierPrice({
      slabCost: 1640.11,
      multiplier: 2.2,
      slabCount: 2,
    })).toMatchObject({
      customerPricePerSlab: 3608.24,
      customerTotal: 7216.48,
    });
  });

  it('requires whole positive slabs and valid positive cost inputs', () => {
    expect(calculateQuoteSlabMultiplierPrice({ slabCost: 1500, multiplier: 2.2, slabCount: 1.5 })).toBeUndefined();
    expect(calculateQuoteSlabMultiplierPrice({ slabCost: 0, multiplier: 2.2, slabCount: 1 })).toBeUndefined();
    expect(calculateQuoteSlabMultiplierPrice({ slabCost: 1500, multiplier: 0, slabCount: 1 })).toBeUndefined();
  });
});
