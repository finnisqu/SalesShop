import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { SupplierContact, SupplierLocation, SupplierRule } from '../types/supplier';

function context() {
  const auth = useAuthStore.getState();
  if (!supabase || auth.mode !== 'cloud' || !auth.organizationId) return null;
  return { organizationId: auth.organizationId };
}

function contactFromRow(row: Record<string, unknown>): SupplierContact {
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    name: String(row.name ?? ''),
    title: row.title ? String(row.title) : undefined,
    email: row.email ? String(row.email) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    isPrimary: row.is_primary === true,
    notes: String(row.notes ?? ''),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function locationFromRow(row: Record<string, unknown>): SupplierLocation {
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    label: String(row.label ?? 'Warehouse'),
    addressLine1: String(row.address_line_1 ?? ''),
    addressLine2: row.address_line_2 ? String(row.address_line_2) : undefined,
    city: row.city ? String(row.city) : undefined,
    stateRegion: row.state_region ? String(row.state_region) : undefined,
    postalCode: row.postal_code ? String(row.postal_code) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    notes: String(row.notes ?? ''),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function ruleFromRow(row: Record<string, unknown>): SupplierRule {
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    ruleType: String(row.rule_type ?? 'General'),
    ruleText: String(row.rule_text ?? ''),
    sourceLabel: row.source_label ? String(row.source_label) : undefined,
    active: row.active !== false,
    notes: String(row.notes ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

const CONTACT_SELECT = 'id,supplier_id,name,title,email,phone,is_primary,notes,created_at,updated_at';
const LOCATION_SELECT = 'id,supplier_id,label,address_line_1,address_line_2,city,state_region,postal_code,phone,notes,created_at,updated_at';
const RULE_SELECT = 'id,supplier_id,rule_type,rule_text,source_label,active,notes,sort_order,created_at,updated_at';

export async function fetchSupplierContacts(): Promise<SupplierContact[]> {
  const c = context(); if (!c) return [];
  const { data, error } = await supabase!.from('supplier_contacts').select(CONTACT_SELECT)
    .eq('organization_id', c.organizationId).order('is_primary', { ascending: false }).order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => contactFromRow(row as Record<string, unknown>));
}

export async function saveSupplierContact(input: Omit<SupplierContact, 'createdAt' | 'updatedAt'>): Promise<SupplierContact> {
  const c = context(); if (!c) throw new Error('Sign in to manage supplier contacts.');
  if (!input.name.trim()) throw new Error('Contact name is required.');
  if (input.isPrimary) {
    const { error: resetError } = await supabase!.from('supplier_contacts')
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('organization_id', c.organizationId).eq('supplier_id', input.supplierId).neq('id', input.id);
    if (resetError) throw new Error(resetError.message);
  }
  const { data, error } = await supabase!.from('supplier_contacts').upsert({
    organization_id: c.organizationId,
    id: input.id,
    supplier_id: input.supplierId,
    name: input.name.trim(),
    title: input.title?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    is_primary: input.isPrimary,
    notes: input.notes.trim(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,id' }).select(CONTACT_SELECT).single();
  if (error) throw new Error(error.message);
  return contactFromRow(data as Record<string, unknown>);
}

export async function deleteSupplierContact(id: string) {
  const c = context(); if (!c) throw new Error('Sign in to manage supplier contacts.');
  const { error } = await supabase!.from('supplier_contacts').delete().eq('organization_id', c.organizationId).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchSupplierLocations(): Promise<SupplierLocation[]> {
  const c = context(); if (!c) return [];
  const { data, error } = await supabase!.from('supplier_locations').select(LOCATION_SELECT)
    .eq('organization_id', c.organizationId).order('label');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => locationFromRow(row as Record<string, unknown>));
}

export async function saveSupplierLocation(input: Omit<SupplierLocation, 'createdAt' | 'updatedAt'>): Promise<SupplierLocation> {
  const c = context(); if (!c) throw new Error('Sign in to manage supplier locations.');
  if (!input.addressLine1.trim()) throw new Error('Street address is required.');
  const { data, error } = await supabase!.from('supplier_locations').upsert({
    organization_id: c.organizationId,
    id: input.id,
    supplier_id: input.supplierId,
    label: input.label.trim() || 'Warehouse',
    address_line_1: input.addressLine1.trim(),
    address_line_2: input.addressLine2?.trim() || null,
    city: input.city?.trim() || null,
    state_region: input.stateRegion?.trim() || null,
    postal_code: input.postalCode?.trim() || null,
    phone: input.phone?.trim() || null,
    notes: input.notes.trim(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,id' }).select(LOCATION_SELECT).single();
  if (error) throw new Error(error.message);
  return locationFromRow(data as Record<string, unknown>);
}

export async function deleteSupplierLocation(id: string) {
  const c = context(); if (!c) throw new Error('Sign in to manage supplier locations.');
  const { error } = await supabase!.from('supplier_locations').delete().eq('organization_id', c.organizationId).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchSupplierRules(): Promise<SupplierRule[]> {
  const c = context(); if (!c) return [];
  const { data, error } = await supabase!.from('supplier_rules').select(RULE_SELECT)
    .eq('organization_id', c.organizationId).order('sort_order').order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ruleFromRow(row as Record<string, unknown>));
}

export async function saveSupplierRule(input: Omit<SupplierRule, 'createdAt' | 'updatedAt'>): Promise<SupplierRule> {
  const c = context(); if (!c) throw new Error('Sign in to manage supplier rules.');
  if (!input.ruleText.trim()) throw new Error('Rule text is required.');
  const { data, error } = await supabase!.from('supplier_rules').upsert({
    organization_id: c.organizationId,
    id: input.id,
    supplier_id: input.supplierId,
    rule_type: input.ruleType.trim() || 'General',
    rule_text: input.ruleText.trim(),
    source_label: input.sourceLabel?.trim() || null,
    active: input.active,
    notes: input.notes.trim(),
    sort_order: input.sortOrder,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,id' }).select(RULE_SELECT).single();
  if (error) throw new Error(error.message);
  return ruleFromRow(data as Record<string, unknown>);
}

export async function deleteSupplierRule(id: string) {
  const c = context(); if (!c) throw new Error('Sign in to manage supplier rules.');
  const { error } = await supabase!.from('supplier_rules').delete().eq('organization_id', c.organizationId).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function createRulesFromPublished(supplierId: string, sourceLabel: string, rules: string[]): Promise<SupplierRule[]> {
  const c = context(); if (!c) throw new Error('Sign in to manage supplier rules.');
  if (!rules.length) return [];
  const rows = rules.map((rule, index) => ({
    organization_id: c.organizationId,
    id: `supplier_rule_${crypto.randomUUID()}`,
    supplier_id: supplierId,
    rule_type: 'Published pricing rule',
    rule_text: rule.trim(),
    source_label: sourceLabel,
    active: true,
    notes: '',
    sort_order: index,
    updated_at: new Date().toISOString(),
  })).filter((row) => row.rule_text);
  const { data, error } = await supabase!.from('supplier_rules').insert(rows).select(RULE_SELECT);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ruleFromRow(row as Record<string, unknown>));
}

export async function mergeSupplierProfiles(sourceId: string, targetId: string) {
  const c = context(); if (!c) throw new Error('Sign in to merge suppliers.');
  const { error } = await supabase!.rpc('merge_supplier_profiles', {
    p_organization_id: c.organizationId,
    p_source_id: sourceId,
    p_target_id: targetId,
  });
  if (error) throw new Error(error.message);
}
