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

describe('team invitation account creation', () => {
  it('waits for invitation preflight before exposing the registration form', () => {
    // SSR cannot run the invitation verification useEffect, so initial HTML
    // must be the safe loading state, not a sign-up flow for an unverified token.
    const html = renderToStaticMarkup(<AuthGate><p>Private shop content</p></AuthGate>);
    expect(html).toContain('Checking team invitation');
    expect(html).not.toContain('Create SalesShop</button>');
    expect(html).not.toContain('Create account</button>');
    expect(html).not.toContain('Private shop content');
  });
});
