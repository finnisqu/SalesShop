# Gmail Integration v0.1 — Setup and safety

**Status:** Source implementation, Cloudflare build and authenticated Google consent testing pending.
**Product:** SalesShop → Records → More → Email.

## What the first prototype actually does

- Connects a **real Gmail account** with Google Identity Services' browser OAuth token client.
- The user approves **Gmail read-only** scope. Lists recent/search-matched Gmail threads, reads thread headers/snippets, and fetches readable body text **only when a thread is selected**. The app never sends, labels, deletes or modifies messages.
- Suggests matching CRM People using exact participant addresses, then related Deals using current Company or direct Deal-Person associations. Suggestions never create relationships.
- Users explicitly link/unlink Gmail thread IDs to People or Deals. Only mailbox identifier, thread ID, target kind/ID, and link time are saved in **user+tenant-scoped browser localStorage**. No Gmail tokens, subjects, bodies, recipient lists, search query, messages or headers are saved there.
- Deals and People display their own linked conversations. Actual email headers/body are fetched live from the user's connected mailbox, not copied into the CRM or Activity log.
- The connected Gmail access token remains **in memory** and is reset on workspace/account transition, disconnect or page reload. There is no refresh token, server-side email processing, or offline sync.

## Prerequisites to enable a real Gmail connection

1. In Google Cloud Console for SalesShop, enable **Gmail API**, configure an OAuth consent screen, and create an **OAuth Client ID** of type **Web application**.
2. Add the exact SalesShop UI origin (typically **https://app.salesshop.work**) to the client **Authorized JavaScript origins**. For a local test use the exact Vite localhost origin. Do not add wildcards.
3. Configure Cloudflare Pages build env **VITE_GOOGLE_GMAIL_CLIENT_ID** to the Web client ID (ends in \`.apps.googleusercontent.com\`). This is a **public OAuth client identifier**, not a secret; never put a Google client secret or access token into a Vite env variable.
4. Add test users to the Google OAuth consent screen while the app is in testing; Google's Gmail read-only scope is **restricted** and broad external deployment may require Google's scope verification, security assessment and/or Workspace admin approval.
5. Deploy, open Records → More → Email, choose **Connect Gmail**, grant the displayed Gmail read-only permission, and test loading, searching, opening, linking, and unlinking threads. Reload and confirm reconnection is needed and only ID-based links remain.
6. Negative tests: denied consent, revoked access, expired token, wrong Google account, user changing SalesShop organization, role without CRM edit, phone/small screen, absent client ID, and browser storage quota.

## Security and release boundaries

- The Google token-model's user-visible consent/temporary token is an explicitly **browser-only prototype**. A future persistent sync/automation design must use a backend OAuth authorization-code flow, encrypted tokens with server-side secret management, strong RLS and provider revocation. No OAuth token or email content is written to Supabase by this prototype.
- Never infer successful **sent email, Quote delivery, customer reply or completed Activity** from opening, copying or linking a Gmail thread. A salesperson must explicitly confirm these operations through existing workflows.
- Browser-local thread links are not team-shared and don't survive changing browser/device. Only link IDs are persisted, not private message content. Do not claim otherwise.
- Always enforce the user's current CRM visibility and write permissions in the app; a future shared link table needs independent negative tenant/role RLS tests before release.
- No production Supabase schema, Edge secrets, DNS or customer data is modified by the code change.

Reference: Google Identity Services token model and Gmail API threads docs.
