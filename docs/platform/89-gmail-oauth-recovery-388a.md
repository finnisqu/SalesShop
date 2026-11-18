# #388a — Gmail OAuth popup recovery and connection diagnostics

**Bugfix triggered by the November 18, 2026 SalesShop Gmail popup error.** The reported error is Google Identity Services `popup_closed`; it means Google did not return a token before its popup was reported closed, not proof of an origin mismatch.

## Changes

- Keep the current Gmail read-only token client, existing opt-in consent, mailbox confirmation, memory-only access token, workspace boundary and explicit Activity/Task actions.
- When Google invokes the popup-closed error callback, give a **short, bounded 800 ms callback grace period** before failing. A genuine late successful token response during that window can still complete normally; the success path clears both timers. The existing 90-second total timeout and immediate denial/blocked-popup errors remain.
- Rewrite the error to report accurately that the popup failed to return a token, without falsely asserting an authorized-origin error.
- Under **Tools → Email**, when an error is shown, offer collapsed **Connection checks**. A click checks the live browser origin, current public Web OAuth client ID, Google Identity Services library readiness, whether the page is embedded, and the actual **deployed** `Cross-Origin-Opener-Policy` header via a same-origin HEAD request. No claim is made when that request fails or does not expose headers. Missing/incorrect header is shown separately from an OAuth configuration mismatch.
- Add **Copy safe report**, containing only public client configuration and header status. Never inspect or store tokens, mailbox identity, Gmail message contents or credentials.
- Provide exact Google Cloud remediation: compare the displayed public client ID against the configured Web client, authorize `https://app.salesshop.work` **without** a trailing slash in JavaScript origins, check OAuth audience/test-user access, verify Gmail API and allow popups or privacy extensions.
- `public/_headers` already includes `Cross-Origin-Opener-Policy: same-origin-allow-popups` and Cloudflare Workers static assets support `_headers`. A checked-in header file **alone is not proof** that the deployed HTML currently has it; the new diagnostic tests the live response.
- No Cloudflare variables, OAuth credentials, provider authorizations, production SQL, account data, sent mail, or background jobs are modified by this code patch.

## Acceptance

1. Verify Cloudflare's check for the exact GitHub SHA passes TypeScript, quick-quote tests including #379 and #388a, record gate and Vite.
2. On a signed-in user in **Tools → Email**, select **Connect Gmail**. If it fails, open **Connection checks → Check this browser**.
3. Confirm the origin is `https://app.salesshop.work`. Compare the public OAuth Web client ID shown against Google Cloud → Google Auth Platform → Clients. If it differs, update `VITE_GOOGLE_GMAIL_CLIENT_ID` in the **Cloudflare production build environment**, then redeploy.
4. Confirm the deployed HTML sends `Cross-Origin-Opener-Policy: same-origin-allow-popups`, or explicitly investigate a missing/isolating policy. The diagnostic may fail to inspect HEAD; manually check the HTML document's Network response headers then.
5. Ensure the precise origin is in **Authorized JavaScript origins** for that exact client ID. Do not confuse this with Authorized redirect URIs.
6. Check the OAuth audience setting and whether this Google address is an allowed test user; confirm the Gmail API is enabled. Allow popups for the app and test with extensions temporarily disabled.
7. Approve the consent screen, ensure Gmail connects, loads a mailbox, lists/searches threads, and keeps all messages read-only. Refresh; connection should still require reconnection because tokens remain memory-only.
8. Regression: refused consent and blocked popups give errors; no token is ever accepted without Gmail read-only scope; a popup-close event followed promptly by a token callback succeeds, while genuine closure fails after the bounded grace period.

**External configuration limitation:** App code cannot add origins to a user's Google Cloud OAuth client, approve consent-screen test users, or change Cloudflare's currently configured build variable. If the browser checks show a mismatch, the account owner must update those settings. No green build is sufficient to prove a real Google account can authorize.
