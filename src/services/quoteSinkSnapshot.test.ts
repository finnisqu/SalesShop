import { describe, expect, it } from 'vitest';
import type { SinkModel, SinkVariant } from '../types/sink';
import {
  compareQuoteSinkSnapshot,
  createQuoteSinkSnapshot,
  sinkSnapshotDescription,
  sinkSnapshotLinePatch,
} from './quoteSinkSnapshot';

function variant(overrides: Partial<SinkVariant> = {}): SinkVariant {
  return {
    id: 'sink-variant-3218-5050',
    label: 'Standard 50/50',
    code: '3218-5050',
    configuration: '50/50',
    ada: false,
    active: true,
    default: true,
    internalCost: 110,
    sellPrice: 220,
    effectiveDate: '2026-10-01',
    history: [],
    ...overrides,
  };
}

function model(overrides: Partial<SinkModel> = {}): SinkModel {
  return {
    id: 'sink-model-3218',
    name: 'Kitchen 3218',
    modelCode: '3218',
    brand: 'World Stone',
    supplier: 'Shop stock',
    category: 'kitchen',
    widthIn: 32,
    depthIn: 18,
    mountType: 'undermount',
    material: 'Stainless steel',
    active: true,
    variants: [variant()],
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('quote sink snapshots', () => {
  it('captures model, variant, customer price, and private cost at quote time', () => {
    const snapshot = createQuoteSinkSnapshot(model(), variant(), '2026-10-07T18:20:00.000Z');

    expect(snapshot).toEqual({
      capturedAt: '2026-10-07T18:20:00.000Z',
      sinkModelId: 'sink-model-3218',
      sinkModelName: 'Kitchen 3218',
      modelCode: '3218',
      brand: 'World Stone',
      supplier: 'Shop stock',
      category: 'kitchen',
      widthIn: 32,
      depthIn: 18,
      mountType: 'undermount',
      material: 'Stainless steel',
      variantId: 'sink-variant-3218-5050',
      variantLabel: 'Standard 50/50',
      variantCode: '3218-5050',
      configuration: '50/50',
      ada: false,
      internalCost: 110,
      sellPrice: 220,
      effectiveDate: '2026-10-01',
      sourceUpdatedAt: '2026-10-01T12:00:00.000Z',
    });
  });

  it('creates a practical each-priced quote line with quantity one', () => {
    const snapshot = createQuoteSinkSnapshot(model(), variant());

    expect(sinkSnapshotLinePatch(snapshot)).toMatchObject({
      description: 'World Stone Kitchen 3218 · Standard 50/50',
      pricingMode: 'quantity-rate',
      quantity: 1,
      rate: 220,
      customerVisible: true,
      includeInTotal: true,
      sinkReference: {
        sinkModelId: 'sink-model-3218',
        variantId: 'sink-variant-3218-5050',
      },
    });
  });

  it('allows an unpriced catalog variant without inventing a customer rate', () => {
    const unpriced = variant({ id: 'sink-variant-3218-4060', label: 'Standard 40/60', configuration: '40/60', sellPrice: undefined });
    const snapshot = createQuoteSinkSnapshot(model({ variants: [unpriced] }), unpriced);
    const patch = sinkSnapshotLinePatch(snapshot);

    expect(patch.quantity).toBe(1);
    expect(patch.rate).toBeUndefined();
    expect(snapshot.sellPrice).toBeUndefined();
  });

  it('detects later sink pricing changes without mutating the quoted snapshot', () => {
    const quoted = createQuoteSinkSnapshot(model(), variant({ sellPrice: 220, internalCost: 110 }));
    const current = createQuoteSinkSnapshot(
      model({ updatedAt: '2026-11-01T12:00:00.000Z' }),
      variant({ sellPrice: 235, internalCost: 118, effectiveDate: '2026-11-01' }),
    );

    expect(compareQuoteSinkSnapshot(quoted, current)).toEqual({
      changed: true,
      sellPriceChanged: true,
      internalCostChanged: true,
      sourceChanged: true,
    });
    expect(quoted.sellPrice).toBe(220);
    expect(quoted.internalCost).toBe(110);
  });

  it('uses only the model name for a single Standard variant description', () => {
    const standard = variant({ label: 'Standard', configuration: 'single' });
    const snapshot = createQuoteSinkSnapshot(model({ brand: undefined, variants: [standard] }), standard);
    expect(sinkSnapshotDescription(snapshot)).toBe('Kitchen 3218');
  });
});
