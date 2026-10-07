import { describe, expect, it } from 'vitest';
import type { RateBookItem } from '../types/rateBook';
import {
  compareQuoteRateSnapshot,
  createQuoteRateSnapshot,
  rateSnapshotLinePatch,
} from './quoteRateSnapshot';

function rateItem(overrides: Partial<RateBookItem> = {}): RateBookItem {
  return {
    id: 'rate-fab',
    category: 'fabrication-install',
    name: 'Fabrication',
    code: 'FAB',
    unit: 'sf',
    sellRate: 14.5,
    pricingBehavior: 'suggested',
    divisionOverrides: [],
    history: [],
    effectiveDate: '2026-10-01',
    active: true,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('quote Rate Book snapshots', () => {
  it('captures the resolved division-specific values used by the quote', () => {
    const item = rateItem({
      internalCost: 5,
      sellRate: 15,
      divisionOverrides: [{ division: 'Multifamily', internalCost: 4, sellRate: 13.5 }],
    });
    const snapshot = createQuoteRateSnapshot(item, 'Multifamily', '2026-10-07T17:00:00.000Z');

    expect(snapshot).toMatchObject({
      capturedAt: '2026-10-07T17:00:00.000Z',
      rateBookItemId: 'rate-fab',
      name: 'Fabrication',
      code: 'FAB',
      unit: 'sf',
      pricingDivision: 'Multifamily',
      internalCost: 4,
      sellRate: 13.5,
      effectiveDate: '2026-10-01',
    });
  });

  it('creates suggested per-unit quote pricing without inventing a quantity', () => {
    const snapshot = createQuoteRateSnapshot(rateItem());
    expect(rateSnapshotLinePatch(snapshot)).toMatchObject({
      description: 'Fabrication',
      pricingMode: 'quantity-rate',
      quantity: undefined,
      rate: 14.5,
      customerVisible: true,
      includeInTotal: true,
    });
  });

  it('uses one as the practical starting quantity for each-priced items', () => {
    const snapshot = createQuoteRateSnapshot(rateItem({
      id: 'sink',
      category: 'sink',
      name: 'Kitchen 3218 Single',
      unit: 'each',
      sellRate: 220,
    }));
    expect(rateSnapshotLinePatch(snapshot)).toMatchObject({
      pricingMode: 'quantity-rate',
      quantity: 1,
      rate: 220,
    });
  });

  it('uses a direct amount for flat suggested rates', () => {
    const snapshot = createQuoteRateSnapshot(rateItem({
      id: 'trip',
      category: 'add-on',
      name: 'Trip Fee',
      unit: 'flat',
      sellRate: 150,
    }));
    expect(rateSnapshotLinePatch(snapshot)).toMatchObject({
      pricingMode: 'direct',
      amount: 150,
      customerVisible: true,
      includeInTotal: true,
    });
  });

  it('keeps cost-reference items private and out of the customer total', () => {
    const snapshot = createQuoteRateSnapshot(rateItem({
      id: 'install',
      name: 'Installation',
      sellRate: undefined,
      internalCost: 5,
      pricingBehavior: 'cost-reference',
    }));
    expect(rateSnapshotLinePatch(snapshot)).toMatchObject({
      description: 'Installation',
      pricingMode: 'quantity-rate',
      rate: undefined,
      customerVisible: false,
      includeInTotal: false,
    });
  });

  it('detects later Rate Book changes while preserving the quote-time snapshot', () => {
    const quotedItem = rateItem({ sellRate: 14.5, effectiveDate: '2026-10-01' });
    const currentItem = rateItem({ sellRate: 16, effectiveDate: '2026-11-01' });
    const quoted = createQuoteRateSnapshot(quotedItem);
    const current = createQuoteRateSnapshot(currentItem);

    expect(compareQuoteRateSnapshot(quoted, current)).toEqual({
      changed: true,
      sellRateChanged: true,
      internalCostChanged: false,
      sourceChanged: true,
    });
    expect(quoted.sellRate).toBe(14.5);
    expect(current.sellRate).toBe(16);
  });

  it('flags a pricing-division change even when the numeric rate happens to match', () => {
    const item = rateItem({
      divisionOverrides: [{ division: 'Commercial', sellRate: 14.5 }],
    });
    const base = createQuoteRateSnapshot(item);
    const commercial = createQuoteRateSnapshot(item, 'Commercial');

    expect(compareQuoteRateSnapshot(base, commercial)).toMatchObject({
      changed: true,
      sellRateChanged: false,
      sourceChanged: true,
    });
  });
});
