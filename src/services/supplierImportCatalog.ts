import type {
  MaterialPriceSource,
  MaterialPriceVersion,
  MaterialPurchaseOption,
  MaterialVariant,
  StockMaterial,
} from '../types/settings';
import type {
  SupplierImportCandidate,
  SupplierImportPriceEvidence,
  SupplierImportPriceProvenance,
  SupplierImportSession,
} from '../types/supplierImport';

export interface SupplierImportPublishPlan {
  stockMaterials: StockMaterial[];
  auditChanges: Array<Record<string, unknown>>;
  publishedCandidateIds: string[];
  summary: {
    publishedCount: number;
    newCount: number;
    updatedCount: number;
    unchangedCount: number;
    ignoredCount: number;
  };
}

export interface SupplierImportPublishPlanOptions {
  publicationId: string;
  publishedAt: string;
  idFactory?: (prefix: string) => string;
}

function defaultIdFactory(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalized(value?: string | number) {
  return String(value ?? '').trim().toLowerCase();
}

function variantIdentity(variant: MaterialVariant) {
  return [
    normalized(variant.thickness),
    normalized(variant.finish),
    normalized(variant.formatName),
    normalized(variant.formatKind),
    normalized(variant.lengthIn),
    normalized(variant.widthIn),
    normalized(variant.areaSf),
  ].join('|');
}

function optionIdentity(option: MaterialPurchaseOption) {
  return normalized(option.label);
}

function materialIdentity(material: Pick<StockMaterial, 'brand' | 'materialType' | 'name'>) {
  return [normalized(material.brand), normalized(material.materialType), normalized(material.name)].join('|');
}

function materialSkuSet(material: StockMaterial) {
  return new Set([
    material.sku,
    ...(material.variants ?? []).map((variant) => variant.sku),
  ].filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase()));
}

function unionStrings(existing?: string[], incoming?: string[]) {
  return [...new Set([...(existing ?? []), ...(incoming ?? [])].filter(Boolean))];
}

function priceChanged(existing: MaterialPurchaseOption | undefined, incoming: MaterialPurchaseOption) {
  if (!existing) return false;
  return existing.costPerSf !== incoming.costPerSf
    || existing.costPerUnit !== incoming.costPerUnit
    || existing.pricingBasis !== incoming.pricingBasis
    || existing.minQuantity !== incoming.minQuantity;
}

function sourceFor(
  session: SupplierImportSession,
  candidate: SupplierImportCandidate,
  evidence: SupplierImportPriceEvidence | undefined,
  publicationId: string,
  provenance: SupplierImportPriceProvenance,
  recordedAt: string,
): MaterialPriceSource {
  return {
    kind: 'supplier-import',
    publicationId,
    supplier: evidence?.supplier ?? candidate.material.supplier ?? session.source.supplier,
    brand: evidence?.brand ?? candidate.material.brand ?? session.source.brand,
    sourceFileName: evidence?.sourceFileName ?? session.source.fileName,
    sourcePageSheet: evidence?.sourcePageSheet,
    sourceReference: evidence?.sourceReference,
    priceListLabel: evidence?.priceListLabel ?? session.source.priceListLabel,
    effectiveDate: evidence?.effectiveDate ?? session.source.effectiveDate,
    recordedAt,
    provenance,
    parserId: session.source.parserId,
    parserVersion: session.source.parserVersion,
  };
}

function historicalVersion(
  existing: MaterialPurchaseOption,
  idFactory: (prefix: string) => string,
  fallbackRecordedAt: string,
): MaterialPriceVersion {
  return {
    id: idFactory('price_version'),
    costPerSf: existing.costPerSf,
    costPerUnit: existing.costPerUnit,
    recordedAt: existing.source?.recordedAt ?? fallbackRecordedAt,
    effectiveDate: existing.source?.effectiveDate,
    source: existing.source,
  };
}

function mergePurchaseOption(
  existing: MaterialPurchaseOption | undefined,
  incoming: MaterialPurchaseOption,
  candidate: SupplierImportCandidate,
  session: SupplierImportSession,
  publicationId: string,
  recordedAt: string,
  idFactory: (prefix: string) => string,
) {
  const evidence = candidate.priceEvidence?.[incoming.id];
  const provenance: SupplierImportPriceProvenance = evidence?.effectiveCostPerSf
    ?? (incoming.costPerSf !== undefined ? 'supplier-listed' : 'derived-from-listed-unit');
  const source = sourceFor(session, candidate, evidence, publicationId, provenance, recordedAt);
  const changed = priceChanged(existing, incoming);

  return {
    ...(existing ?? incoming),
    id: existing?.id ?? incoming.id,
    label: incoming.label,
    active: existing?.active ?? incoming.active,
    default: existing?.default ?? incoming.default,
    minQuantity: incoming.minQuantity,
    pricingBasis: incoming.pricingBasis,
    costPerSf: incoming.costPerSf,
    costPerUnit: incoming.costPerUnit,
    notes: existing?.notes,
    supplierNotes: incoming.supplierNotes ?? incoming.notes,
    source,
    priceHistory: changed && existing
      ? [...(existing.priceHistory ?? []), historicalVersion(existing, idFactory, recordedAt)]
      : (existing?.priceHistory ?? []),
  } satisfies MaterialPurchaseOption;
}

