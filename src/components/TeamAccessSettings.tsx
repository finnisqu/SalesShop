import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { allowedInviteRoles, canManageTeamMember, roleName, type TeamRole, type TeamInvitationRow } from '../services/teamAccess';
import { teamInviteUrl } from '../services/teamInvitationLink';
import { useAuthStore } from '../store/authStore';

type MemberRow = { user_id: string; role: TeamRole; created_at: string };
type MemberInfo = MemberRow & { displayName?: string };

function day(value: string) {
  const time = new Date(value);
  return Number.isFinite(time.getTime())
    ? time.toLocaleDateString(undefined, { month:'short',day:'numeric',year:'numeric' })
    : '—';
}

export function TeamAccessSettings() {
  const user = useAuthStore((state) => state.user);
  const orgId = useAuthStore((state) => state.organizationId);
  const mode = useAuthStore((state) => state.mode);
  const cloudReady = mode === 'cloud' && Boolean(user && orgId && supabase);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member'|'admin'>('member');
  const [newInviteLink, setNewInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const myRole = members.find((member) => member.user_id === user?.id)?.role ?? null;
  const inviteRoles = allowedInviteRoles(myRole);
  const isAdmin = Boolean(inviteRoles.length);

  const refresh = useCallback(async () => {
    if (!orgId || !supabase) return;
    setLoading(true);
    const { data: roster, error: membershipError } = await supabase
      .from('organization_members').select('user_id,role,created_at')
      .eq('organization_id', orgId).order('created_at');
    if (membershipError) { setError(membershipError.message); setLoading(false); return; }
    const rows = (roster ?? []) as MemberRow[];
    const { data: profiles, error: profilesError } = rows.length
      ? await supabase.from('profiles').select('user_id,display_name').in('user_id',rows.map((row) => row.user_id))
      : { data: [], error: null };
    const names = new Map((profiles ?? []).map((p) => [String(p.user_id),String(p.display_name ?? '')]));
    const current = rows.find((row) => row.user_id === user?.id)?.role;
    if (current === 'owner' || current === 'admin') {
      const { data: invites, error: invitesError } = await supabase.rpc('list_team_invites',{target_organization:orgId});
      if (invitesError) setError(invitesError.message);
      setInvitations((invites ?? []) as TeamInvitationRow[]);
    } else setInvitations([]);
    setMembers(rows.map((row) => ({
      ...row,
      displayName:names.get(row.user_id) || (row.user_id === user?.id ? String(user?.user_metadata?.display_name ?? '') : '') || undefined,
    })));
    if (profilesError) setNotice('Some teammate names are not available yet.');
    setLoading(false);
  },[orgId,user?.id,user?.user_metadata?.display_name]);

  useEffect(() => {
    if (cloudReady) void refresh();
    else setLoading(false);
  },[cloudReady,refresh]);

  const createInvite = async (event?: FormEvent, sendEmail = true) => {
    event?.preventDefault();
    if (!supabase || !orgId || !isAdmin || busy || !email.trim()) return;
    setBusy(true); setError(''); setNotice(''); setNewInviteLink('');
    try {
      if (sendEmail) {
        const { data, error: emailError } = await supabase.functions.invoke('team-invite-email', {
          body: { organizationId: orgId, email: email.trim(), role: inviteRole },
        });
        if (emailError) {
          const context = emailError.context;
          const details = context instanceof Response
            ? await context.json().catch(() => ({})) as { error?: string } : {};
          setError(details.error || emailError.message);
        } else {
          const result = data as { sent?: boolean; invitationUrl?: string; error?: string; email?: string } | null;
          if (result?.sent) {
            setEmail('');
            setNotice(`Invitation email sent to ${result.email || 'your teammate'}. The link expires in seven days.`);
          } else if (result?.invitationUrl) {
            setNewInviteLink(result.invitationUrl);
            setCopied(false);
            setNotice(result.error || 'The invitation was created, but email delivery failed. Share the link manually.');
          } else setError(result?.error || 'Could not send the invitation.');
        }
      } else {
        const { data, error: inviteError } = await supabase.rpc('create_team_invite', {
          target_organization: orgId, target_email: email.trim(), target_role: inviteRole,
        });
        if (inviteError) setError(inviteError.message);
        else {
          const row = (data as Array<{ invite_token: string }> | null)?.[0];
          if (row?.invite_token) {
            setNewInviteLink(teamInviteUrl(row.invite_token));
            setCopied(false); setEmail('');
            setNotice('Invitation created. Copy the link and send it to the invited email address.');
          } else setError('The server did not return an invitation link.');
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the invitation.');
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(newInviteLink);setCopied(true); }
    catch { setError('Clipboard access is blocked here. Select the link and copy it manually.'); }
  };

  const revokeInvite = async (invite:TeamInvitationRow) => {
    if (!supabase || !orgId || !isAdmin || busy) return;
    if (!window.confirm(`Revoke the pending invitation for ${invite.email}?`)) return;
    setBusy(true);setError('');setNewInviteLink('');
    const {error:rpcError} = await supabase.rpc('revoke_team_invite',{invitation_id:invite.id});
    if (rpcError) setError(rpcError.message); else setNotice('Invitation revoked.');
    await refresh();setBusy(false);
  };

  const changeRole = async (member:MemberInfo,role:'admin'|'member') => {
    if (!supabase || !orgId || !canManageTeamMember(myRole,member.role,member.user_id===user?.id) || busy) return;
    if (!window.confirm(`Change ${member.displayName || 'this teammate'} to ${roleName(role)}?`)) return;
    setBusy(true);setError('');
    const {error:rpcError}=await supabase.rpc('manage_team_member',{
      target_organization:orgId,member_user_id:member.user_id,next_role:role,remove_member:false,
    });
    if (rpcError) setError(rpcError.message);else setNotice('Team role updated.');
    await refresh();setBusy(false);
  };

  const removeMember = async (member:MemberInfo) => {
    if (!supabase || !orgId || !canManageTeamMember(myRole,member.role,member.user_id===user?.id) || busy) return;
    if (!window.confirm(`Remove ${member.displayName || 'this teammate'} from your company? They will lose server-side access to shared records.`)) return;
    setBusy(true);setError('');
    const {error:rpcError}=await supabase.rpc('manage_team_member',{
      target_organization:orgId,member_user_id:member.user_id,next_role:null,remove_member:true,
    });
    if (rpcError) setError(rpcError.message);else setNotice('Team member removed.');
    await refresh();setBusy(false);
  };

  if (!cloudReady) return <section className="settings-panel-grid">
    <article className="company-settings-card"><header><div><strong>Team access</strong><small>Sign in to a cloud workspace to manage your team.</small></div></header>
      <p className="settings-help">Memberships and invitations require a connected company workspace.</p>
    </article>
  </section>;

  return <section className="settings-panel-grid team-settings-layout" aria-label="Team and company access">
    <article className="company-settings-card settings-main-card">
      <header><div><strong>Your team</strong><small>People who can access shared SalesShop records.</small></div><span className="settings-count">{members.length} members</span></header>
      {loading ? <p className="settings-help" role="status">Loading team access…</p> :
        <div className="settings-member-list">
          {members.map((member) => {
            const self=member.user_id===user?.id;
            const label=member.displayName || (self ? user?.email || 'You' : 'Teammate');
            const editable=canManageTeamMember(myRole,member.role,self);
            return <div className="settings-member team-member-row" key={member.user_id}>
              <span className="settings-avatar">{label.charAt(0).toUpperCase()}</span>
              <div><strong>{label}{self ? ' (You)' : ''}</strong><small>{self ? user?.email : `Member since ${day(member.created_at)}`}</small></div>
              <span className="settings-role">{roleName(member.role)}</span>
              {editable && <div className="team-member-actions">
                <label><span className="team-screenreader">Change role</span>
                  <select value={member.role} aria-label={`Role for ${label}`} disabled={busy}
                    onChange={(event)=>void changeRole(member,event.target.value as 'admin'|'member')}>
                    <option value="member">Member</option>{myRole==='owner' && <option value="admin">Admin</option>}
                  </select>
                </label>
                <button type="button" disabled={busy} onClick={() => void removeMember(member)}>Remove</button>
              </div>}
            </div>;
          })}
          {!members.length && <p className="settings-help">No memberships could be found. Refresh and try again.</p>}
        </div>}
      {(error || notice) && <p className="settings-feedback" role={error?'alert':'status'}>{error || notice}</p>}
      <div className="settings-inline-actions"><button type="button" disabled={busy || loading} onClick={() => { setError(''); void refresh(); }}>Refresh team</button></div>
    </article>
    <div className="team-settings-side">
      <article className="company-settings-card">
        <header><div><strong>Invitations</strong><small>Send an email invitation or copy a seven-day, one-time link.</small></div></header>
        {isAdmin ? <>
          <form className="team-invite-form" onSubmit={(event) => void createInvite(event)}>
            <label><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="salesperson@company.com" /></label>
            <label><span>Access</span><select value={inviteRole} disabled={busy} onChange={(event)=>setInviteRole(event.target.value as 'member'|'admin')}>
              {inviteRoles.map((role)=><option key={role} value={role}>{roleName(role)}</option>)}
            </select></label>
            <div className="settings-inline-actions"><button type="submit" className="settings-primary-button" disabled={!email.trim() || busy}>{busy ? 'Working…' : 'Send invitation email'}</button><button type="button" disabled={!email.trim() || busy} onClick={() => void createInvite(undefined, false)}>Create link instead</button></div>
          </form>
          {newInviteLink && <div className="team-new-invite"><strong>Share this invitation</strong>
            <p>Only the invited, email-verified account can use it. This link is shown once. Creating a new link for the same recipient replaces their previous pending invitation.</p>
            <input readOnly value={newInviteLink} onFocus={(event)=>event.target.select()} aria-label="Invitation link" />
            <button type="button" onClick={() => void copyLink()}>{copied?'Copied':'Copy link'}</button>
            <button type="button" onClick={()=>setNewInviteLink('')}>Dismiss</button>
          </div>}
          <div className="team-pending-invites">
            <strong>Invitation history</strong>
            {invitations.map((invite)=><div key={invite.id} className="team-invite-row">
              <div><strong>{invite.email}</strong><small>{roleName(invite.role)} · {invite.status==='pending'?`Expires ${day(invite.expires_at)}`:invite.status}</small></div>
              {invite.status==='pending' && <button type="button" disabled={busy} onClick={()=>void revokeInvite(invite)}>Revoke</button>}
            </div>)}
            {!invitations.length && <p className="settings-help">No invitations yet.</p>}
          </div>
        </> : <p className="settings-help">Owners and admins can invite teammates. Ask your administrator if you need a new person added.</p>}
      </article>
      <article className="company-settings-card">
        <header><div><strong>Permissions</strong><small>These are enforced by SalesShop’s database.</small></div></header>
        <div className="settings-detail-line"><span>Your role</span><strong>{myRole?roleName(myRole):'Loading…'}</strong></div>
        <p className="settings-help">Owners can manage administrators. Admins can invite and manage members. Members can collaborate on company quotes and CRM records. Private notebooks remain personal.</p>
        <p className="settings-help">Individual sales ownership and “Mine / Team” reporting are a separate upcoming step.</p>
      </article>
    </div>
  </section>;
}
