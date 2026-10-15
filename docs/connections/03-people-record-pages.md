# Connections 2.0 — Batch 17C: People records

**Depends on** Batch 17B (`feature/connections-privacy-polish-batch-2`, commit `c75cae78`).
**Development branch:** `feature/connections-people-records-batch-3`.
**Production:** `main` unchanged.

## Scope

- Shareable, reload-safe, deep-linked People records at `/connections/people/:contactId`.
- Existing Contact data fields: name, email, phone, job title, and one company association.
- Company selector and edits reuse `crmStore.updateContact` and current persistence; no migrations.
- Contacts open from the People directory, newly created People, Global Search, and the Company record's People panel.
- Company page and People page reuse `RecordPageLayout`, `RecordCard` and `RecordProperty` for consistent appearance and mobile behavior.
- Primary contact page information: contact properties, company link and company projects.
- **Company projects are explicitly marked as company-level context**. There is no contact-project assignment in today's CRM schema; no inferred salesperson/estimator attribution.
- **Activity history stays collapsed and opt-in**, showing only directly linked `activity.contactId === contact.id` records. No company-wide communication history is silently inherited.
- Email and telephone actions only open device handlers; they do not record interactions or suggest a tracking obligation.

## Non-goals / privacy

- No `Dashboard`/Overview restoration, global Activity promotion, contact engagement scores, activity reminders, or user-level pipeline reporting.
- No private cross-user contact grants, new synchronization privileges, Supabase RLS changes, or automatic email tracking.
- UI limits do not replace the still-pending least-privilege database access work in `docs/security/02-privacy-first-sales-ownership.md`.
- A Person presently supports **one company ID**. Multi-company affiliations and project-specific contact roles require a deliberate normalized schema and scoped permissions.

## QC

- `src/services/personRecordView.test.ts`: direct contact activity filtering and ID-only company associations.
- `src/services/appRoutes.test.ts`: People deep links, invalid routes, round-trip encodings.
- `src/store/navigationStore.test.ts`: Company → Person → Back.
- `e2e/connections-person-record.pw.ts`: create/edit/reload/navigate Company↔Person, missing IDs, mobile/desktop.
- Full PR Actions for Vitest, TypeScript/Vite and browser regressions.