function mergeVariant(
  existing: MaterialVariant | undefined,
  incoming: MaterialVariant,
  candidate: SupplierImportCandidate,
  session: SupplierImportSession,
  publicationId: string,
  recordedAt: string,
  idFactory: (prefix: string) => string,
) {
  const existingOptions = existing?.purchaseOptions ?? [];
  const mergedIncomingOptions = incoming.purchaseOptions.map((option) => {
    const oldOption = existingOptions.find((candidateOption) => optionIdentity(candidateOption) === optionIdentity(option));
    return mergePurchaseOption(oldOption, option, candidate, session, publicationId, recordedAt, idFactory);
  });
  const incomingOptionKeys = new Set(incoming.purchaseOptions.map(optionIdentity));
  const preservedOptions = existingOptions.filter((option) => !incomingOptionKeys.has(optionIdentity(option)));
  const purchaseOptions = [...mergedIncomingOptions, ...preservedOptions];

  if (existing?.purchaseOptions.some((option) => option.default)) {
    const defaultId = existing.purchaseOptions.find((option) => option.default)?.id;
    purchaseOptions.forEach((option) => { option.default = option.id === defaultId; });
  } else if (purchaseOptions.length && !purchaseOptions.some((option) => option.default)) {
    purchaseOptions[0] = { ...purchaseOptions[0], default: true };
  }

  return {
    ...(existing ?? incoming),
    id: existing?.id ?? incoming.id,
    active: existing?.active ?? incoming.active,
    default: existing?.default ?? incoming.default,
    sku: incoming.sku ?? existing?.sku,
    thickness: incoming.thickness,
    finish: incoming.finish,
    formatName: incoming.formatName,
    formatKind: incoming.formatKind,
    lengthIn: incoming.lengthIn,
    widthIn: incoming.widthIn,
    areaSf: incoming.areaSf,
    availability: incoming.availability ?? existing?.availability,
    availabilityNote: incoming.availabilityNote ?? existing?.availabilityNote,
    features: unionStrings(existing?.features, incoming.features),
    purchaseOptions,
    notes: existing?.notes ?? incoming.notes,
  } satisfies MaterialVariant;
}

function mergeMaterial(
  existing: StockMaterial | undefined,
  incoming: StockMaterial,
  candidate: SupplierImportCandidate,
  session: SupplierImportSession,
  publicationId: string,
  recordedAt: string,
  idFactory: (prefix: string) => string,
) {
  const existingVariants = existing?.variants ?? [];
  const mergedIncomingVariants = (incoming.variants ?? []).map((variant) => {
    const oldVariant = existingVariants.find((candidateVariant) => variantIdentity(candidateVariant) === variantIdentity(variant));
    return mergeVariant(oldVariant, variant, candidate, session, publicationId, recordedAt, idFactory);
  });
  const incomingVariantKeys = new Set((incoming.variants ?? []).map(variantIdentity));
  const preservedVariants = existingVariants.filter((variant) => !incomingVariantKeys.has(variantIdentity(variant)));
  const variants = [...mergedIncomingVariants, ...preservedVariants];

  if (existingVariants.some((variant) => variant.default)) {
    const defaultId = existingVariants.find((variant) => variant.default)?.id;
    variants.forEach((variant) => { variant.default = variant.id === defaultId; });
  } else if (variants.length && !variants.some((variant) => variant.default)) {
    variants[0] = { ...variants[0], default: true };
  }

  if (!existing) {
    return {
      ...incoming,
      id: idFactory('stock'),
      stockProgram: false,
      builderLevelId: undefined,
      slabImageUrl: undefined,
      closeUpImageUrl: undefined,
      productUrl: undefined,
      notes: incoming.notes,
      active: true,
      variants,
    } satisfies StockMaterial;
  }

  return {
    ...existing,
    name: incoming.name,
    supplier: incoming.supplier ?? existing.supplier,
    brand: incoming.brand ?? existing.brand,
    collection: incoming.collection ?? existing.collection,
    supplierGroup: incoming.supplierGroup ?? existing.supplierGroup,
    sku: incoming.sku ?? existing.sku,
    materialType: incoming.materialType,
    features: unionStrings(existing.features, incoming.features),
    variants,
    // Management-owned fields intentionally remain from the existing catalog.
    stockProgram: existing.stockProgram,
    builderLevelId: existing.builderLevelId,
    slabImageUrl: existing.slabImageUrl,
    closeUpImageUrl: existing.closeUpImageUrl,
    productUrl: existing.productUrl,
    notes: existing.notes,
    active: existing.active,
    internalCost: existing.internalCost,
    unit: existing.unit,
  } satisfies StockMaterial;
}

