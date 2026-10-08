import { supabase } from '../lib/supabase';

export type TeamInvitePreview = {
  organizationName: string;
  role: 'member' | 'admin';
  emailHint: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  currentAccountMatches: boolean | null;
};

type InvitePreviewRow = {
  organization_name: string;
  invite_role: 'member' | 'admin';
  invited_email_hint: string;
  expires_at: string;
  invitation_status: TeamInvitePreview['status'];
  current_account_matches: boolean | null;
};

/** Read-only preview. Supabase validates the token hash; no account or shop is created. */
export async function previewTeamInvite(token: string): Promise<TeamInvitePreview | null> {
  if (!supabase || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data, error } = await supabase.rpc('preview_team_invite', { invite_token: token });
  if (error) throw error;
  const row = (data as InvitePreviewRow[] | null)?.[0];
  if (!row) return null;
  return {
    organizationName: row.organization_name,
    role: row.invite_role,
    emailHint: row.invited_email_hint,
    expiresAt: row.expires_at,
    status: row.invitation_status,
    currentAccountMatches: row.current_account_matches,
  };
}

export function inviteAccountDecision(preview: TeamInvitePreview | null, signedIn: boolean) {
  if (!preview || preview.status !== 'pending') return 'unavailable' as const;
  if (signedIn && preview.currentAccountMatches !== true) return 'switch-account' as const;
  return 'continue' as const;
}
