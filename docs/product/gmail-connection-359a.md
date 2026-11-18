# Gmail Integration v0.1 — Setup and safety

**Status:** Source implementation, Cloudflare build and authenticated Google consent testing pending.
**Product:** SalesShop → Tools → Email.

## What the first prototype actually does

- Connects a **real Gmail account** with Google Identity Services' browser OAuth token client.
- The user approves **Gmail read-only** scope. Lists recent/search-matched Gmail threads, reads thread headers/snippets, and fetches readable body text **only when a thread is selected**. The app never sends, labels, deletes or modifies messages.
- Suggests matching CRM People using exact participant addresses, then related Deals using current Company or direct Deal-Person associations. Suggestions never create relationships.
- Users explicitly link/unlink Gmail thread IDs to People or Deals. Only mailbox identifier, thread ID, target kind/ID, and link time are saved in **user+tenant-scoped browser localStorage**. No Gmail tokens, subjects, bodies, recipient lists, search query, messages or headers are saved there.
- Deals and People display their own linked conversations. Actual email headers/body are fetched live from the user's connected mailbox, not copied into the CRM or Activity log.
- The connected Gmail access token remains **in memory** and is reset on workspace/account transition, disconnect or page reload. There is no refresh token, server-side email processing, or offline sync.

## Prerequisites to enable a real Gmail connection

1. In Google Cloud Console for SalesShop, enable **Gmail API**, configure an OAuth consent screen, and create an **OAuth Client ID** of type **Web application**.
2. Add the **exact origin shown in your SalesShop browser address bar** to **Authorized JavaScript origins** (for example, **https://app.salesshop.work** when you use the app subdomain (or **https://salesshop.work** only when that is the actual host)). The origin has scheme and host but **no trailing slash or URL path**. If you use another host, preview URL or local Vite development server, register that separate origin. Do not add wildcards. **This browser token-client prototype does not need an OAuth redirect URI**.
3. Configure Cloudflare Pages **production build** variable **VITE_GOOGLE_GMAIL_CLIENT_ID** to the Web client ID (ends in \`.apps.googleusercontent.com\`). This is a **public OAuth client identifier**, not a secret; never put a Google client secret or access token into a Vite env variable.
4. Add test users to the Google OAuth consent screen while the app is in testing; Google's Gmail read-only scope is **restricted** and broad external deployment may require Google's scope verification, security assessment and/or Workspace admin approval.
5. Redeploy after setting the build variable, open Tools → Email, choose **Connect Gmail**, grant the displayed Gmail read-only permission, and test loading, searching, opening, linking, and unlinking threads. Reload and confirm reconnection is needed and only ID-based links remain.
6. Negative tests: denied consent, revoked access, expired token, wrong Google account, user changing SalesShop organization, role without CRM edit, phone/small screen, absent client ID, and browser storage quota.

## Security and release boundaries

- The Google token-model's user-visible consent/temporary token is an explicitly **browser-only prototype**. A future persistent sync/automation design must use a backend OAuth authorization-code flow, encrypted tokens with server-side secret management, strong RLS and provider revocation. No OAuth token or email content is written to Supabase by this prototype.
- Never infer successful **sent email, Quote delivery, customer reply or completed Activity** from opening, copying or linking a Gmail thread. A salesperson must explicitly confirm these operations through existing workflows.
- Browser-local thread links are not team-shared and don't survive changing browser/device. Only link IDs are persisted, not private message content. Do not claim otherwise.
- Always enforce the user's current CRM visibility and write permissions in the app; a future shared link table needs independent negative tenant/role RLS tests before release.
- No production Supabase schema, Edge secrets, DNS or customer data is modified by the code change.

Reference: Google Identity Services token model and Gmail API threads docs.

## Automatic Person matching (v0.2a)

Person records with valid email addresses now display live, exact-address Gmail conversation matches by default while the user is connected. You can refresh, load more, disable auto-matching for a Person, or hide and restore individual automatic results. This does not persist Gmail message contents, write CRM Activities, or automatically associate Deals. See [Gmail automatic Person matching](gmail-person-auto-matching-361.md).

## Popup completes but SalesShop stays disconnected

- The deployed address in recent SalesShop screenshots is **https://app.salesshop.work**. Google OAuth **Authorized JavaScript origins** must explicitly include that exact scheme and hostname; authorizing only `https://salesshop.work` is insufficient.
- Confirm the Google OAuth Web client is the one configured in Cloudflare's `VITE_GOOGLE_GMAIL_CLIENT_ID` build variable, and that Gmail API and any consent-screen testing users are configured.
- Cloudflare Workers static assets include `public/_headers` with `Cross-Origin-Opener-Policy: same-origin-allow-popups` to permit Google's popup to communicate with its parent window.
- A popup close, blocked popup, or missing Google callback now displays an actionable error and returns Connect Gmail to a retryable state. Tokens and message bodies remain memory-only.
- For security, the app does not pretend the account connected when Google does not return a read-only access token and verified mailbox address.

## November 18, 2026: OAuth popup troubleshooting update (#388a)

A reported `popup_closed` from Google Identity Services means no token reached SalesShop before the popup was reported closed; it does **not prove** the OAuth origin is misconfigured. Under **Tools → Email**, a failed connection now shows **Connection checks**. Click **Check this browser** to inspect the exact origin, public OAuth Web client ID, Google script availability, whether SalesShop is embedded, and the **actual deployed** `Cross-Origin-Opener-Policy` response header. Compare the displayed public client ID with your Web OAuth client in Google Cloud; the client must authorize `https://app.salesshop.work` as a JavaScript origin (no trailing slash). Confirm test-user audience settings, Gmail API access and browser popup permissions. If the live header probe fails, check the app's HTML response headers in browser DevTools. `public/_headers` contains `same-origin-allow-popups`, but the checked-in file alone does not confirm the deployed response. OAuth popup close now waits briefly for an already-in-flight callback before returning to a retryable error state. No token or mailbox contents are disclosed in the optional diagnostic report. See [#388a](../platform/89-gmail-oauth-recovery-388a.md).
