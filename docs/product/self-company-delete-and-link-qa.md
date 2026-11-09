# Company SELF designation, Task delete styling and record Add actions

## Implemented
- **Companies → World Stone / any Company → Edit company** now has a **This is our company** checkbox. It retains the same CRM Company ID, linked People, Deals, Quotes and Activities.
- Designation is a reserved, non-searchable alias metadata marker `__ss_our_company_self_v1__`, already compatible with normalized CRM Company sync. This is distinct from employee/subcontractor pseudo-companies in Our Organization.
- A marked record displays **SELF** next to its name in the Companies table and mobile cards, and **Our Company / SELF** on its full record. **Our Company (SELF)** is a separate Companies filter; marked records are not returned as Prospect, Customer or Partner when filtering.
- Company classification during editing forces a marked Company to the non-customer underlying kind, preserving the distinction. The company can be unmarked later without losing its contact and transaction links.
- Activity filtering treats this own-company record as **Internal**, not Partner/Customer. Bulk and quick relationship selectors must not reclassify SELF records; their designation is edited in Company details.
- Task Delete actions now use a consistent trash icon and red, theme-aware border/background in both quick views, the Tasks workbook, the traditional list and bulk edit. In quick views, Delete appears left of other footer actions; the confirmation and existing private-task tombstones remain unchanged.
- Newly added record-relationship actions use **+ New Person / Deal / Quote / Task / Company** and **+ Link Existing Person / Deal / Quote / Company**.

## Future email integration direction
- Treat the own Company as an identity/contact CRM record, not a special user login or an unlogged inbox.
- Introduce a verified, organization-scoped list of email domains for each Company, with an explicit `is_our_company` property once custom fields are normalized.
- Link People by exact email address first; company domain can *suggest* a Company match. Exclude common personal email domains, support multiple domains/aliases, and always allow manual override.
- Never auto-assign contacts, activities or Deals solely because an email domain matches; inbound email sync needs deduplication, explicit account permissions and audit history.
- Long-term Add/Link UX: one searchable **+ Add** picker per record type, listing existing matches first and **+ Create New** as a final action. This batch only normalizes button text; it does not introduce an untested new composer.

## QA
1. World Stone remains visible in Companies → All, shows SELF in the name row, and appears under Companies → Type → Our Company (SELF).
2. World Stone is absent from customer, prospect and partner-only filters. Its People/Deals/Quotes links still open.
3. Edit Company: check/uncheck This is our company, save, reload, verify no duplicate Company was created and existing aliases still show normally.
4. Mobile Companies card and full-page Company header show SELF without collapsing or stretching the table.
5. Activity history relationship filters classify linked World Stone activities as Internal, not Prospect or Customer.
6. Open a Task from Home, the calendar and Tasks. Verify Delete is red, has a trash icon and is at left of the quick-view action row. X/outside click continues to dismiss.
7. Tasks table, traditional mobile list and Bulk edit → Delete selected show the same red trash treatment. Confirm cancel leaves tasks untouched; confirm delete removes tasks from Agenda and persists through cloud sync.
8. Deal, Company and Person record sections clearly distinguish + New from + Link Existing, with no duplicate or invented records.
9. Check desktop/tablet/iPhone layouts, accessible button names and dark/light themes.

## Verification notes
- No Supabase schema migration is necessary for the initial SELF designation because a reserved Company alias marker already syncs as part of the normalized CRM record.
- Existing historical company links and IDs must be retained.
- GitHub source checks and additional unit/source-level tests are included. Full TypeScript/Vitest/browser and Cloudflare deploy verification are still required before calling the release green.
