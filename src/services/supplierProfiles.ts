import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { SupplierProfile, SupplierProfilePatch } from '../types/supplier';

function rowToSupplier(row: Record<string, unknown>): SupplierProfile {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    active: row.active !== false,
    phone: row.phone ? String(row.phone) : undefined,
    website: row.website ? String(row.website) : undefined,
    pricingCadenceMonths: typeof row.pricing_cadence_months === 'number'
      ? row.pricing_cadence_months
      : row.pricing_cadence_months == null
        ? undefined
        : Number(row.pricing_cadence_months),
    nextPricingReviewDate: row.next_pricing_review_date ? String(row.next_pricing_review_date) : undefined,
    notes: String(row.notes ?? ''),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function cloudContext() {
  const auth = useAuthStore.getState();
  if (!supabase || auth.mode !== 'cloud' || !auth.organizationId) return null;
  return { auth, organizationId: auth.organizationId };
}

export async function fetchSupplierProfiles(): Promise<SupplierProfile[]> {
  const context = cloudContext();
  if (!context) return [];
  const { data, error } = await supabase!
    .from('suppliers')
    .select('id,name,active,phone,website,pricing_cadence_months,next_pricing_review_date,notes,created_at,updated_at')
    .eq('organization_id', context.organizationId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToSupplier(row as Record<string, unknown>));
}

export async function createSupplierProfile(name: string): Promise<SupplierProfile> {
  const context = cloudContext();
  if (!context) throw new Error('Sign in to the cloud workspace before adding suppliers.');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Supplier name is required.');
  const row = {
    organization_id: context.organizationId,
    id: `supplier_${crypto.randomUUID()}`,
    name: trimmed,
    active: true,
    phone: null,
    website: null,
    pricing_cadence_months: 12,
    notes: '',
  };
  const { data, error } = await supabase!
    .from('suppliers')
    .insert(row)
    .select('id,name,active,phone,website,pricing_cadence_months,next_pricing_review_date,notes,created_at,updated_at')
    .single();
  if (error) throw new Error(error.message);
  return rowToSupplier(data as Record<string, unknown>);
}

export async function upsertSupplierProfile(
  supplier: SupplierProfile,
  patch: SupplierProfilePatch,
): Promise<SupplierProfile> {
  const context = cloudContext();
  if (!context) throw new Error('Sign in to the cloud workspace before editing suppliers.');
  const next = { ...supplier, ...patch };
  const { data, error } = await supabase!
    .from('suppliers')
    .upsert({
      organization_id: context.organizationId,
      id: supplier.id,
      name: next.name.trim(),
      active: next.active,
      phone: next.phone?.trim() || null,
      website: next.website?.trim() || null,
      pricing_cadence_months: next.pricingCadenceMonths ?? null,
      next_pricing_review_date: next.nextPricingReviewDate || null,
      notes: next.notes,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,id' })
    .select('id,name,active,phone,website,pricing_cadence_months,next_pricing_review_date,notes,created_at,updated_at')
    .single();
  if (error) throw new Error(error.message);
  return rowToSupplier(data as Record<string, unknown>);
}

export async function trackDiscoveredSupplier(name: string): Promise<SupplierProfile> {
  const existing = (await fetchSupplierProfiles()).find((supplier) => supplier.name.trim().toLowerCase() === name.trim().toLowerCase());
  return existing ?? createSupplierProfile(name);
}
