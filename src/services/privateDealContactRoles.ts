import { supabase } from '../lib/supabase';
import type { Quote } from '../types/quote';

export const PRIVATE_DEAL_CONTACT_ROLES = [
  'Estimator','Buyer','Decision maker','Project manager','Other',
] as const;
export type PrivateDealContactRole = typeof PRIVATE_DEAL_CONTACT_ROLES[number];
export type PrivateDealRoleRow = { contactId: string; role: PrivateDealContactRole };

export function ownedQuoteContactIds(
  dealId: string, ownerId: string | null | undefined, quotes: readonly Quote[],
): string[] {
  if (!ownerId) return [];
  return [...new Set(quotes.filter(q => q.projectId === dealId &&
    q.ownerUserId === ownerId && !q.archivedAt && !!q.contactId)
    .map(q => q.contactId as string))];
}
export function isPrivateDealRole(value: string): value is PrivateDealContactRole {
  return (PRIVATE_DEAL_CONTACT_ROLES as readonly string[]).includes(value);
}

type RoleScope = { organizationId: string; dealId: string; ownerId: string };
export async function loadPrivateDealRoles(scope: RoleScope): Promise<PrivateDealRoleRow[]> {
  if (!supabase) throw new Error('Private Deal role storage is unavailable.');
  const { data, error } = await supabase.from('deal_contact_roles')
    .select('contact_id,role')
    .eq('organization_id',scope.organizationId)
    .eq('deal_id',scope.dealId)
    .eq('owner_user_id',scope.ownerId);
  if (error) throw error;
  return (data ?? []).filter(row => typeof row.contact_id === 'string' &&
    typeof row.role === 'string' && isPrivateDealRole(row.role))
    .map(row => ({contactId:row.contact_id as string,role:row.role as PrivateDealContactRole}));
}
export async function writePrivateDealRole(
  scope: RoleScope, contactId: string, role: PrivateDealContactRole | null,
): Promise<void> {
  if (!supabase) throw new Error('Private Deal role storage is unavailable.');
  if (role) {
    const {error} = await supabase.from('deal_contact_roles').upsert({
      organization_id:scope.organizationId,
      deal_id:scope.dealId,contact_id:contactId,
      owner_user_id:scope.ownerId,role,updated_at:new Date().toISOString(),
    },{onConflict:'organization_id,deal_id,contact_id,owner_user_id'});
    if(error)throw error;
  } else {
    const {error} = await supabase.from('deal_contact_roles').delete()
      .eq('organization_id',scope.organizationId)
      .eq('deal_id',scope.dealId)
      .eq('contact_id',contactId)
      .eq('owner_user_id',scope.ownerId);
    if(error)throw error;
  }
}
