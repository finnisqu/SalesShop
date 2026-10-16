# SalesShop P2 — Consent-based Company Ownership Handoff

**Status:** Code and database foundation implemented on `architecture/react-foundation`. Existing `main` is unchanged. No actual company ownership handoff has been requested or accepted.

## Where it lives

**Company Settings → Team → Company ownership handoff.**

Only the existing Owner sees the initiation form. Existing verified teammates can see requests specifically addressed to them. Company Admins cannot initiate an Owner handoff on the Owner's behalf, and SalesShop Developer accounts cannot enter a customer workspace at all.

1. Current Owner selects an existing team member, chooses their own post-transfer access, types `TRANSFER`, and confirms a request.
2. Server verifies JWT identity is the current Owner, the named successor is already a member and has verified their email, and no other unexpired request exists. New requests expire in seven days.
3. Successor signs into their own account, sees the request, types `ACCEPT`, and confirms.
4. A SECURITY DEFINER database RPC serializes against the organization row, confirms the same Owner, demotes or removes the old Owner, promotes the successor, and records audit data within one Postgres transaction. Any error rolls the entire operation back.
5. New Owner reloads and rehydrates permissions. Former Owner's next login reloads their current access. Owner cannot skip successor acceptance by changing an employee's role through the ordinary Team manager.

**No emails or notifications are sent automatically in P2.** The Owner must tell the successor to sign in; an authenticated acceptance screen is sufficient, and doesn't rely on a bearer-token transfer link.

## Former Owner options

- **Remove company membership (recommended for separate Developer account):** former Owner loses org access. `profiles.active_organization_id` clears. An offboarding guard prevents a silently created replacement workspace on their next login. Their account can be invited to a company in the future, but is not a platform developer.
- **Remain Salesperson Member:** former Owner no longer has Owner/Admin privileges and their quote editing is restricted to their own quotes by RLS. **Important:** SalesShop's existing CRM policy still allows Members to read organization-wide non-quote CRM data, including projects and contacts. Choose *remove* if the former Owner must not see company-wide customer/staff data.

The platform Developer account must be a separate login with no company membership, provisioned separately through the trusted developer-operator process. This handoff does not create a Developer account or assign platform privileges.

## Database safeguards

Migration: `supabase/migrations/202610110006_ownership_handoff.sql`

- Partial unique index permits **at most one Owner per organization**.
- Partial unique index permits **at most one pending transfer per organization**.
- `private.ownership_transfer_requests` is inaccessible directly from customer browsers; RPCs enforce identity, verification, current role, 7-day expiration and cancellation/decline.
- `private.ownership_transfer_audit` records request, cancellation, decline, and accepted transfer, with the actor and timestamp. No browser SELECT grants.
- Organization row is locked during both initiation and acceptance. The changes are atomic, not separate frontend mutations.
- Platform operators cannot be accepted as successor.
- `private.tenant_offboarded_accounts` prevents post-removal empty-company bootstrap.
- Existing `public.manage_team_member` already rejects attempts to change an Owner or to set `next_role='owner'`.
- Explicit client-side confirmations are convenience; all authorization is enforced independently by database JWT identity and transaction conditions.

## Actual live database dry runs

The migration was applied without creating any transfer requests.

**Dry run A: successor accepts, old Owner removed.**
- Successor becomes Owner
- Exactly one Owner remains
- Former Owner no longer belongs to the company
- Request and acceptance generate two audit events
- Entire test transaction rolled back

**Dry run B: successor accepts, old Owner remains Member.**
- Exactly one Owner remains
- Former Owner becomes Member, department Salesperson
- No offboarding record created
- Entire test transaction rolled back

After dry runs, database verification confirmed **0 actual transfer requests, 0 transfer audit events, 0 offboarded accounts and the original 4 Owners**. No World Stone memberships or quotes were modified.

## Known operational limits and manual signoff

- Role and membership RLS takes effect immediately on the server, but already-open browser tabs or downloaded/local cached data cannot be revoked retroactively. Auth signout, Developer login and offboarded reauthentication clear known SalesShop cloud caches.
- Owners should review signed-in state after handoff, and team members should reload. Ideally, sign out the former Owner's devices.
- Real-person end-to-end trial still required: invite boss, verify email, initiate request, accept from boss's account, verify team/pricing/quote access, verify former Owner access from a different browser.
- Public customer sharing and signing must remain unaffected.
- Additional SSO, MFA and multi-party emergency recovery policies belong in later SaaS hardening batches.
- Database-administrator access through Supabase remains independent of SalesShop Developer role; avoid giving routine product accounts service-role credentials.

## Future work

P3 can add reusable company onboarding and a better organization-switching experience. P4 can add billing and subscription lifecycle. Do not combine real company ownership transfer or payment onboarding with those feature migrations.
