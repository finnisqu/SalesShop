import {
  resolveRateBookValues,
  type RateBookDivision,
  type RateBookItem,
} from '../types/rateBook';
import type { QuoteLine, QuoteRateSnapshot } from '../types/quote';

function sameMoney(a?: number, b?: number) {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a - b) < 0.005;
}

export function createQuoteRateSnapshot(
  item: RateBookItem,
  division?: RateBookDivision,
  capturedAt = new Date().toISOString(),
): QuoteRateSnapshot {
  const resolved = resolveRateBookValues(item, division);
  return {
    capturedAt,
    rateBookItemId: item.id,
    category: item.category,
    name: item.name,
    code: item.code,
    unit: item.unit,
    pricingBehavior: item.pricingBehavior,
    pricingDivision: division,
    internalCost: resolved.internalCost,
    sellRate: resolved.sellRate,
    effectiveDate: item.effectiveDate,
    notes: item.notes,
    sourceUpdatedAt: item.updatedAt,
  };
}

export interface QuoteRateSnapshotComparison {
  changed: boolean;
  sellRateChanged: boolean;
  internalCostChanged: boolean;
  sourceChanged: boolean;
}

export function compareQuoteRateSnapshot(
  quoted: QuoteRateSnapshot,
  current: QuoteRateSnapshot,
): QuoteRateSnapshotComparison {
  const sellRateChanged = !sameMoney(quoted.sellRate, current.sellRate);
  const internalCostChanged = !sameMoney(quoted.internalCost, current.internalCost);
  const sourceChanged = quoted.effectiveDate !== current.effectiveDate
    || quoted.pricingBehavior !== current.pricingBehavior
    || quoted.pricingDivision !== current.pricingDivision
    || quoted.unit !== current.unit;
  return {
    changed: sellRateChanged || internalCostChanged || sourceChanged,
    sellRateChanged,
    internalCostChanged,
    sourceChanged,
  };
}

export function rateSnapshotLinePatch(snapshot: QuoteRateSnapshot): Partial<QuoteLine> {
  const quantity = snapshot.unit === 'each' || snapshot.unit === 'slab' ? 1 : undefined;
  if (snapshot.pricingBehavior === 'cost-reference') {
    return {
      description: snapshot.name,
      pricingMode: snapshot.unit === 'flat' ? 'direct' : 'quantity-rate',
      quantity,
      rate: undefined,
      amount: undefined,
      customerVisible: false,
      includeInTotal: false,
      rateReference: { rateBookItemId: snapshot.rateBookItemId, snapshot },
    };
  }

  if (snapshot.unit === 'flat') {
    return {
      description: snapshot.name,
      pricingMode: 'direct',
      quantity: undefined,
      rate: undefined,
      amount: snapshot.sellRate,
      customerVisible: true,
      includeInTotal: true,
      rateReference: { rateBookItemId: snapshot.rateBookItemId, snapshot },
    };
  }

  return {
    description: snapshot.name,
    pricingMode: 'quantity-rate',
    quantity,
    rate: snapshot.sellRate,
    amount: undefined,
    customerVisible: true,
    includeInTotal: true,
    rateReference: { rateBookItemId: snapshot.rateBookItemId, snapshot },
  };
}
