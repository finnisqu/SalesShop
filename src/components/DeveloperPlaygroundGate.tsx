import { useEffect, useState, type ReactNode } from 'react';
import { playgroundIdentityClient, supabase } from '../lib/supabase';
import { leavePlaygroundUrl } from '../lib/developerPlayground';

/**
 * A local-only preview must still be available only to the signed-in
 * platform Developer. The identity-only client calls the restricted JWT RPC;
 * it never reads tenants, customer records or company memberships.
 */
export function DeveloperPlaygroundGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'authorized' | 'unauthorized'>('checking');
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        if (!playgroundIdentityClient || supabase) throw new Error('Playground isolation unavailable');
        const { data: sessionData, error: sessionError } = await playgroundIdentityClient.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Not signed in');
        const { data: isDeveloper, error } = await playgroundIdentityClient.rpc('is_platform_developer');
        if (error || isDeveloper !== true) throw new Error('Not a platform Developer');
        if (alive) setStatus('authorized');
      } catch {
        if (alive) setStatus('unauthorized');
      }
    })();
    return () => { alive = false; };
  }, []);

  if (status === 'checking') return <main className="developer-playground-gate" role="status">
    <strong>Checking Developer access…</strong>
    <p>The sandbox has no customer data connection.</p>
  </main>;
  if (status === 'unauthorized') return <main className="developer-playground-gate" role="alert">
    <strong>Developer access required</strong>
    <p>Sign in with your dedicated Platform Studio account, then launch the Playground from there.</p>
    <a href={leavePlaygroundUrl()}>Return to SalesShop sign in</a>
  </main>;
  return <>{children}</>;
}
