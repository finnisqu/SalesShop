import type { QuoteLine, QuoteSinkSnapshot } from '../types/quote';
import type { SinkModel, SinkVariant } from '../types/sink';

function sameMoney(a?: number, b?: number) {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a - b) < 0.005;
}

export function createQuoteSinkSnapshot(
  model: SinkModel,
  variant: SinkVariant,
  capturedAt = new Date().toISOString(),
): QuoteSinkSnapshot {
  return {
    capturedAt,
    sinkModelId: model.id,
    sinkModelName: model.name,
    modelCode: model.modelCode,
    brand: model.brand,
    supplier: model.supplier,
    category: model.category,
    widthIn: model.widthIn,
    depthIn: model.depthIn,
    mountType: model.mountType,
    material: model.material,
    variantId: variant.id,
    variantLabel: variant.label,
    variantCode: variant.code,
    configuration: variant.configuration,
    ada: variant.ada,
    internalCost: variant.internalCost,
    sellPrice: variant.sellPrice,
    effectiveDate: variant.effectiveDate,
    sourceUpdatedAt: model.updatedAt,
  };
}

export interface QuoteSinkSnapshotComparison {
  changed: boolean;
  sellPriceChanged: boolean;
  internalCostChanged: boolean;
  sourceChanged: boolean;
}

export function compareQuoteSinkSnapshot(
  quoted: QuoteSinkSnapshot,
  current: QuoteSinkSnapshot,
): QuoteSinkSnapshotComparison {
  const sellPriceChanged = !sameMoney(quoted.sellPrice, current.sellPrice);
  const internalCostChanged = !sameMoney(quoted.internalCost, current.internalCost);
  const sourceChanged = quoted.sinkModelName !== current.sinkModelName
    || quoted.modelCode !== current.modelCode
    || quoted.variantLabel !== current.variantLabel
    || quoted.variantCode !== current.variantCode
    || quoted.configuration !== current.configuration
    || quoted.ada !== current.ada
    || quoted.effectiveDate !== current.effectiveDate;

  return {
    changed: sellPriceChanged || internalCostChanged || sourceChanged,
    sellPriceChanged,
    internalCostChanged,
    sourceChanged,
  };
}

export function sinkSnapshotDescription(snapshot: QuoteSinkSnapshot) {
  const model = [snapshot.brand, snapshot.sinkModelName].filter(Boolean).join(' ');
  const variant = snapshot.variantLabel?.trim();
  return variant && variant.toLowerCase() !== 'standard'
    ? `${model} · ${variant}`
    : model;
}

export function sinkSnapshotLinePatch(snapshot: QuoteSinkSnapshot): Partial<QuoteLine> {
  return {
    description: sinkSnapshotDescription(snapshot),
    pricingMode: 'quantity-rate',
    quantity: 1,
    rate: snapshot.sellPrice,
    amount: undefined,
    customerVisible: true,
    includeInTotal: true,
    sinkReference: {
      sinkModelId: snapshot.sinkModelId,
      variantId: snapshot.variantId,
      snapshot,
    },
  };
}
