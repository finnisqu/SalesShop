import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type {
  MaterialPriceSource,
  MaterialPriceVersion,
  MaterialPurchaseOption,
  MaterialVariant,
  StockMaterial,
} from '../types/settings';
import type {
  SupplierImportCandidate,
  SupplierImportPriceProvenance,
  SupplierImportSession,
} from '../types/supplierImport';

export interface SupplierImportPublishSummary {
  publicationId: string;
  publishedAt: string;
  publishedCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  ignoredCount: number;
  stockMaterials: StockMaterial[];
}

export interface SupplierImportPublicationHistoryRow {
  id: string;
  supplier: string;
  brand?: string;
  sourceFileName: string;
  priceListLabel?: string;
  effectiveDate?: string;
  parserVersion: number;
  summary: {
    publishedCount?: number;
    newCount?: number;
    updatedCount?: number;
    unchangedCount?: number;
    ignoredCount?: number;
  };
  publishedAt: string;
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
  if (!existing) return true;
  return existing.costPerSf !== incoming.costPerSf
    || existing.costPerUnit !== incoming.costPerUnit
    || existing.pricingBasis !== incoming.pricingBasis
    || existing.minQuantity !== incoming.minQuantity;
}

function sourceFor(
  session: SupplierImportSession,
  publicationId: string,
  provenance: SupplierImportPriceProvenance,
  recordedAt: string,
): MaterialPriceSource {
  return {
    kind: 'supplier-import',
    publicationId,
    supplier: session.source.supplier,
    brand: session.source.brand,
    sourceFileName: session.source.fileName,
    priceListLabel: session.source.priceListLabel,
    effectiveDate: session.source.effectiveDate,
    recordedAt,
    provenance,
    parserId: session.source.parserId,
    parserVersion: session.source.parserVersion,
  };
}

