import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { StockMaterial } from '../types/settings';
import type { SupplierImportSession } from '../types/supplierImport';
import {
  assertSupplierImportPublishable,
  buildSupplierImportPublishPlan,
} from './supplierImportCatalog';

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

export async function publishSupplierImport(session: SupplierImportSession): Promise<SupplierImportPublishSummary> {
  if (!supabase) throw new Error('Cloud publishing is unavailable.');
  const auth = useAuthStore.getState();
  if (auth.mode !== 'cloud' || !auth.organizationId || !auth.user) {
    throw new Error('Sign in to the cloud workspace before publishing supplier pricing.');
  }

  assertSupplierImportPublishable(session);

  const { data: existingPublication, error: existingPublicationError } = await supabase
    .from('supplier_import_publications')
    .select('id,published_at,summary')
    .eq('organization_id', auth.organizationId)
    .eq('source_session_id', session.id)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPublicationError) throw new Error(existingPublicationError.message);

  if (existingPublication) {
    const { data: publishedOrg, error: publishedOrgError } = await supabase
      .from('organizations')
      .select('stock_materials')
      .eq('id', auth.organizationId)
      .single();
    if (publishedOrgError || !publishedOrg) {
      throw new Error(publishedOrgError?.message ?? 'Could not refresh the published Material Catalog.');
    }
    const summary = (existingPublication.summary && typeof existingPublication.summary === 'object'
      ? existingPublication.summary
      : {}) as SupplierImportPublicationHistoryRow['summary'];
    return {
      publicationId: String(existingPublication.id),
      publishedAt: String(existingPublication.published_at),
      publishedCount: Number(summary.publishedCount ?? 0),
      newCount: Number(summary.newCount ?? 0),
      updatedCount: Number(summary.updatedCount ?? 0),
      unchangedCount: Number(summary.unchangedCount ?? 0),
      ignoredCount: Number(summary.ignoredCount ?? 0),
      stockMaterials: Array.isArray(publishedOrg.stock_materials)
        ? publishedOrg.stock_materials as unknown as StockMaterial[]
        : [],
    };
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('stock_materials')
    .eq('id', auth.organizationId)
    .single();
  if (orgError || !org) throw new Error(orgError?.message ?? 'Could not refresh the Material Catalog.');

  const cloudCatalog = Array.isArray(org.stock_materials) ? org.stock_materials as unknown as StockMaterial[] : [];
  const publicationId = crypto.randomUUID();
  const publishedAt = new Date().toISOString();
  const plan = buildSupplierImportPublishPlan(session, cloudCatalog, { publicationId, publishedAt });

  const { data: rpcResult, error } = await supabase.rpc('publish_supplier_import', {
    p_publication_id: publicationId,
    p_organization_id: auth.organizationId,
    p_source_session_id: session.id,
    p_expected_stock_materials: cloudCatalog,
    p_updated_stock_materials: plan.stockMaterials,
    p_source: session.source,
    p_summary: plan.summary,
    p_changes: plan.auditChanges,
    p_published_candidate_ids: plan.publishedCandidateIds,
  });

  if (error) throw new Error(error.message);
  if (rpcResult && String(rpcResult) !== publicationId) {
    throw new Error('Supplier import publication returned an unexpected audit ID.');
  }

  return {
    publicationId,
    publishedAt,
    ...plan.summary,
    stockMaterials: plan.stockMaterials,
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
