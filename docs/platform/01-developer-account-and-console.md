# SalesShop Platform Studio — P1 (developer account separation)

**Repository:** `finnisqu/SalesShop`  
**Working branch:** `architecture/react-foundation`  
**Production `main`:** unchanged

## The architectural distinction

There are **two independent permission systems**:

1. **Platform authorization** — a small number of dedicated SalesShop developer/operator identities, stored in `private.platform_operators` and checked server-side before every platform operation. A developer maintains software, product subscriptions and platform operations, **not** company CRM, quotes, staff, or private documents.
2. **Tenant authorization** — companies (`organizations`) and their Owner/Admin/Member/Viewer roles. Each company's Owner controls access to that company's data. A company Owner is not a SalesShop developer and cannot access another company.

These roles are intentionally **not a hierarchy**. Being a developer does not imply Owner access to every tenant.

The database rejects any identity listed in `private.platform_operators` joining a tenant workspace, and rejects promoting an existing tenant user into a platform developer. Use a **separate Supabase Auth login** for a platform developer and a World Stone employee. Support/bug-report tooling must not use direct read access to company data.

## What is implemented in P1

- SQL migration `202610110005_platform_operator_foundation.sql` creates:
  - `private.platform_operators`: developer account allowlist, manually provisioned by trusted database administration; no normal client table grants
  - Separation triggers on both platform operators and company memberships
  - `private.platform_tenant_status`: subscription/lifecycle placeholders, **no active subscriptions assigned**
  - `public.is_platform_developer()`: caller-JWT verified boolean bootstrap check
  - `public.platform_console_overview()`: company name, creation date, lifecycle, plan and total company count; **no user, CRM, quote, contact, billing secret, or signature fields**
- `authStore` checks the platform role before calling `ensureCurrentWorkspace()`, accepting invitations, importing local company records or starting cloud sync.
- `AuthGate` directly mounts `DeveloperConsole`, not tenant `App`, for an authorized developer.
- The Developer Console has a responsive Overview page, searchable Companies list, and visibly unavailable future modules (Subscriptions, Releases, Support). **It has no Enter company or View quote buttons.**
- Normal SalesShop login, invitations, local/demo mode and customer links keep their existing tenant path.

## Important: activation is deliberately incomplete

**No existing account has been granted developer privileges.** Do NOT promote a World Stone Owner account: the separation trigger forbids it. To activate:

1. Create a second, dedicated Supabase Auth user for the SalesShop developer account using a trusted Auth admin process. Do not sign in to SalesShop as that identity until it is registered as an operator, or the default onboarding flow could create a company.
2. As a trusted database administrator, confirm this new user has **zero** `organization_members` rows, then add its auth UUID to `private.platform_operators`. Do not grant this capability through a self-signup link or by email pattern.
3. Sign in normally with the developer account; verified authorization routes directly to Platform Studio. The account cannot join any tenant through invitations or membership changes.
4. Have World Stone's actual business owner sign in with a **different** ordinary tenant account and accept a future, separately approved **ownership transfer**. Do not remove the existing Owner before this handoff has been tested.

P1 **does not** hand over World Stone, assign billing plans, collect customer billing details, create trials automatically, or silently move data.

## How the interface is designed

**Developer login → Platform Studio**
- Overview: number of registered workspaces, number with subscription lifecycle configured, explicit "Customer data access: None"
- Companies: registered business names, creation dates, plan/lifecycle status (when billing is implemented)
- Planned: billing/subscriptions, app releases, support operations
- Never: customer quotes, employees, direct tenant impersonation, notebook, materials, supplier costs

**Company login → SalesShop**
- Company Owner: their team, pricing, projects, quotes, Settings
- Company Admin: delegated tenant controls
- Employees/Viewers: scoped roles and RLS-guarded records

In the first batch the console renders on the existing app domain after JWT inspection. A dedicated `platform.salesshop.work` route/subdomain may be added later once product deployment and authentication domains are configured.

## Suggested follow-on batches

- **P2 — Tenant ownership transfer:** explicit Owner-to-Owner handoff with target acceptance, transactional uniqueness guarantees, audit log, and post-transfer permission tests. Never remove the original Owner solely based on an email request.
- **P3 — Company onboarding:** deliberate Create/Join Company landing flow, customer-safe initialization, organization lifecycle, invitations, password and MFA enrollment.
- **P4 — SaaS billing:** Stripe (or chosen billing provider), webhook-sourced subscription state, plan enforcement, cancellation and grace policies. Developer console displays lifecycle metadata without exposing payment methods.
- **P5 — Safe support:** opt-in customer support case, narrow time-boxed scopes, audit trails, automatic expiration; no unrestricted impersonation or service-role credentials in browser.
- **P6 — Deployment & diagnostics:** release status, application health, privacy-preserving telemetry, tenant opt-in diagnostic reports.

## Security and testing gates

- Test authenticated member: `public.is_platform_developer()` returns **false**.
- Test operator without company membership: returns true and can fetch platform metadata while unrelated normal tenant RLS remains closed.
- Test attempting to assign an existing World Stone member as developer: trigger rejects.
- Test developer attempting to join company membership: trigger rejects.
- Test ordinary user invoking `platform_console_overview()`: permission denied.
- Validate platform console never imports tenant stores or requests quotes/contacts/members.
- Browser QA: mobile/desktop navigation, sign out, no tenant app hydration after developer login.
- Keep the existing customer quote-share link and customer sign flow unaffected.

P1 uses read-only console privileges. There is **no Developer account provisioned yet**, and there is **no ownership transfer yet**. Those actions require deliberate activation and owner approval.
