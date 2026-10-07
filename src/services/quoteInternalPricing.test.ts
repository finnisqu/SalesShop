import { describe, expect, it } from 'vitest';
import { summarizeQuoteInternalPricing } from './quoteInternalPricing';
import type { QuoteLine } from '../types/quote';

function line(overrides: Partial<QuoteLine>): QuoteLine {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    kind: 'item',
    description: 'Line',
    pricingMode: 'direct',
    amount: 0,
    customerVisible: true,
    includeInTotal: true,
    ...overrides,
  };
}

describe('quote internal pricing summary', () => {
  it('rolls material slab snapshots into known internal cost without changing customer price', () => {
    const summary = summarizeQuoteInternalPricing([
      line({
        id: 'material',
        kind: 'material',
        amount: 2200,
        materialReference: {
          stockProgram: true,
          pricingSource: 'slab-multiplier',
          slabCount: 2,
          snapshot: {
            capturedAt: '2026-10-07T17:00:00.000Z',
            materialId: 'mat-1',
            materialName: 'Calacatta',
            materialType: 'Quartz',
            stockProgram: true,
            slabCost: 500,
          },
        },
      }),
    ]);

    expect(summary.customerTotal).toBe(2200);
    expect(summary.knownInternalCost).toBe(1000);
    expect(summary.grossSpread).toBe(1200);
    expect(summary.marginPercent).toBe(54.5);
    expect(summary.complete).toBe(true);
  });

  it('uses Rate Book internal cost times quantity, including cost-reference lines', () => {
    const summary = summarizeQuoteInternalPricing([
      line({
        id: 'install',
        kind: 'rate',
        pricingMode: 'quantity-rate',
        quantity: 100,
        rate: undefined,
        amount: undefined,
        customerVisible: false,
        includeInTotal: false,
        rateReference: {
          rateBookItemId: 'install',
          snapshot: {
            capturedAt: '2026-10-07T17:00:00.000Z',
            rateBookItemId: 'install',
            category: 'fabrication-install',
            name: 'Installation',
            unit: 'sf',
            pricingBehavior: 'cost-reference',
            internalCost: 5,
          },
        },
      }),
      line({ id: 'sale', amount: 1500 }),
    ]);

    expect(summary.customerTotal).toBe(1500);
    expect(summary.knownInternalCost).toBe(500);
    expect(summary.complete).toBe(false);
    expect(summary.marginPercent).toBeUndefined();
  });

  it('uses flat Rate Book internal cost once', () => {
    const summary = summarizeQuoteInternalPricing([
      line({
        id: 'trip',
        kind: 'rate',
        pricingMode: 'direct',
        amount: 150,
        rateReference: {
          rateBookItemId: 'trip',
          snapshot: {
            capturedAt: '2026-10-07T17:00:00.000Z',
            rateBookItemId: 'trip',
            category: 'add-on',
            name: 'Trip Fee',
            unit: 'flat',
            pricingBehavior: 'suggested',
            internalCost: 75,
            sellRate: 150,
          },
        },
      }),
    ]);

    expect(summary.knownInternalCost).toBe(75);
    expect(summary.grossSpread).toBe(75);
    expect(summary.marginPercent).toBe(50);
  });

  it('marks a priced generic line as uncovered instead of overstating gross margin', () => {
    const summary = summarizeQuoteInternalPricing([
      line({ id: 'manual', amount: 1200 }),
    ]);

    expect(summary.costRequiredLineCount).toBe(1);
    expect(summary.costedLineCount).toBe(0);
    expect(summary.complete).toBe(false);
    expect(summary.marginPercent).toBeUndefined();
  });

  it('uses a manual total internal cost for ordinary priced lines', () => {
    const summary = summarizeQuoteInternalPricing([
      line({ id: 'manual', amount: 1200, internalCost: 700 }),
    ]);

    expect(summary.customerTotal).toBe(1200);
    expect(summary.knownInternalCost).toBe(700);
    expect(summary.grossSpread).toBe(500);
    expect(summary.costedLineCount).toBe(1);
    expect(summary.costRequiredLineCount).toBe(1);
    expect(summary.complete).toBe(true);
    expect(summary.marginPercent).toBe(41.7);
    expect(summary.lines[0].costSource).toBe('manual-total');
  });

  it('keeps manual internal cost independent from customer quantity-rate math', () => {
    const summary = summarizeQuoteInternalPricing([
      line({
        id: 'manual-qty',
        pricingMode: 'quantity-rate',
        quantity: 100,
        rate: 12,
        amount: undefined,
        internalCost: 650,
      }),
    ]);

    expect(summary.customerTotal).toBe(1200);
    expect(summary.knownInternalCost).toBe(650);
    expect(summary.marginPercent).toBe(45.8);
  });

  it('can use quantity times material cost per square foot', () => {
    const summary = summarizeQuoteInternalPricing([
      line({
        id: 'material-sf',
        kind: 'material',
        pricingMode: 'quantity-rate',
        quantity: 100,
        rate: 30,
        amount: undefined,
        materialReference: {
          stockProgram: true,
          pricingSource: 'manual-line-rate',
          snapshot: {
            capturedAt: '2026-10-07T17:00:00.000Z',
            materialId: 'mat-2',
            materialName: 'Carrara',
            materialType: 'Quartz',
            stockProgram: true,
            costPerSf: 12.5,
          },
        },
      }),
    ]);

    expect(summary.customerTotal).toBe(3000);
    expect(summary.knownInternalCost).toBe(1250);
    expect(summary.grossSpread).toBe(1750);
    expect(summary.marginPercent).toBe(58.3);
  });
});
