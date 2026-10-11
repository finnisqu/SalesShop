import { describe, expect, it } from 'vitest';
import type { QuoteLine } from '../types/quote';
import { quoteLineAmount, quoteLineTotal, quoteLinesTotal } from '../types/quote';

function line(overrides: Partial<QuoteLine> = {}): QuoteLine {
  return {
    id: 'line-1',
    kind: 'item',
    description: 'Test',
    pricingMode: 'quantity-rate',
    quantity: 2,
    rate: 100,
    customerVisible: true,
    includeInTotal: true,
    ...overrides,
  };
}

describe('quote customer presentation math', () => {
  it('keeps Show and Include independent', () => {
    const hiddenButIncluded = line({ customerVisible: false, includeInTotal: true });
    expect(quoteLineAmount(hiddenButIncluded)).toBe(200);
    expect(quoteLineTotal(hiddenButIncluded)).toBe(200);

    const shownButExcluded = line({ customerVisible: true, includeInTotal: false });
    expect(quoteLineAmount(shownButExcluded)).toBe(200);
    expect(quoteLineTotal(shownButExcluded)).toBe(0);
  });

  it('builds an area total from included internal lines regardless of Show state', () => {
    expect(quoteLinesTotal([
      line({ id: 'material', quantity: 1, rate: 3000, customerVisible: false }),
      line({ id: 'fabrication', quantity: 1, rate: 1200, customerVisible: false }),
      line({ id: 'sink', quantity: 1, rate: 300, customerVisible: false }),
      line({ id: 'excluded', quantity: 1, rate: 500, customerVisible: true, includeInTotal: false }),
    ])).toBe(4500);
  });
});
