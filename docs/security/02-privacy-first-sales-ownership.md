# SalesShop Privacy-First Ownership — Architecture Gate (Batch 4)

**Status:** Security design and migration gates only. **No production RLS policy is changed by this document.**

## Product rule

The salesperson owns their process. The shop owns the operational outcome when a quote becomes a signed commitment, approved production job, invoiced work, or material requirement.

A salesperson's **drafts, customer intelligence, outreach, private notes, quotes under preparation, follow-ups and work-in-progress** are private to that salesperson unless shared **intentionally, narrowly and revocably**. A user in the Owner or Admin role does **not** automatically have access to these private records. Owner/Admin role confers workspace administration, not indiscriminate sales intelligence visibility.

Organization leadership can access **shop outcomes** needed for production and financial operations: signed customer commitments, approved releases, invoices, pending fabrication, and required materials. No employee-by-employee activity scoring, idle-time rankings, or account-intelligence mining. Operational data should be grouped around projects, orders and materials rather than surveillance dashboards.

## Current-state audit — validated against October 14 code

1. `202610110002_quote_scoped_rls.sql` allows **Owner/Admin to read and edit every quote** through `private.can_read_quote` and `private.can_edit_quote`; also grants a Member access to all quotes in their team. This violates the desired default-private posture.
2. `quote_access_grants` allows admin-created read grants. A shared quote read exposes quote rows **and internal cost data, lines and revision snapshots**; it is not a sanitized customer-facing permission.
3. `TeamQuotesWorkspace` lists unissued drafts, filters by salesperson and shows draft totals; it exposes private process, and should be replaced by a **Shop Outcomes** workspace.
4. Legacy `org_documents` JSON snapshots are restricted to admin, but this still may be too broad for private work. Normalized CRM companies, contacts, projects, activities and exports must be audited as separate leakage routes.
5. Existing Notebook data already syncs as `private_documents` with `owner_id`; the proposed floating Post-it should inherit this **per-user** boundary, not automatically copy to shared CRM/notes.
6. `quote-share-admin`, public customer shares, signer records and signature snapshots need a lifecycle/access audit so the new model does not orphan active share tokens or invalidate historical signed records.
7. Already-downloaded browser caches cannot be recalled by server-side RLS. Role-policy rollout must force a fresh cloud sync and prevent stale Team Quotes snapshots being displayed.

## Target data boundaries

| Surface | Record owner and access | Safe company outcome |
| --- | --- | --- |
| Unissued quote and revisions | Creator/explicit collaborator only | None by default |
| Private customer/lead notes, activities, follow-ups | Creator only unless shared | None by default |
| Personal Notebook/Post-its | Per-user private document | Nothing unless deliberately promoted |
| Collaborator quote share | Initiated by creator, explicit user+scope+revoke | Customer-safe projection if selected |
| Signed contract | Immutable document and signature evidence; creator retains editable relationship notes privately | Versioned, customer-safe **signed agreement record** for authorized operations |
| Production/fabrication job | Responsible production team, not blanket sales analytics | Job status, measurements, material requirements, approved scopes |
| Invoice/payment | Authorized financial roles | Amount due, paid status, fulfillment |
| Supplier/material updates | Authorized purchasing/operations roles | Inventory, procurement requirements and approved price effective dates |

### Explicit share scopes

- **Reference / customer-safe:** read-only presentation of approved customer-facing scope and totals; cannot read internal costs, profitability, draft revision history, quote share tokens or signature strokes. Achieve this with dedicated database projection / RPC, **not** frontend field hiding on `quotes.select('*')`.
- **Collaborate:** access to a specifically chosen draft with separately defined edit capabilities and expiration/revocation.
- **Operational release:** only after a signed agreement or other explicit release action creates a versioned operational snapshot. Issuing or previewing a quote is **not** a release.

A user must never be able to grant themselves another person's private draft merely because they are a workspace Owner/Admin.

## Implementation sequence — gates, not a big-bang RLS change

1. **Inventory every read/write route.** Enumerate SQL table policies, SECURITY DEFINER functions, service-role Edge Functions, normalized sync, CRM imports/search, global search, cached snapshots and mobile offline storage. Build JWT-level tests for salesperson, owner, admin, viewer and removed-team cases.
2. **Introduce a separate versioned business-outcome projection** populated by validated signing/release transitions, never as a general `quotes` view returning private columns. Prove it is not available for drafts and never contains supplier costs, margin data, private activity or contact intelligence.
3. **Replace Team Quotes with Shop Outcomes** for operations/ownership. Use aggregate production and financial records; remove filters that rank salespeople or expose activity and unissued pipeline. Preserve normal My Quotes and explicit individual share workflows.
4. **Implement owner-controlled grants with scope and audit**, including immediate revocation, expiration and clear access UI. Test that a customer-safe grant cannot query quote underlying base tables or revision JSON. Existing historical grants require explicit migration decisions; do not silently escalate or revoke current active customer links.
5. **Flip RLS only after parallel projection reads and tests pass:** no Owner/Admin default read of another person's unissued quote, no team-by-membership implicit read, least-privilege edits. Retain separately authorized immutable signed documents and operational records.
6. **Cutover:** SQL role-simulation tests, real authenticated-browser tests for all roles, customer signing and public-share tests, old drafts/revisions/signed snapshot tests, cache clearing, rollback script, staged organization deployment. Do not claim success from SQL text assertions alone.

## Non-negotiable acceptance checks

- Owner/Admin cannot query another salesperson's unshared draft with direct SQL, PostgREST, cached sync, RPC, search, activity rows, legacy JSON or Edge Function.
- Staff without a grant cannot query another salesperson's customer/contact intelligence even if on the same Sales Team.
- Creator can share, view effective recipients/scopes and revoke; revoked recipients fail fresh fetches immediately.
- Shop outcomes are visible to specifically authorized operational roles and contain only signed/released business facts needed for fulfillment.
- Prices and customer preview totals remain unchanged; signed records are immutable, signatures accessible to authorized roles without disclosing signer strokes through broad quote RLS.
- Old signed agreements and active public customer links remain usable under their exact existing customer authorization.
- No employee activity leaderboard, surveillance-derived score, or timeline appears in owner dashboards.

## Dependencies and risk

**Blocker:** Existing SQL security contract tests currently assert the old Owner/Admin broad-access model. They must change alongside new migrations, not be weakened or deleted in advance. A read-only UI swap while keeping the old RLS does **not** satisfy this security goal.

**Rollback:** Snapshot policies, record counts, per-role read tests and current permissions before migration. Rollback must retain signed evidence and journal why/when privileges changed. Never overwrite `main` or directly deploy schema changes from an unreviewed feature branch.
