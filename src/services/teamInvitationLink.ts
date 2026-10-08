const INVITE_KEY = 'salesshop-pending-team-invite-v1';
const INVITE_HANDOFF_KEY = 'salesshop-invite-handoff-v1';
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const HANDOFF_MS = 24 * 60 * 60 * 1000;

interface InviteHandoff { token: string; expiresAt: number }

/**
 * Team invitations are single-use capabilities. The fragment keeps them out
 * of HTTP request URLs; session storage is primary. A short-lived same-origin
 * handoff is needed when confirmation opens a fresh browser tab.
 */
function readHandoff(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(INVITE_HANDOFF_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<InviteHandoff>;
    if (!saved.token || !TOKEN_PATTERN.test(saved.token)
        || typeof saved.expiresAt !== 'number' || Date.now() >= saved.expiresAt) {
      window.localStorage.removeItem(INVITE_HANDOFF_KEY);
      return null;
    }
    return saved.token;
  } catch {
    try { window.localStorage.removeItem(INVITE_HANDOFF_KEY); } catch { /* best effort */ }
    return null;
  }
}
export function capturePendingTeamInvite(): void {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash;
  const match = /^#invite=([0-9a-f]{64})$/.exec(hash);
  if (!match) return;
  try { window.sessionStorage.setItem(INVITE_KEY, match[1]); } catch { /* best effort */ }
  try {
    const handoff: InviteHandoff = { token: match[1], expiresAt: Date.now() + HANDOFF_MS };
    window.localStorage.setItem(INVITE_HANDOFF_KEY, JSON.stringify(handoff));
  } catch { /* browser storage can be disabled */ }
  // Remove the capability from the address bar before navigating the app.
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}
export function pendingTeamInviteToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(INVITE_KEY);
    if (value && TOKEN_PATTERN.test(value)) return value;
  } catch { /* use handoff */ }
  return readHandoff();
}
export function clearPendingTeamInvite(): void {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(INVITE_KEY); } catch { /* best effort */ }
  try { window.localStorage.removeItem(INVITE_HANDOFF_KEY); } catch { /* best effort */ }
}
export function teamInviteUrl(token: string): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error('Invalid invitation token');
  if (typeof window === 'undefined') throw new Error('Invitation links require a browser');
  // Keep beta invites on the one canonical current-branch deployment even
  // when an owner creates a link from a Netlify preview or another tab.
  const url = new URL('https://finnisqu.github.io/SalesShop/');
  url.hash = `invite=${token}`;
  return url.toString();
}
capturePendingTeamInvite();
