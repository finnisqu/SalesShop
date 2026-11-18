# #388b — Gmail popup focus-aware completion

**November 18, 2026.** User reported that selecting a Google account caused SalesShop to show a red `popup_closed` error **while the Google popup remained open and continued its normal flow**.

## Diagnosis

The live browser diagnostics reported:

- exact origin `https://app.salesshop.work`
- valid public Web OAuth client ID present
- Google Identity Services loaded
- not embedded
- deployed `Cross-Origin-Opener-Policy: same-origin-allow-popups` response (compatible)

This substantially reduces the likelihood that the root cause is a missing Google script, embedded browser context or incompatible deployed COOP header. It **does not confirm** the OAuth client's Google Cloud origin/consent settings, and it does **not prove** which Google event arrived first.

Code inspection revealed a client-side UX defect: the #388a adapter rejected on `popup_closed` **after only 800 ms** even if Google was still displaying a foreground account/consent window. That could produce the exact red error reported before a usable token callback arrived.

## Fix

- When Google sends `popup_closed`, do **not** reject while the SalesShop document lacks focus. Google consent may still be active. Instead listen for the **SalesShop window returning to focus** and then allow a bounded **4-second** callback grace period before reporting a genuine no-token closure. The timer checks focus again on expiry; if the Google UI is active, it abandons the failure and waits for focus again.
- A valid Gmail read-only OAuth response can complete at **any point** while the attempt remains unsettled. Both timers and focus listener are cleaned up on success, rejection or the existing 90-second overall timeout.
- Immediate provider denial and blocked-popup error handling remain unchanged.
- Added bounded in-memory only **OAuth event trace**: fixed labels (`requested`, `popup_closed`, `oauth_response`, `oauth_denied`, `token_accepted`, `popup_blocked`, `failed`), elapsed milliseconds and whether SalesShop was focused. This trace is displayed under **Tools → Email → Connection checks** and included in **Copy safe report**. It does **not** retain a Google error object, tokens, emails, scopes, or Gmail contents.
- Added tests verifying a popup-closed signal during **12 seconds of foreground Google UI** does not show failure, and that a subsequent callback succeeds. Also test actual closure/refocus without token is eventually rejected, and normal scope verification/denials/timeouts still work.
- Read-only Gmail scope, browser-only token storage, current CRM safety boundaries and Cloudflare OAuth variables are unchanged.

## Acceptance

1. Confirm the exact GitHub commit passes Cloudflare TypeScript, Vitest, record gate and Vite, then open `https://app.salesshop.work`.
2. In **Tools → Email**, choose **Connect Gmail** and select the Google account. If Google continues displaying consent or account selection, SalesShop should remain in **Waiting for Google authorization…** instead of immediately showing red.
3. If Gmail connects, verify mailbox profile and list/search work as before.
4. If it **still** fails, use **Connection checks → Check this browser → Copy safe report**. The report now includes `Last OAuth flow events` with timing/focus and no token data. Look for `requested → popup_closed` without `oauth_response`, or `requested → oauth_response → oauth_denied`, etc.
5. If the trace reaches `token_accepted` but Gmail still shows an error, investigate the **Gmail profile API** response rather than the OAuth popup.
6. On a genuine user-closed window, verify the parent returns to focus and failure is displayed after the grace period. No automatic reconnection or background token refresh is added.

**Limit:** A green build validates our code but does not verify an authenticated Google consent response. Google Cloud OAuth audience, testing users, API enablement and authorized JavaScript origins require external inspection.
