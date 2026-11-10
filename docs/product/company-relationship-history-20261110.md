# Unified Company relationship history — November 10, 2026

## Delivered
- Replaced the Company's old collapsible *Activity history* (which missed manually logged touchpoints) with one chronological **Relationship history** card.
- Shared the same data model and rendering in **Company full page** (filterable, progressively expandable) and **Company quick preview** (four recent entries, last interaction and open linked Task count).
- Aggregates actual CRM Activities from the Company and ID-linked People, Deals, and Quotes. Includes external quote submissions, quote/document lifecycle updates, Deal updates, and personal Task/follow-up history.
- Adds Deal and Quote creation milestones, plus a sent quote milestone, only when there is no corresponding recorded Activity. Events linked through multiple records appear once.
- Offers filters for All, Interactions, Quotes, Deals and Tasks. Individual entries can open their linked Person, Deal, Quote or private Task.
- Only includes the signed-in user's personal Tasks when the active Task scope matches the account/organization. Perspective switch never reveals someone else's Tasks.
- Quotes supplied to the timeline follow the existing owner visibility in cloud mode. Archived or inaccessible Quote IDs, including metadata-only links, are not surfaced. Membership uses stable IDs, **never matching names**.
- Avoids a database migration and keeps all existing Company and CRM link records intact.

## Regression coverage
- `src/services/companyRelationshipHistory.test.ts`: multi-linked Activity dedup, event-to-record navigation, native/external Quote sent, fallback milestones, Task scope, archived/unseen Quote exclusions.
- `src/components/CompanyRelationshipTimeline.test.ts`: one reusable component in Company full page/preview, filters, private Task guard and navigation.
- These tests were authored in GitHub but cannot be executed from the connector-only environment; Cloudflare's production build runs TypeScript + existing quick-quote tests + Vite build.

## Manual QC after deployment
1. Open a Company with People, multiple Deals and native Quotes: verify timeline newest-first, and filters for Interactions / Quotes / Deals.
2. Log a phone or email Activity from a Person in that Company: it should appear exactly once in Company history and update the Last interaction summary.
3. Record an external quote against one of the Company's Deals: confirm "External quote sent" appears on the selected actual date without pretending there is a native Quote document.
4. Confirm a native Quote created/sent event doesn't produce two creation/sent entries, including revisions/change orders.
5. Create a linked personal follow-up Task through a Person: Company history should show the Task once, then show completion appropriately. A Team member's private Task must never appear.
6. Open the Company preview from Connections and Board on iPhone; scroll the recent history, tap a linked record and use Back. No giant blank space or clipping.
7. On Company full page, open linked Person, Deal, Quote and Task from the timeline; test dark/light mode and the Show More pagination.
8. Company name collisions must never cause another Company's Activities or Quotes to appear. Confirm archived and inaccessible Quotes are excluded.
9. On the SELF Company, roster membership remains intact. Do not infer all subcontractor interactions are internal SELF Company Activities unless explicitly linked.

## Out of scope
- No team-wide People/Company ownership migration or change to RLS.
- No email/sms auto capture, no external quote attachment/revision storage, and no new data synchronization paths.
