import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/teamInvitationLink', () => ({
  pendingTeamInviteToken: () => 'ab'.repeat(32),
}));

vi.mock('../store/authStore', () => {
  const state = {
    initialize: () => Promise.resolve(), ready: true, busy: false, mode: 'cloud',
    user: null, organizationId: null, error: null, notice: null,
    signIn: () => Promise.resolve(false), signUp: () => Promise.resolve(false),
    signOut: () => Promise.resolve(), retryWorkspace: () => Promise.resolve(),
    discardInvitation: () => Promise.resolve(), clearMessage: () => {},
  };
  return { useAuthStore: Object.assign(
    (selector: (snapshot: typeof state) => unknown) => selector(state),
    { getState: () => state },
  ) };
});

import { AuthGate } from './AuthGate';

describe('team invite account creation landing', () => {
  it('opens account creation first instead of sign in or create shop', () => {
    const html = renderToStaticMarkup(<AuthGate><p>Private shop content</p></AuthGate>);
    expect(html).toContain('Create your account');
    expect(html).toContain('Create account</button>');
    expect(html).toContain('Already have an account? Sign in');
    expect(html).toContain('invited email address');
    expect(html).not.toContain('>Shop name<');
    expect(html).not.toContain('Create SalesShop</button>');
    expect(html).not.toContain('Private shop content');
  });
});
