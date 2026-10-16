import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type {
  SupplierActivity,
  SupplierActivityType,
  SupplierCommitment,
  SupplierCommitmentKind,
  SupplierCommitmentStatus,
} from '../types/supplier';

function cloudContext() {
  const auth = useAuthStore.getState();
  if (!supabase || auth.mode !== 'cloud' || !auth.organizationId || !auth.user) return null;
  return { organizationId: auth.organizationId, userId: auth.user.id };
}

function rowToActivity(row: Record<string, unknown>): SupplierActivity {
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    activityType: String(row.activity_type) as SupplierActivityType,
    occurredAt: String(row.occurred_at),
    summary: String(row.summary ?? ''),
    details: String(row.details ?? ''),
    contactName: row.contact_name ? String(row.contact_name) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function rowToCommitment(row: Record<string, unknown>): SupplierCommitment {
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    title: String(row.title ?? ''),
    kind: String(row.commitment_kind) as SupplierCommitmentKind,
    amount: row.amount == null ? undefined : Number(row.amount),
    unit: row.unit ? String(row.unit) : undefined,
    conditionText: String(row.condition_text ?? ''),
    targetValue: row.target_value == null ? undefined : Number(row.target_value),
    targetUnit: row.target_unit ? String(row.target_unit) : undefined,
    deadline: row.deadline ? String(row.deadline) : undefined,
    status: String(row.status) as SupplierCommitmentStatus,
    notes: String(row.notes ?? ''),
    sourceActivityId: row.source_activity_id ? String(row.source_activity_id) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

const ACTIVITY_SELECT = 'id,supplier_id,activity_type,occurred_at,summary,details,contact_name,created_at';
const COMMITMENT_SELECT = 'id,supplier_id,title,commitment_kind,amount,unit,condition_text,target_value,target_unit,deadline,status,notes,source_activity_id,created_at,updated_at';

export async function fetchSupplierActivities(): Promise<SupplierActivity[]> {
  const context = cloudContext();
  if (!context) return [];
  const { data, error } = await supabase!
    .from('supplier_activities')
    .select(ACTIVITY_SELECT)
    .eq('organization_id', context.organizationId)
    .order('occurred_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToActivity(row as Record<string, unknown>));
}

export async function createSupplierActivity(input: {
  supplierId: string;
  activityType: SupplierActivityType;
  occurredAt: string;
  summary: string;
  details?: string;
  contactName?: string;
}): Promise<SupplierActivity> {
  const context = cloudContext();
  if (!context) throw new Error('Sign in to the cloud workspace before logging supplier activity.');
  const summary = input.summary.trim();
  if (!summary) throw new Error('Activity summary is required.');

  const { data, error } = await supabase!
    .from('supplier_activities')
    .insert({
      organization_id: context.organizationId,
      id: `supplier_activity_${crypto.randomUUID()}`,
      supplier_id: input.supplierId,
      activity_type: input.activityType,
      occurred_at: input.occurredAt,
      summary,
      details: input.details?.trim() ?? '',
      contact_name: input.contactName?.trim() || null,
      created_by: context.userId,
    })
    .select(ACTIVITY_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return rowToActivity(data as Record<string, unknown>);
}

export async function fetchSupplierCommitments(): Promise<SupplierCommitment[]> {
  const context = cloudContext();
  if (!context) return [];
  const { data, error } = await supabase!
    .from('supplier_commitments')
    .select(COMMITMENT_SELECT)
    .eq('organization_id', context.organizationId)
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToCommitment(row as Record<string, unknown>));
}

export async function createSupplierCommitment(input: {
  supplierId: string;
  title: string;
  kind: SupplierCommitmentKind;
  amount?: number;
  unit?: string;
  conditionText?: string;
  targetValue?: number;
  targetUnit?: string;
  deadline?: string;
  status?: SupplierCommitmentStatus;
  notes?: string;
  sourceActivityId?: string;
}): Promise<SupplierCommitment> {
  const context = cloudContext();
  if (!context) throw new Error('Sign in to the cloud workspace before adding supplier commitments.');
  const title = input.title.trim();
  if (!title) throw new Error('Commitment title is required.');

  const { data, error } = await supabase!
    .from('supplier_commitments')
    .insert({
      organization_id: context.organizationId,
      id: `supplier_commitment_${crypto.randomUUID()}`,
      supplier_id: input.supplierId,
      title,
      commitment_kind: input.kind,
      amount: input.amount ?? null,
      unit: input.unit?.trim() || null,
      condition_text: input.conditionText?.trim() ?? '',
      target_value: input.targetValue ?? null,
      target_unit: input.targetUnit?.trim() || null,
      deadline: input.deadline || null,
      status: input.status ?? 'negotiating',
      notes: input.notes?.trim() ?? '',
      source_activity_id: input.sourceActivityId || null,
      created_by: context.userId,
      updated_at: new Date().toISOString(),
    })
    .select(COMMITMENT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return rowToCommitment(data as Record<string, unknown>);
}

export async function updateSupplierCommitment(
  commitment: SupplierCommitment,
  patch: Partial<Pick<SupplierCommitment,
    'title' | 'kind' | 'amount' | 'unit' | 'conditionText' | 'targetValue' | 'targetUnit' | 'deadline' | 'status' | 'notes' | 'sourceActivityId'
  >>,
): Promise<SupplierCommitment> {
  const context = cloudContext();
  if (!context) throw new Error('Sign in to the cloud workspace before editing supplier commitments.');
  const next = { ...commitment, ...patch };
  const { data, error } = await supabase!
    .from('supplier_commitments')
    .update({
      title: next.title.trim(),
      commitment_kind: next.kind,
      amount: next.amount ?? null,
      unit: next.unit?.trim() || null,
      condition_text: next.conditionText.trim(),
      target_value: next.targetValue ?? null,
      target_unit: next.targetUnit?.trim() || null,
      deadline: next.deadline || null,
      status: next.status,
      notes: next.notes.trim(),
      source_activity_id: next.sourceActivityId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', context.organizationId)
    .eq('id', commitment.id)
    .select(COMMITMENT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return rowToCommitment(data as Record<string, unknown>);
}
