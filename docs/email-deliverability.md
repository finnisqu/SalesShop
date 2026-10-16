# SalesShop transactional email deliverability

Canonical app: https://app.salesshop.work
Resend sending domain: salesshop.work
Invitations: SalesShop <invites@salesshop.work>
Supabase function: team-invite-email

## Operational checks before inviting a broader team

1. In Resend > Domains, verify DKIM and SPF/return-path status. Do not duplicate SPF TXT records for the same DNS hostname.
2. In Cloudflare DNS, check whether a single `_dmarc.salesshop.work` TXT record exists. If not, start with a monitoring policy, e.g. `v=DMARC1; p=none; adkim=r; aspf=r`; after validating alignment and legitimate senders, consider tightening the policy. Do not blindly replace an existing DMARC record or use an unmonitored `rua` address.
3. Send a real invitation to a controlled Gmail address and use Gmail > Show original to verify SPF, DKIM and DMARC all pass. The visible From address should remain `salesshop.work`.
4. If Gmail marks a legitimate invitation as spam, use Report not spam, check Resend's delivery events, and avoid sending repeated test messages to unverified or typo-prone addresses. New domains may need time to develop positive reputation.
5. Resend API success means submission accepted, **not** that the message was delivered. Use the stored-on-screen Resend submission reference to locate provider status and events. A later bounce requires a new invitation if the recipient address needs correction.
6. Keep Resend API keys only in Supabase Edge Function secrets; never put them in Vite/browser variables.

## Invitation acceptance safeguards

- The existing `create_team_invite` RPC enforces owner/admin permissions.
- A read-only `preview_team_invite` RPC validates the invitation hash, returns only a masked recipient address and org/role, and compares against the signed-in account before acceptance.
- `accept_team_invite` remains the sole authority for membership, recipient verification, and token consumption.
- No new organization is created while a pending invitation is unverified or belongs to another signed-in account.

## Remaining operational work

- Confirm the current DNS authentication settings in Cloudflare and Resend (not automatically changed by the code batch).
- Validate the latest GitHub Pages Build/Deploy workflow.
- End-to-end retest with a newly issued invitation, both while already signed into another account and in a private browser window.
