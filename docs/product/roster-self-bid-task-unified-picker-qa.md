# SELF company roster, guarded bid Tasks and unified Add/Create — QA

## What changed

**Company identity** — Edit Company now has a collapsed, compact "Company identity" section with "This is our company" checkbox. The SELF tag remains on the same Company record, retaining linked records. No large one-time-use callout occupies the edit form.

**Our Organization ↔ SELF Company** — The SELF Company record displays employees and subcontractors from the internal roster in its People section. Roster items link to their normal Person records. Our Organization heading links to SELF Company. A Person explicitly assigned to SELF Company appears under Employees, without reassigning subcontractors away from their own firm. No duplicate Company or Person records, no additional team-login permissions. This is a derived association, not a data migration.

**Generated bid-due Task guard** — Tasks identified by `sourceObjectId='deal-submit:<dealId>'` cannot be manually completed (including Task editor, table/bulk Complete, or last subtask checkbox) until confirmed proof has been recorded for that Deal. Issue-only, link-copy and Deal stage changes are not proof. The actual seller-confirmed Quote delivery workflow and successful External Quote Recording workflow produce the proof. Internal Task JSON adds `submissionConfirmedAt` to retain that proof if checklist items remain. When the last checklist item finishes, an already confirmed Task can complete without recording the bid twice. On cloud hydration, previously recorded CRM delivery/external quote events reconcile this proof. Closed-Deal historical quote backfills are excluded.

**Task quick views** — In both global and Tasks-page previews: Delete (red trash) and Edit (pencil) are together on the left; Complete and Complete + Log Activity are on the right, with compact mobile wrap. Generated bid Tasks instead offer their linked SalesShop Quote (where available), Record external quote (Deal preselected), and an explanatory disabled Complete control. Once submission is confirmed, normal completion respects remaining subtasks.

**Unified Add/Create** — A shared inline + Add picker searches existing records first, then provides + Create New with the entered name. Used in Company, Person and Deal record sections for Company/Person/Deal/Quote links, in direct Deal↔Person membership with optional role, and in private Task cards. It uses real CRM FKs, existing quote ownership/editability constraints and the direct Deal–Person relation table. No synthetic Activities are created. Existing team permission checks stay in place. For full Person details or advanced Deal details, open the created record after the quick create.

## Validation checklist

1. Open World Stone → Edit Company: verify the SELF setting is only visible after expanding Company identity; save, reopen, and check that its ID and connected records are unchanged.
2. Open Our Organization: the World Stone SELF link should open its normal Company page. On that Company page, Employees and Subcontractors from the roster should appear together with counts and no duplicate entries.
3. Open a subcontractor Person: both World Stone/Our Organization affiliation and the subcontractor's actual firm should be navigable; changing the firm must not make them disappear from the internal roster.
4. Add a Person directly to the World Stone Company: verify they appear in Our Organization → Employees as well, without duplicate Person creation.
5. Click a generated Submit Quote Task. Direct Complete must be unavailable; a manual stage move to Bid Sent or a normal logged call must not close it. Editing Task status to Completed and checking its final subtask must not bypass submission.
6. In a linked SalesShop Quote, issue a customer revision. The generated Task should **remain open**. Explicitly confirm customer delivery through Review/Delivery Confirmation; the Task can then complete, unless checklist items remain.
7. On the same Task, choose Record external quote. Confirm the linked Deal is preselected; record a valid sent date and amount. Task completion should follow the same rules without creating a SalesShop Quote.
8. For an outstanding checklist, confirm Quote delivery, reload, then check the last subtask; the parent should complete once, without losing its proof across private cloud sync.
9. Log a historical external quote for a previously completed/lost Deal: no active future bid Task should be completed.
10. Verify Task quick views opened from Home, Tasks and Calendar have Delete + pencil Edit at left; Complete / Complete + Log Activity at right; mobile wraps without overlapping.
11. On Company/Person/Deal pages choose + Add Person/Company/Deal/Quote. Search for an existing record, select it, verify direct linking. Type a new name and choose + Create New, verify a single new record and its relationship.
12. On Deal → People, use the same + Add Person picker and optional role; verify shared Deal–Person link on both record pages and no fabricated Activity. On Tasks card, + Add Task links existing private Tasks or opens a new-task editor with the record prelinked.
13. Test prospect/customer/external company filters, quote Draft/Ready reassignment rules, team viewer permissions, light/dark and iPhone widths.

## Scope and verification

No database migration for this batch. The previous Deal–Person table and existing normalized CRM/Task private JSON stores are reused. No Project Timeline/Gantt changes. New/updated focused regression tests cover submission guards, event reconciliation, roster membership, picker controls and action alignment. Full TypeScript build, Vitest and browser/Cloudflare deployment remain unverified from the connector-only environment.
