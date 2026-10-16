# Connections — Batch 17F: evidence-backed Deal/Person links and role policy gate

Base: Batch 17E (PR #55, commit b62372bb).
Branch: feature/connections-deal-contact-links-batch-6.
Production main: untouched.

## Implemented

- A Person record shows **Deals linked through quotes** only when a non-archived Quote explicitly stores both that contact's ID and the Deal's project ID.
- The Deal's existing Quote contacts panel now labels those people **Quote contact**, with a linked quote count. It does not invent titles like Decision maker or Bid manager.
- The relationship selector is pure, uses stable IDs (no company/name guessing), and does not record activities or create any new permission grants.
- Empty roles remain empty. The UI specifically explains these are Quote contact links, not formal Deal role assignments.
- Existing CRM document schema 3, normalized Supabase tables, Quote IDs, RLS rules and permissions remain unchanged.

## Required security gate before adding editable roles

A future normalized `deal_contact_roles` table must be designed with keys (organization_id, deal_id, contact_id, role), creators and explicit-scoped owners; role enum should be proposed only after workflow review (e.g. Estimator, Project Manager, Decision maker, Buyer). The role table needs tenant/creator-scoped RLS not the current organization-wide CRM read grants.

Before implementing:
1. Identify which Deal information is personal sales intelligence versus released/operational facts.
2. Audit the project/contact/quote read pathways, team roles and authentication on real accounts.
3. Define grants, revocation and deletion rules and test direct PostgREST/SQL access.
4. Migrate cloud and local caches without promoting private Deal notes or quote drafts.
5. Add the interactive role editor only after data policies pass.

This is **not** a formal Deal contact role feature and does **not** fix current Supabase RLS privacy gaps. Follow docs/security/02-privacy-first-sales-ownership.md.
