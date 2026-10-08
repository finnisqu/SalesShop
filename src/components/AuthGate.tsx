import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { pendingTeamInviteToken } from '../services/teamInvitationLink';
import { previewTeamInvite, type TeamInvitePreview } from '../services/teamInvitePreview';

export function AuthGate({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const ready = useAuthStore((state) => state.ready);
  const busy = useAuthStore((state) => state.busy);
  const mode = useAuthStore((state) => state.mode);
  const user = useAuthStore((state) => state.user);
  const organizationId = useAuthStore((state) => state.organizationId);
  const inviteProblem = useAuthStore((state) => state.inviteProblem);
  const activeInvitePreview = useAuthStore((state) => state.activeInvitePreview);
  const joinWelcome = useAuthStore((state) => state.joinWelcome);
  const dismissJoinWelcome = useAuthStore((state) => state.dismissJoinWelcome);
  const passwordRecovery = useAuthStore((state) => state.passwordRecovery);
  const sendPasswordReset = useAuthStore((state) => state.sendPasswordReset);
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const retryWorkspace = useAuthStore((state) => state.retryWorkspace);
  const discardInvitation = useAuthStore((state) => state.discardInvitation);
  const signOut = useAuthStore((state) => state.signOut);
  const error = useAuthStore((state) => state.error);
  const notice = useAuthStore((state) => state.notice);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const clearMessage = useAuthStore((state) => state.clearMessage);
  const [invited] = useState(() => Boolean(pendingTeamInviteToken()));
  // Invitations are for joining an existing team: lead with account creation.
  // Existing accounts can still choose the sign-in option below.
  const [creating, setCreating] = useState(invited);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [recoverMode, setRecoverMode] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [guestInvite, setGuestInvite] = useState<TeamInvitePreview | null>(null);
  const [guestInviteUnavailable, setGuestInviteUnavailable] = useState(false);
  const [guestInviteError, setGuestInviteError] = useState(false);

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => {
    if (!invited) return;
    const token = pendingTeamInviteToken();
    if (!token) return;
    let cancelled = false;
    void previewTeamInvite(token).then((preview) => {
      if (!cancelled) { setGuestInvite(preview); setGuestInviteUnavailable(!preview); }
    }).catch(() => { if (!cancelled) setGuestInviteError(true); });
    return () => { cancelled = true; };
  }, [invited]);

  if (mode === 'local') return <>{children}</>;
  if (!ready) return <div className="auth-loading">Connecting SalesShop…</div>;
  if (user && inviteProblem && !passwordRecovery) {
    const switching = inviteProblem === 'switch-account';
    const invalid = inviteProblem === 'unavailable';
    return <main className="auth-shell"><section className="auth-card auth-invite-card">
      <div className="auth-brand"><span>S</span><strong>SalesShop</strong></div>
      <div className="auth-copy">
        <span className="auth-eyebrow">Team invitation</span>
        <h1>{switching ? `Join ${activeInvitePreview?.organizationName || 'your invited team'}` : invalid ? 'Invitation no longer available' : 'Unable to check invitation'}</h1>
        <p>{switching ? `This invitation is for ${activeInvitePreview?.emailHint || 'a different email address'}. You're currently signed in as ${user.email || 'another user'}. To keep workspaces separate, switch accounts before joining.` : invalid ? 'This invitation may have expired, been revoked, or already been accepted. Ask the team owner for a new invitation if needed.' : error || 'Please retry checking your invitation.'}</p>
      </div>
      {switching && activeInvitePreview && <div className="auth-invite-summary"><strong>{activeInvitePreview.organizationName}</strong><span>Joining as {activeInvitePreview.role === 'admin' ? 'Administrator' : 'Member'}</span><small>Invited email: {activeInvitePreview.emailHint}</small></div>}
      <div className="auth-form">
        {switching ? <button type="button" className="auth-primary" disabled={busy} onClick={() => void signOut()}>{busy ? 'Switching…' : 'Continue with invited account'}</button>
          : !invalid ? <button type="button" className="auth-primary" disabled={busy} onClick={() => void retryWorkspace()}>{busy ? 'Checking…' : 'Retry invitation'}</button> : null}
        <button type="button" className="auth-switch" disabled={busy} onClick={() => void discardInvitation()}>Stay signed in and dismiss invitation</button>
        <small className="auth-switch-hint">You can also open the invitation in a private browser window to keep both accounts signed in.</small>
      </div>
    </section></main>;
  }
  if (user && organizationId && joinWelcome && !passwordRecovery) return <main className="auth-shell"><section className="auth-card auth-invite-card">
    <div className="auth-brand"><span>S</span><strong>SalesShop</strong></div>
    <div className="auth-copy"><span className="auth-eyebrow">Invitation accepted</span>
      <h1>Welcome to {joinWelcome.organizationName}</h1>
      <p>Your account is now connected to the existing {joinWelcome.organizationName} workspace. Your teammates' shared sales records are ready.</p></div>
    <div className="auth-invite-summary"><strong>{joinWelcome.organizationName}</strong><span>Your role: {joinWelcome.role === 'admin' ? 'Administrator' : 'Member'}</span><small>Signed in as {user.email}</small></div>
    <button type="button" className="auth-primary auth-full-width" onClick={dismissJoinWelcome}>Enter workspace</button>
  </section></main>;
  if (user && organizationId && !passwordRecovery) return <>{children}</>;
  if (user && !passwordRecovery) return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span>S</span><strong>SalesShop</strong></div>
    <div className="auth-copy"><h1>Workspace access needs attention</h1><p>{error || 'We could not resolve your company workspace.'}</p></div>
    <div className="auth-form">
      <button type="button" className="auth-primary" onClick={() => void retryWorkspace()} disabled={busy}>{busy ? 'Checking…' : 'Retry workspace access'}</button>
      {pendingTeamInviteToken() && <button type="button" className="auth-switch" disabled={busy} onClick={() => void discardInvitation()}>Cancel invitation and use my own workspace</button>}
      <button type="button" className="auth-switch" onClick={() => void signOut()}>Sign out</button>
    </div>
  </section></main>;

  if (invited && !user && guestInviteError) return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span>S</span><strong>SalesShop</strong></div>
    <div className="auth-copy"><h1>Unable to check invitation</h1><p>We couldn't securely verify your team invitation. Try again before creating an account.</p></div>
    <button type="button" className="auth-primary auth-full-width" onClick={() => window.location.reload()}>Retry verification</button>
  </section></main>;
  if (invited && !user && !guestInvite && !guestInviteUnavailable) return <div className="auth-loading">Checking team invitation…</div>;
  if (invited && !user && (guestInviteUnavailable || (guestInvite && guestInvite.status !== 'pending'))) {
    return <main className="auth-shell"><section className="auth-card">
      <div className="auth-brand"><span>S</span><strong>SalesShop</strong></div>
      <div className="auth-copy"><h1>Invitation unavailable</h1><p>This link has expired, was revoked, or has already been used. Request a new invitation from the workspace owner.</p></div>
      <button type="button" className="auth-primary auth-full-width" onClick={() => void discardInvitation()}>Continue without invitation</button>
    </section></main>;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (passwordRecovery) {
      if (password !== confirmPassword) { setFormError('Passwords do not match.'); return; }
      await updatePassword(password);
      return;
    }
    if (recoverMode) {
      await sendPasswordReset(email);
      return;
    }
    if (creating) {
      const ok = await signUp(email, password, invited ? '' : shopName);
      if (ok && !useAuthStore.getState().user) setCreating(false);
    } else {
      await signIn(email, password);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><span>S</span><strong>SalesShop</strong></div>
        <div className="auth-copy">
          <span className="auth-eyebrow">Stone sales workspace</span>
          <h1>{passwordRecovery ? 'Choose a new password' : recoverMode ? 'Reset your password' : invited ? creating ? 'Create your account' : 'Sign in to join your team' : creating ? 'Create your shop' : 'Welcome back'}</h1>
          <p>{passwordRecovery ? 'Enter a new password to finish recovering your account.' : recoverMode ? 'We’ll send a secure recovery link to your email address.' : invited ? creating ? 'You’ve been invited to join an existing SalesShop team. Use your invited email address to create an account, then confirm your email to finish joining.' : 'Already have an account? Sign in with the invited email address to join your team.' : creating ? 'Start with one account. Your shop workspace is created automatically.' : 'Sign in to your SalesShop workspace.'}</p>
        </div>

        {invited && guestInvite?.status === 'pending' && <div className="auth-invite-summary"><strong>{guestInvite.organizationName}</strong><span>You're invited as {guestInvite.role === 'admin' ? 'Administrator' : 'Member'}</span><small>Invited email: {guestInvite.emailHint}</small></div>}
        <form onSubmit={submit} className="auth-form">
          {creating && !invited && !recoverMode && !passwordRecovery && (
            <label><span>Shop name</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="World Stone" autoComplete="organization" /></label>
          )}
          {!passwordRecovery && <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>}
          {!recoverMode && <label><span>{passwordRecovery ? 'New password' : 'Password'}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={passwordRecovery ? 8 : 6} autoComplete={passwordRecovery || creating ? 'new-password' : 'current-password'} /></label>}
          {passwordRecovery && <label><span>Confirm new password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" /></label>}
          {formError && <div className="auth-message error" role="alert">{formError}</div>}
          {error && <div className="auth-message error">{error}</div>}
          {notice && <div className="auth-message notice">{notice}</div>}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? 'Working…' : passwordRecovery ? 'Save new password' : recoverMode ? 'Send reset link' : creating ? invited ? 'Create account' : 'Create SalesShop' : 'Sign in'}</button>
        </form>

        {!passwordRecovery && <>
          <button type="button" className="auth-switch" onClick={() => { clearMessage(); setFormError(''); setRecoverMode((value) => !value); }}>
            {recoverMode ? 'Back to sign in' : 'Forgot password?'}
          </button>
          {!recoverMode && <button type="button" className="auth-switch" onClick={() => { clearMessage(); setFormError(''); setCreating((value) => !value); }}>
            {creating ? 'Already have an account? Sign in' : invited ? 'Need an account? Sign up to join' : 'New shop? Create an account'}
          </button>}
        </> }
        <small className="auth-footnote">Notebook content is private to your user. Shared sales records belong to your shop workspace.</small>
      </section>
    </main>
  );
}

export function AuthStatus() {
  const mode = useAuthStore((state) => state.mode);
  const user = useAuthStore((state) => state.user);
  const organizationId = useAuthStore((state) => state.organizationId);
  const error = useAuthStore((state) => state.error);
  const signOut = useAuthStore((state) => state.signOut);

  if (mode === 'local') {
    return <span className="backend-status local" title="Supabase environment variables are not configured">Local</span>;
  }

  return (
    <div className="backend-account" title={error || user?.email || 'Cloud workspace'}>
      <span className={`backend-status ${organizationId ? 'cloud' : 'warning'}`}>{organizationId ? 'Cloud' : 'Cloud issue'}</span>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </div>
  );
}
