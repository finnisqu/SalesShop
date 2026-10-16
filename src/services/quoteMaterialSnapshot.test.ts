import { describe, expect, it } from 'vitest';
import {
  compareQuoteMaterialSnapshot,
  createQuoteMaterialCostSnapshot,
} from './quoteMaterialSnapshot';
import { resolveStockMaterialCostReference, type StockMaterial } from '../types/settings';

function material(costPerSf = 14.5, costPerUnit = 850.86, publicationId = 'pub-1'): StockMaterial {
  return {
    id: 'mat-1',
    name: 'Arctic White',
    supplier: 'MSI',
    brand: 'MSI',
    materialFamily: 'Engineered Surfaces',
    materialType: 'Quartz',
    stockProgram: true,
    unit: 'sf',
    active: true,
    variants: [{
      id: 'variant-3cm',
      active: true,
      default: true,
      thickness: '3cm',
      finish: 'Polished',
      formatName: 'Jumbo',
      formatKind: 'slab',
      lengthIn: 130,
      widthIn: 65,
      areaSf: 58.68,
      availability: 'stock',
      purchaseOptions: [{
        id: 'standard',
        label: 'Standard',
        active: true,
        default: true,
        pricingBasis: 'slab',
        costPerSf,
        costPerUnit,
        source: {
          kind: 'supplier-import',
          publicationId,
          supplier: 'MSI',
          sourceFileName: 'MSI 2026.xlsx',
          sourcePageSheet: 'Quartz',
          sourceReference: 'Arctic White 3cm',
          priceListLabel: 'MSI 2026',
          effectiveDate: '2026-01-01',
          recordedAt: '2026-10-01T12:00:00.000Z',
          provenance: 'supplier-listed',
        },
      }],
    }],
  };
}

describe('quote material cost snapshots', () => {
  it('captures quote-time material identity, variant, program, cost, and source metadata', () => {
    const source = material();
    const reference = resolveStockMaterialCostReference(source, 'variant-3cm', 'standard');
    const snapshot = createQuoteMaterialCostSnapshot(source, reference, '2026-10-07T14:00:00.000Z');

    expect(snapshot).toMatchObject({
      capturedAt: '2026-10-07T14:00:00.000Z',
      materialId: 'mat-1',
      materialName: 'Arctic White',
      brand: 'MSI',
      supplier: 'MSI',
      materialFamily: 'Engineered Surfaces',
      materialType: 'Quartz',
      stockProgram: true,
      variantId: 'variant-3cm',
      variantLabel: '3cm · Polished · Jumbo · 130×65',
      thickness: '3cm',
      finish: 'Polished',
      formatName: 'Jumbo',
      areaSf: 58.68,
      availability: 'stock',
      purchaseOptionId: 'standard',
      purchaseOptionLabel: 'Standard',
      pricingBasis: 'slab',
      costPerSf: 14.5,
      slabCost: 850.86,
      sourcePublicationId: 'pub-1',
      sourcePriceListLabel: 'MSI 2026',
      sourceEffectiveDate: '2026-01-01',
      sourceFileName: 'MSI 2026.xlsx',
      sourcePageSheet: 'Quartz',
      sourceReference: 'Arctic White 3cm',
      sourceProvenance: 'supplier-listed',
    });
  });

  it('does not consider an unchanged catalog snapshot changed', () => {
    const source = material();
    const reference = resolveStockMaterialCostReference(source);
    const quoted = createQuoteMaterialCostSnapshot(source, reference, '2026-10-01T00:00:00.000Z');
    const current = createQuoteMaterialCostSnapshot(source, reference, '2026-10-07T00:00:00.000Z');

    expect(compareQuoteMaterialSnapshot(quoted, current)).toEqual({
      changed: false,
      costChanged: false,
      sourceChanged: false,
    });
  });

  it('detects supplier price changes without mutating the quoted snapshot', () => {
    const oldMaterial = material();
    const quoted = createQuoteMaterialCostSnapshot(oldMaterial, resolveStockMaterialCostReference(oldMaterial));

    const newMaterial = material(15.75, 924.21, 'pub-2');
    const current = createQuoteMaterialCostSnapshot(newMaterial, resolveStockMaterialCostReference(newMaterial));

    expect(compareQuoteMaterialSnapshot(quoted, current)).toEqual({
      changed: true,
      costChanged: true,
      sourceChanged: true,
    });
    expect(quoted.costPerSf).toBe(14.5);
    expect(quoted.slabCost).toBe(850.86);
    expect(current.costPerSf).toBe(15.75);
  });

  it('detects a new source publication even when price stays the same', () => {
    const oldMaterial = material(14.5, 850.86, 'pub-1');
    const newMaterial = material(14.5, 850.86, 'pub-2');

    const comparison = compareQuoteMaterialSnapshot(
      createQuoteMaterialCostSnapshot(oldMaterial, resolveStockMaterialCostReference(oldMaterial)),
      createQuoteMaterialCostSnapshot(newMaterial, resolveStockMaterialCostReference(newMaterial)),
    );

    expect(comparison.changed).toBe(true);
    expect(comparison.costChanged).toBe(false);
    expect(comparison.sourceChanged).toBe(true);
  });
});
