export type TeamRole = 'owner' | 'admin' | 'member';
export function roleName(role: TeamRole) {
  return role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Member';
}
/** UI guidance only. All mutations must independently pass database authorization. */
export function canManageTeamMember(actor: TeamRole | null, target: TeamRole, isSelf: boolean): boolean {
  if (isSelf || target === 'owner') return false;
  return actor === 'owner' || (actor === 'admin' && target === 'member');
}
export function allowedInviteRoles(actor: TeamRole | null): Array<'member' | 'admin'> {
  return actor === 'owner' ? ['member','admin'] : actor === 'admin' ? ['member'] : [];
}
export type TeamInvitationRow = {
  id: string;
  email: string;
  role: 'member'|'admin';
  created_at: string;
  expires_at: string;
  accepted_at: string|null;
  revoked_at: string|null;
  status: 'pending'|'accepted'|'revoked'|'expired';
};
