export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';
export function roleName(role: TeamRole) {
  return role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : role === 'viewer' ? 'Viewer' : 'Member';
}
/** UI guidance only. All mutations must independently pass database authorization. */
export function canManageTeamMember(actor: TeamRole | null, target: TeamRole, isSelf: boolean): boolean {
  if (isSelf || target === 'owner') return false;
  return actor === 'owner' || (actor === 'admin' && (target === 'member' || target === 'viewer'));
}
export function allowedInviteRoles(actor: TeamRole | null): Array<'viewer' | 'member' | 'admin'> {
  return actor === 'owner' ? ['member','viewer','admin'] : actor === 'admin' ? ['member','viewer'] : [];
}
/** Write access must also be checked by Supabase RLS; this is only UI guidance. */
export function canEditSharedData(role: TeamRole | null) {
  return role === 'owner' || role === 'admin' || role === 'member';
}
export function canManageTeam(role: TeamRole | null) {
  return role === 'owner' || role === 'admin';
}
export const TEAM_ROLE_HELP: Record<TeamRole, string> = {
  owner: 'Full access, including administrators and company settings.',
  admin: 'Manage members, invitations and company settings; edit shared records.',
  member: 'Create and edit shared quotes, customers and projects.',
  viewer: 'Read shared records, without changing company data.',
};
export type TeamInvitationRow = {
  id: string;
  email: string;
  role: 'viewer'|'member'|'admin';
  created_at: string;
  expires_at: string;
  accepted_at: string|null;
  revoked_at: string|null;
  status: 'pending'|'accepted'|'revoked'|'expired';
};

/** Never import local CRM/quotes into a workspace joined as a team member. */
export function maySeedCompanyFromLocal(role: TeamRole, acceptedInvitation: boolean): boolean {
  return role === 'owner' && !acceptedInvitation;
}
