import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';

export function AuthGate({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const ready = useAuthStore((state) => state.ready);
  const busy = useAuthStore((state) => state.busy);
  const mode = useAuthStore((state) => state.mode);
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);
  const notice = useAuthStore((state) => state.notice);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const clearMessage = useAuthStore((state) => state.clearMessage);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');

  useEffect(() => { void initialize(); }, [initialize]);

  if (mode === 'local') return <>{children}</>;
  if (!ready) return <div className="auth-loading">Connecting SalesShop…</div>;
  if (user) return <>{children}</>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (creating) {
      const ok = await signUp(email, password, shopName);
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
          <h1>{creating ? 'Create your shop' : 'Welcome back'}</h1>
          <p>{creating ? 'Start with one account. Your shop workspace is created automatically.' : 'Sign in to your SalesShop workspace.'}</p>
        </div>

        <form onSubmit={submit} className="auth-form">
          {creating && (
            <label><span>Shop name</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="World Stone" autoComplete="organization" /></label>
          )}
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete={creating ? 'new-password' : 'current-password'} /></label>
          {error && <div className="auth-message error">{error}</div>}
          {notice && <div className="auth-message notice">{notice}</div>}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? 'Connecting…' : creating ? 'Create SalesShop' : 'Sign in'}</button>
        </form>

        <button type="button" className="auth-switch" onClick={() => { clearMessage(); setCreating((value) => !value); }}>
          {creating ? 'Already have a workspace? Sign in' : 'New shop? Create an account'}
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