export function classifySupplierImportCandidates(session: SupplierImportSession) {
  const ready = session.candidates.filter((candidate) => candidate.reviewDecision === 'approved');
  const attention = session.candidates.filter((candidate) => candidate.reviewDecision === 'needs-review' || candidate.reviewDecision === 'pending' || !candidate.reviewDecision);
  const ignored = session.candidates.filter((candidate) => candidate.reviewDecision === 'ignored');
  return { ready, attention, ignored };
}

export function assertSupplierImportPublishable(session: SupplierImportSession) {
  if (session.publication) throw new Error('This staged supplier import has already been published.');
  const { ready, attention } = classifySupplierImportCandidates(session);
  if (attention.length) throw new Error(`Resolve the ${attention.length} item${attention.length === 1 ? '' : 's'} needing attention before publishing.`);
  if (!ready.length) throw new Error('There are no Ready records to publish.');
}

export function validateStagedAgainstCatalog(session: SupplierImportSession, catalog: StockMaterial[]) {
  session.candidates.forEach((candidate) => {
    if (candidate.reviewDecision === 'ignored') return;
    if (candidate.existingMaterialId) {
      if (!catalog.some((material) => material.id === candidate.existingMaterialId)) {
        throw new Error(`${candidate.material.name} no longer matches the Material Catalog record used during staging. Refresh Rates and stage the supplier sheet again.`);
      }
      return;
    }
    if (candidate.status !== 'new') return;

    const identityCollision = catalog.find((material) => materialIdentity(material) === materialIdentity(candidate.material));
    if (identityCollision) {
      throw new Error(`${candidate.material.brand || 'Unknown brand'} ${candidate.material.name} now matches an existing Material Catalog record by Brand / Type / Color. Refresh Rates and stage the supplier template again before publishing.`);
    }

    const incomingSkus = materialSkuSet(candidate.material);
    if (!incomingSkus.size) return;
    const collision = catalog.find((material) => {
      const existingSkus = materialSkuSet(material);
      return [...incomingSkus].some((sku) => existingSkus.has(sku));
    });
    if (collision) {
      throw new Error(`${candidate.material.name} now overlaps ${collision.name} by SKU. Refresh Rates and stage the supplier template again before publishing.`);
    }
  });
}

export function buildSupplierImportPublishPlan(
  session: SupplierImportSession,
  catalog: StockMaterial[],
  options: SupplierImportPublishPlanOptions,
): SupplierImportPublishPlan {
  assertSupplierImportPublishable(session);
  validateStagedAgainstCatalog(session, catalog);

  const { ready, ignored } = classifySupplierImportCandidates(session);
  const idFactory = options.idFactory ?? defaultIdFactory;
  let nextCatalog = [...catalog];
  const auditChanges: Array<Record<string, unknown>> = [];

  ready.forEach((candidate) => {
    const existing = candidate.existingMaterialId
      ? nextCatalog.find((material) => material.id === candidate.existingMaterialId)
      : undefined;
    const merged = mergeMaterial(
      existing,
      candidate.material,
      candidate,
      session,
      options.publicationId,
      options.publishedAt,
      idFactory,
    );

    if (existing) nextCatalog = nextCatalog.map((material) => material.id === existing.id ? merged : material);
    else nextCatalog.push(merged);

    auditChanges.push({
      candidateId: candidate.id,
      status: candidate.status,
      confidence: candidate.confidence,
      matchBasis: candidate.matchBasis ?? null,
      existingMaterialId: existing?.id ?? null,
      publishedMaterialId: merged.id,
      changeSummary: candidate.changeSummary,
      before: existing ?? null,
      after: merged,
    });
  });

  return {
    stockMaterials: nextCatalog,
    auditChanges,
    publishedCandidateIds: ready.map((candidate) => candidate.id),
    summary: {
      publishedCount: ready.length,
      newCount: ready.filter((candidate) => candidate.status === 'new').length,
      updatedCount: ready.filter((candidate) => candidate.status === 'changed').length,
      unchangedCount: ready.filter((candidate) => candidate.status === 'unchanged').length,
      ignoredCount: ignored.length,
    },
  };
}
