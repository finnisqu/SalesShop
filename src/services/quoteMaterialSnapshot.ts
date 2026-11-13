import type { QuoteMaterialCostSnapshot } from '../types/quote';
import {
  materialVariantAreaSf,
  resolvedMaterialFamily,
  type ResolvedMaterialCostReference,
  type StockMaterial,
} from '../types/settings';

function variantLabel(reference: ResolvedMaterialCostReference) {
  const variant = reference.variant;
  if (!variant) return undefined;
  const dimensions = variant.lengthIn && variant.widthIn ? `${variant.lengthIn}×${variant.widthIn}` : undefined;
  return [variant.thickness, variant.finish, variant.formatName, dimensions].filter(Boolean).join(' · ') || undefined;
}

export function createQuoteMaterialCostSnapshot(
  material: StockMaterial,
  reference: ResolvedMaterialCostReference,
  capturedAt = new Date().toISOString(),
): QuoteMaterialCostSnapshot {
  const variant = reference.variant;
  const purchaseOption = reference.purchaseOption;
  const source = purchaseOption?.source;

  return {
    capturedAt,
    materialId: material.id,
    materialName: material.name,
    brand: material.brand,
    supplier: material.supplier,
    materialFamily: resolvedMaterialFamily(material),
    materialType: material.materialType,
    stockProgram: material.stockProgram,
    variantId: variant?.id,
    variantLabel: variantLabel(reference),
    thickness: variant?.thickness,
    finish: variant?.finish,
    formatName: variant?.formatName,
    formatKind: variant?.formatKind,
    lengthIn: variant?.lengthIn,
    widthIn: variant?.widthIn,
    areaSf: materialVariantAreaSf(variant),
    availability: variant?.availability,
    purchaseOptionId: purchaseOption?.id,
    purchaseOptionLabel: purchaseOption?.label,
    purchaseMinQuantity: purchaseOption?.minQuantity,
    pricingBasis: purchaseOption?.pricingBasis,
    costPerSf: reference.costPerSf,
    slabCost: reference.slabCost,
    sourcePublicationId: source?.publicationId,
    sourcePriceListLabel: source?.priceListLabel,
    sourceEffectiveDate: source?.effectiveDate,
    sourceFileName: source?.sourceFileName,
    sourcePageSheet: source?.sourcePageSheet,
    sourceReference: source?.sourceReference,
    sourceRecordedAt: source?.recordedAt,
    sourceProvenance: source?.provenance,
  };
}

function sameMoney(a?: number, b?: number) {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a - b) < 0.005;
}

export interface QuoteMaterialSnapshotComparison {
  changed: boolean;
  costChanged: boolean;
  sourceChanged: boolean;
}

export function compareQuoteMaterialSnapshot(
  snapshot: QuoteMaterialCostSnapshot,
  current: QuoteMaterialCostSnapshot,
): QuoteMaterialSnapshotComparison {
  const costChanged = !sameMoney(snapshot.costPerSf, current.costPerSf)
    || !sameMoney(snapshot.slabCost, current.slabCost);
  const sourceChanged = snapshot.sourcePublicationId !== current.sourcePublicationId
    || snapshot.sourceEffectiveDate !== current.sourceEffectiveDate
    || snapshot.sourcePriceListLabel !== current.sourcePriceListLabel
    || snapshot.materialName !== current.materialName
    || snapshot.brand !== current.brand
    || snapshot.supplier !== current.supplier
    || snapshot.materialType !== current.materialType
    || snapshot.materialFamily !== current.materialFamily
    || snapshot.stockProgram !== current.stockProgram
    || snapshot.variantId !== current.variantId
    || snapshot.variantLabel !== current.variantLabel
    || snapshot.thickness !== current.thickness
    || snapshot.finish !== current.finish
    || snapshot.formatName !== current.formatName
    || snapshot.formatKind !== current.formatKind
    || snapshot.lengthIn !== current.lengthIn
    || snapshot.widthIn !== current.widthIn
    || snapshot.areaSf !== current.areaSf
    || snapshot.availability !== current.availability
    || snapshot.purchaseOptionId !== current.purchaseOptionId
    || snapshot.purchaseOptionLabel !== current.purchaseOptionLabel
    || snapshot.purchaseMinQuantity !== current.purchaseMinQuantity
    || snapshot.pricingBasis !== current.pricingBasis
    || snapshot.sourceFileName !== current.sourceFileName
    || snapshot.sourcePageSheet !== current.sourcePageSheet
    || snapshot.sourceReference !== current.sourceReference
    || snapshot.sourceProvenance !== current.sourceProvenance;
  return {
    changed: costChanged || sourceChanged,
    costChanged,
    sourceChanged,
  };
}