function mergePurchaseOption(
  existing: MaterialPurchaseOption | undefined,
  incoming: MaterialPurchaseOption,
  candidate: SupplierImportCandidate,
  session: SupplierImportSession,
  publicationId: string,
  recordedAt: string,
) {
  const evidence = candidate.priceEvidence?.[incoming.id];
  const provenance: SupplierImportPriceProvenance = evidence?.effectiveCostPerSf
    ?? (incoming.costPerSf !== undefined ? 'supplier-listed' : 'derived-from-listed-unit');
  const source = sourceFor(session, publicationId, provenance, recordedAt);
  const changed = priceChanged(existing, incoming);
  const version: MaterialPriceVersion = {
    id: `price_version_${crypto.randomUUID()}`,
    costPerSf: incoming.costPerSf,
    costPerUnit: incoming.costPerUnit,
    recordedAt,
    effectiveDate: session.source.effectiveDate,
    source,
  };

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
    priceHistory: changed
      ? [...(existing?.priceHistory ?? []), version]
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
) {
  const existingOptions = existing?.purchaseOptions ?? [];
  const mergedIncomingOptions = incoming.purchaseOptions.map((option) => {
    const oldOption = existingOptions.find((candidateOption) => optionIdentity(candidateOption) === optionIdentity(option));
    return mergePurchaseOption(oldOption, option, candidate, session, publicationId, recordedAt);
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
    notes: existing?.notes,
  } satisfies MaterialVariant;
}

function mergeMaterial(
  existing: StockMaterial | undefined,
  incoming: StockMaterial,
  candidate: SupplierImportCandidate,
  session: SupplierImportSession,
  publicationId: string,
  recordedAt: string,
) {
  const existingVariants = existing?.variants ?? [];
  const mergedIncomingVariants = (incoming.variants ?? []).map((variant) => {
    const oldVariant = existingVariants.find((candidateVariant) => variantIdentity(candidateVariant) === variantIdentity(variant));
    return mergeVariant(oldVariant, variant, candidate, session, publicationId, recordedAt);
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
      id: `stock_${crypto.randomUUID()}`,
      stockProgram: false,
      builderLevelId: undefined,
      slabImageUrl: undefined,
      closeUpImageUrl: undefined,
      productUrl: undefined,
      notes: undefined,
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
    // Management-owned fields intentionally remain from the existing catalog:
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

function validateStagedAgainstCatalog(session: SupplierImportSession, catalog: StockMaterial[]) {
  session.candidates.forEach((candidate) => {
    if (candidate.reviewDecision === 'ignored') return;
    if (candidate.existingMaterialId) {
      if (!catalog.some((material) => material.id === candidate.existingMaterialId)) {
        throw new Error(`${candidate.material.name} no longer matches the Material Catalog record used during staging. Refresh Rates and stage the supplier sheet again.`);
      }
      return;
    }
    if (candidate.status !== 'new') return;

    const incomingSkus = materialSkuSet(candidate.material);
    if (!incomingSkus.size) return;
    const collision = catalog.find((material) => {
      const existingSkus = materialSkuSet(material);
      return [...incomingSkus].some((sku) => existingSkus.has(sku));
    });
    if (collision) {
      throw new Error(`${candidate.material.name} now overlaps ${collision.name} by SKU. Refresh Rates and stage the supplier sheet again before publishing.`);
    }
  });
}

export async function publishSupplierImport(session: SupplierImportSession): Promise<SupplierImportPublishSummary> {
  if (!supabase) throw new Error('Cloud publishing is unavailable.');
  const auth = useAuthStore.getState();
  if (auth.mode !== 'cloud' || !auth.organizationId || !auth.user) {
    throw new Error('Sign in to the cloud workspace before publishing supplier pricing.');
  }
  if (session.publication) throw new Error('This staged supplier import has already been published.');

  const ready = session.candidates.filter((candidate) => candidate.reviewDecision !== 'ignored' && candidate.reviewDecision !== 'needs-review' && candidate.reviewDecision !== 'pending');
  const attention = session.candidates.filter((candidate) => candidate.reviewDecision === 'needs-review' || candidate.reviewDecision === 'pending');
  const ignored = session.candidates.filter((candidate) => candidate.reviewDecision === 'ignored');

  if (attention.length) throw new Error(`Resolve the ${attention.length} item${attention.length === 1 ? '' : 's'} needing attention before publishing.`);
  if (!ready.length) throw new Error('There are no Ready records to publish.');

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('stock_materials')
    .eq('id', auth.organizationId)
    .single();
  if (orgError || !org) throw new Error(orgError?.message ?? 'Could not refresh the Material Catalog.');

  const cloudCatalog = Array.isArray(org.stock_materials) ? org.stock_materials as unknown as StockMaterial[] : [];
  validateStagedAgainstCatalog(session, cloudCatalog);

  const publicationId = crypto.randomUUID();
  const publishedAt = new Date().toISOString();
  let nextCatalog = [...cloudCatalog];
  const auditChanges: Array<Record<string, unknown>> = [];

  ready.forEach((candidate) => {
    const existing = candidate.existingMaterialId
      ? nextCatalog.find((material) => material.id === candidate.existingMaterialId)
      : undefined;
    const merged = mergeMaterial(existing, candidate.material, candidate, session, publicationId, publishedAt);

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

  const summary = {
    publishedCount: ready.length,
    newCount: ready.filter((candidate) => candidate.status === 'new').length,
    updatedCount: ready.filter((candidate) => candidate.status === 'changed').length,
    unchangedCount: ready.filter((candidate) => candidate.status === 'unchanged').length,
    ignoredCount: ignored.length,
  };

  const { data: rpcResult, error } = await supabase.rpc('publish_supplier_import', {
    p_publication_id: publicationId,
    p_organization_id: auth.organizationId,
    p_source_session_id: session.id,
    p_expected_stock_materials: cloudCatalog,
    p_updated_stock_materials: nextCatalog,
    p_source: session.source,
    p_summary: summary,
    p_changes: auditChanges,
    p_published_candidate_ids: ready.map((candidate) => candidate.id),
  });

  if (error) throw new Error(error.message);
  if (rpcResult && String(rpcResult) !== publicationId) {
    throw new Error('Supplier import publication returned an unexpected audit ID.');
  }

  return {
    publicationId,
    publishedAt,
    ...summary,
    stockMaterials: nextCatalog,
  };
}

export async function fetchSupplierImportPublicationHistory(limit = 8): Promise<SupplierImportPublicationHistoryRow[]> {
  if (!supabase) return [];
  const auth = useAuthStore.getState();
  if (auth.mode !== 'cloud' || !auth.organizationId) return [];

  const { data, error } = await supabase
    .from('supplier_import_publications')
    .select('id,supplier,brand,source_file_name,price_list_label,effective_date,parser_version,summary,published_at')
    .eq('organization_id', auth.organizationId)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    supplier: String(row.supplier ?? ''),
    brand: row.brand ? String(row.brand) : undefined,
    sourceFileName: String(row.source_file_name ?? ''),
    priceListLabel: row.price_list_label ? String(row.price_list_label) : undefined,
    effectiveDate: row.effective_date ? String(row.effective_date) : undefined,
    parserVersion: Number(row.parser_version ?? 1),
    summary: (row.summary && typeof row.summary === 'object' ? row.summary : {}) as SupplierImportPublicationHistoryRow['summary'],
    publishedAt: String(row.published_at),
  }));
}
