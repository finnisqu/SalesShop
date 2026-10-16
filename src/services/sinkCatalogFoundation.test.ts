import { describe, expect, it } from 'vitest';
import { SINK_CATALOG_SEED } from '../store/sinkCatalogStore';
import { migrateLegacySinkProducts } from '../store/rateBookStore';
import type { RateBookItem } from '../types/rateBook';

function legacySink(overrides: Partial<RateBookItem> = {}): RateBookItem {
  return {
    id: 'rate_sink_3218_single',
    category: 'sink',
    name: 'Kitchen 3218 Single',
    code: '3218-S',
    unit: 'each',
    sellRate: 220,
    pricingBehavior: 'suggested',
    divisionOverrides: [],
    history: [],
    active: true,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
    ...overrides,
  };
}

describe('sink catalog foundation', () => {
  it('models Kitchen 3218 as eight variants under one product', () => {
    const model = SINK_CATALOG_SEED.find((candidate) => candidate.id === 'sink_model_3218');

    expect(model).toBeDefined();
    expect(model?.variants).toHaveLength(8);
    expect(model?.variants.map((variant) => [variant.configuration, variant.ada])).toEqual([
      ['single', false],
      ['50/50', false],
      ['60/40', false],
      ['40/60', false],
      ['single', true],
      ['50/50', true],
      ['60/40', true],
      ['40/60', true],
    ]);
    expect(model?.variants.filter((variant) => variant.default)).toHaveLength(1);
  });

  it('preserves known legacy sell prices and leaves unknown variants unpriced', () => {
    const model = SINK_CATALOG_SEED.find((candidate) => candidate.id === 'sink_model_3218');
    const byId = new Map(model?.variants.map((variant) => [variant.id, variant]));

    expect(byId.get('sink_variant_3218_single')?.sellPrice).toBe(220);
    expect(byId.get('sink_variant_3218_5050')?.sellPrice).toBe(220);
    expect(byId.get('sink_variant_3218_6040')?.sellPrice).toBe(220);
    expect(byId.get('sink_variant_3218_ada_single')?.sellPrice).toBe(245);
    expect(byId.get('sink_variant_3218_4060')?.sellPrice).toBeUndefined();
    expect(byId.get('sink_variant_3218_ada_5050')?.sellPrice).toBeUndefined();
  });

  it('consolidates vanity standard and ADA products as variants', () => {
    const oval = SINK_CATALOG_SEED.find((candidate) => candidate.id === 'sink_model_1714_oval');
    const rectangular = SINK_CATALOG_SEED.find((candidate) => candidate.id === 'sink_model_1813_rect');

    expect(oval?.variants.map((variant) => variant.sellPrice)).toEqual([75, 85]);
    expect(rectangular?.variants.map((variant) => variant.sellPrice)).toEqual([95, 105]);
    expect(oval?.variants.map((variant) => variant.ada)).toEqual([false, true]);
    expect(rectangular?.variants.map((variant) => variant.ada)).toEqual([false, true]);
  });

  it('archives legacy sink product rates while adding active sink service rates', () => {
    const migrated = migrateLegacySinkProducts([
      legacySink(),
      legacySink({
        id: 'rate_trip',
        category: 'add-on',
        name: 'Trip Fee',
        code: 'TRIP',
        unit: 'flat',
        sellRate: 150,
      }),
    ]);

    expect(migrated.find((item) => item.id === 'rate_sink_3218_single')?.active).toBe(false);
    expect(migrated.find((item) => item.id === 'rate_trip')?.active).toBe(true);

    const cutout = migrated.find((item) => item.id === 'rate_sink_cutout');
    const customerInstall = migrated.find((item) => item.id === 'rate_sink_customer_install');

    expect(cutout?.category).toBe('sink');
    expect(cutout?.name).toBe('Sink Cutout');
    expect(cutout?.pricingBehavior).toBe('manual');
    expect(cutout?.active).toBe(true);

    expect(customerInstall?.name).toBe('Install Customer-Provided Sink');
    expect(customerInstall?.pricingBehavior).toBe('manual');
    expect(customerInstall?.active).toBe(true);
  });
});
