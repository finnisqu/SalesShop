import { describe, expect, it } from 'vitest';
import { inviteAccountDecision, type TeamInvitePreview } from './teamInvitePreview';

const pending: TeamInvitePreview = {
  organizationName: 'World Stone',
  role: 'member',
  emailHint: 't***@example.com',
  expiresAt: '2026-10-15T00:00:00Z',
  status: 'pending',
  currentAccountMatches: null,
};

describe('safe team invitation preflight', () => {
  it('does not accept a pending invite against an unrelated current account', () => {
    expect(inviteAccountDecision({ ...pending, currentAccountMatches: false }, true)).toBe('switch-account');
    expect(inviteAccountDecision({ ...pending, currentAccountMatches: null }, true)).toBe('switch-account');
  });

  it('previews a viewer invitation safely', () => {
    const viewer = { ...pending, role: 'viewer' as const };
    expect(viewer.role).toBe('viewer');
    expect(inviteAccountDecision(viewer, false)).toBe('continue');
  });

  it('permits a verified-email-matched signed-in account to try acceptance', () => {
    expect(inviteAccountDecision({ ...pending, currentAccountMatches: true }, true)).toBe('continue');
  });

  it('lets signed-out users see an invitation and create or sign into an account', () => {
    expect(inviteAccountDecision(pending, false)).toBe('continue');
  });

  it('prevents unavailable, revoked, accepted and expired invites from onboarding', () => {
    expect(inviteAccountDecision(null, false)).toBe('unavailable');
    for (const status of ['accepted', 'revoked', 'expired'] as const) {
      expect(inviteAccountDecision({ ...pending, status }, false)).toBe('unavailable');
      expect(inviteAccountDecision({ ...pending, status, currentAccountMatches: true }, true)).toBe('unavailable');
    }
  });
});
