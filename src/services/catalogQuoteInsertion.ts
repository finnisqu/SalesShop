import { createQuoteMaterialCostSnapshot } from './quoteMaterialSnapshot';
import { createQuoteRateSnapshot, rateSnapshotLinePatch } from './quoteRateSnapshot';
import { createQuoteSinkSnapshot, sinkSnapshotLinePatch } from './quoteSinkSnapshot';
import { resolveStockMaterialCostReference, type StockMaterial } from '../types/settings';
import type { SinkModel } from '../types/sink';
import type { RateBookItem } from '../types/rateBook';
import type { QuoteLine } from '../types/quote';
import type { RateBookDivision } from '../types/rateBook';

export type CatalogQuoteSource =
  | { kind: 'material'; material: StockMaterial; variantId?: string }
  | { kind: 'sink'; model: SinkModel; variantId?: string }
  | { kind: 'rate'; item: RateBookItem };

export function buildCatalogQuoteLinePatch(
  source: CatalogQuoteSource,
  options: { variantId?: string; purchaseOptionId?: string; quantity?: number; division?: RateBookDivision } = {},
): Partial<QuoteLine> {
  if (source.kind === 'material') {
    const reference = resolveStockMaterialCostReference(source.material, options.variantId ?? source.variantId, options.purchaseOptionId);
    const material = source.material;
    // Supplier cost is an INTERNAL reference, never the customer's sell price.
    return {
      description: [material.brand, material.name, reference.variant?.thickness, reference.variant?.finish].filter(Boolean).join(' · '),
      pricingMode: 'quantity-rate',
      quantity: options.quantity,
      rate: undefined,
      amount: undefined,
      customerVisible: true,
      includeInTotal: true,
      materialReference: {
        materialId: material.id,
        variantId: reference.variant?.id,
        purchaseOptionId: reference.purchaseOption?.id,
        stockProgram: material.stockProgram,
        pricingSource: 'manual-line-rate',
        sourceCostPerSf: reference.costPerSf,
        catalogSlabCost: reference.slabCost,
        snapshot: createQuoteMaterialCostSnapshot(material, reference),
      },
    };
  }
  if (source.kind === 'sink') {
    const variant = source.model.variants.find((item) => item.id === (options.variantId ?? source.variantId) && item.active)
      ?? source.model.variants.find((item) => item.active && item.default)
      ?? source.model.variants.find((item) => item.active);
    if (!variant) throw new Error('This sink model has no active variant to quote.');
    const patch = sinkSnapshotLinePatch(createQuoteSinkSnapshot(source.model, variant));
    return { ...patch, quantity: options.quantity ?? 1 };
  }
  const snapshot = createQuoteRateSnapshot(source.item, options.division);
  const patch = rateSnapshotLinePatch(snapshot);
  // Quantity is deliberately blank for SF/LF services until takeoff is entered.
  return { ...patch, quantity: snapshot.unit === 'flat' ? undefined : options.quantity ?? patch.quantity };
}
