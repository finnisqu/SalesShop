import { describe, expect, it } from 'vitest';
import { buildCatalogQuoteLinePatch } from './catalogQuoteInsertion';
import type { StockMaterial } from '../types/settings';
import type { SinkModel } from '../types/sink';
import type { RateBookItem } from '../types/rateBook';

const material = {
  id: 'stone1', name: 'Calacatta Test', brand: 'Supplier A', materialType: 'Quartz', stockProgram: true, unit: 'sf', active: true,
  variants: [{
    id: 'slab1', active: true, default: true, thickness: '3cm', finish: 'Polished',
    formatKind: 'slab', lengthIn: 120, widthIn: 60,
    purchaseOptions: [{
      id: 'program1', active: true, default: true, label: 'Stock slab', pricingBasis: 'sf', costPerSf: 9.5,
    }],
  }],
} as StockMaterial;
const sink = {
  id: 'model1', name: '3218 Sink', category: 'kitchen', active: true, variants: [{
    id: 'v1', label: 'Single', configuration: 'single', ada: false, active: true, default: true,
    internalCost: 110, sellPrice: 220, history: [],
  }],
} as SinkModel;
const rate = {
  id: 'rate1', name: 'Install', category: 'fabrication-install', unit: 'sf',
  pricingBehavior: 'suggested', internalCost: 3, sellRate: 5, divisionOverrides: [],
  active: true, history: [], createdAt: '', updatedAt: '',
} as RateBookItem;

describe('Catalog to Quotes snapshots', () => {
  it('copies material source costs internally without creating customer sell prices', () => {
    const patch = buildCatalogQuoteLinePatch({ kind: 'material', material }, { variantId: 'slab1', quantity: 30 });
    expect(patch.description).toContain('Calacatta Test');
    expect(patch.materialReference?.snapshot?.costPerSf).toBe(9.5);
    expect(patch.materialReference?.snapshot?.variantId).toBe('slab1');
    expect(patch.materialReference?.sourceCostPerSf).toBe(9.5);
    expect(patch.materialReference?.pricingSource).toBe('manual-line-rate');
    expect(patch.quantity).toBe(30);
    expect(patch.rate).toBeUndefined();
    expect(patch.amount).toBeUndefined();
  });

  it('captures exact sink variant sell price and its private cost', () => {
    const patch = buildCatalogQuoteLinePatch({ kind: 'sink', model: sink, variantId: 'v1' });
    expect(patch.sinkReference?.snapshot?.sinkModelId).toBe('model1');
    expect(patch.sinkReference?.snapshot?.internalCost).toBe(110);
    expect(patch.rate).toBe(220);
    expect(patch.quantity).toBe(1);
  });

  it('uses existing rate pricing behavior and allows quantity to be entered later', () => {
    const patch = buildCatalogQuoteLinePatch({ kind: 'rate', item: rate });
    expect(patch.rateReference?.snapshot?.rateBookItemId).toBe('rate1');
    expect(patch.rate).toBe(5);
    expect(patch.quantity).toBeUndefined();
  });

  it('keeps internal-only rate references out of customer totals', () => {
    const patch = buildCatalogQuoteLinePatch({ kind: 'rate', item: {
      ...rate, pricingBehavior: 'cost-reference',
    } });
    expect(patch.customerVisible).toBe(false);
    expect(patch.includeInTotal).toBe(false);
    expect(patch.rate).toBeUndefined();
  });
});
