const INVITE_KEY = 'salesshop-pending-team-invite-v1';
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Invitation tokens are capabilities. Keep them in the current tab only and
 * immediately remove them from the address bar/browser referrer.
 */
export function capturePendingTeamInvite(): void {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash;
  const match = /^#invite=([0-9a-f]{64})$/.exec(hash);
  if (!match) return;
  try { window.sessionStorage.setItem(INVITE_KEY, match[1]); } catch { /* no persistent storage available */ }
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}
export function pendingTeamInviteToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(INVITE_KEY);
    return value && TOKEN_PATTERN.test(value) ? value : null;
  } catch { return null; }
}
export function clearPendingTeamInvite(): void {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(INVITE_KEY); } catch { /* best effort */ }
}
export function teamInviteUrl(token: string): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error('Invalid invitation token');
  if (typeof window === 'undefined') throw new Error('Invitation links require a browser');
  const url = new URL(window.location.href);
  url.hash = `invite=${token}`;
  return url.toString();
}
capturePendingTeamInvite();
