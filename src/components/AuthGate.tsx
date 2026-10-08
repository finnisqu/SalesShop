import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { pendingTeamInviteToken } from '../services/teamInvitationLink';

export function AuthGate({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const ready = useAuthStore((state) => state.ready);
  const busy = useAuthStore((state) => state.busy);
  const mode = useAuthStore((state) => state.mode);
  const user = useAuthStore((state) => state.user);
  const organizationId = useAuthStore((state) => state.organizationId);
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

  useEffect(() => { void initialize(); }, [initialize]);

  if (mode === 'local') return <>{children}</>;
  if (!ready) return <div className="auth-loading">Connecting SalesShop…</div>;
  if (user && organizationId) return <>{children}</>;
  if (user) return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span>S</span><strong>SalesShop</strong></div>
    <div className="auth-copy"><h1>Workspace access needs attention</h1><p>{error || 'We could not resolve your company workspace.'}</p></div>
    <div className="auth-form">
      <button type="button" className="auth-primary" onClick={() => void retryWorkspace()} disabled={busy}>{busy ? 'Checking…' : 'Retry workspace access'}</button>
      {pendingTeamInviteToken() && <button type="button" className="auth-switch" disabled={busy} onClick={() => void discardInvitation()}>Cancel invitation and use my own workspace</button>}
      <button type="button" className="auth-switch" onClick={() => void signOut()}>Sign out</button>
    </div>
  </section></main>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
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
          <h1>{invited ? creating ? 'Create your account' : 'Sign in to join your team' : creating ? 'Create your shop' : 'Welcome back'}</h1>
          <p>{invited ? creating ? 'You’ve been invited to join an existing SalesShop team. Use your invited email address to create an account, then confirm your email to finish joining.' : 'Already have an account? Sign in with the invited email address to join your team.' : creating ? 'Start with one account. Your shop workspace is created automatically.' : 'Sign in to your SalesShop workspace.'}</p>
        </div>

        <form onSubmit={submit} className="auth-form">
          {creating && !invited && (
            <label><span>Shop name</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="World Stone" autoComplete="organization" /></label>
          )}
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete={creating ? 'new-password' : 'current-password'} /></label>
          {error && <div className="auth-message error">{error}</div>}
          {notice && <div className="auth-message notice">{notice}</div>}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? 'Connecting…' : creating ? invited ? 'Create account' : 'Create SalesShop' : 'Sign in'}</button>
        </form>

        <button type="button" className="auth-switch" onClick={() => { clearMessage(); setCreating((value) => !value); }}>
          {creating ? 'Already have an account? Sign in' : invited ? 'Need an account? Sign up to join' : 'New shop? Create an account'}
        </button>
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
