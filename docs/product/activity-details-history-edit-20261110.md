# Activity detail and corrections from relationship history — November 10, 2026

## Delivered
- The **In person** Activity method uses a single contact-book portrait/headshot icon rather than a group-of-people symbol in **Log Activity**, Home **Recent Activity**, and the new Company Relationship History glyph.
- Every **recorded Activity** entry in the Company Relationship History can be opened by tapping anywhere on the history row. The shared **Activity detail quick preview** opens, with date/time, type, notes, related CRM records, and event-specific external Quote details when available.
- Synthetic Deal/Quote milestone entries without an underlying Activity still open their linked Deal or Quote; no fake Activity is created.
- The same detail preview opens for recent logged Activities from the **Person quick preview**, **Person full-page Activity history**, **Deal Activity history** (already supported), and **Home Recent Activity** (already supported).
- Correctable logs (**manual-touchpoint** and **notebook-touchpoint**) expose **Edit activity** when the signed-in user has CRM edit permission. Date/time, interaction method, notes and multiple linked People, Companies, Deals or Quotes can be revised with an existing searchable association picker and Create related action. Edits save through the normalized CRM update path with actor/editedAt metadata and persisted draft recovery. System/quote-lifecycle events remain read-only so submitted Quote evidence isn't silently modified.
- Person history includes a logged interaction where the Person was added as an additional participant in `metadata.relatedRecords`, not only the single legacy `contactId`. Company history likewise follows ID links and updates after saved changes.
- Company quick preview stays underneath the Activity detail overlay, with the underlying focus layer suspended while editing; closing returns to the original Company quick view.

## Regression coverage
- `src/services/companyRelationshipHistory.test.ts`: recorded Activity targets now open Activity IDs.
- `src/components/CompanyRelationshipTimeline.test.ts`: whole-history-row click navigation callback.
- `src/services/personRecordView.test.ts`: secondary Person participants appear, without inheriting all Company logs.
- `src/components/ActivityDetailEntryPoints.test.ts`: Activity details entry points, edit permission restrictions, and portrait icons.

## Release QA
1. On mobile, log an **In person** meeting and confirm the single headshot icon on the method picker, Home Recents and Company history.
2. Open a Company's Relationship History and tap anywhere on a manual phone/email/in-person Activity row. It should open the Activity detail popup, not jump straight to a Person or Deal. Close and verify the Company view remains visible.
3. From the detail, tap a linked Person, Company, Deal or Quote; confirm correct navigation and no accidental duplicate linked event.
4. Edit a completed logged Activity: change its date/time and notes; add a second Person, save, reopen and verify updated details. Confirm the event moves to the correct chronological position and appears in both Peoples' Activity histories.
5. Verify a second logged Activity can be edited from the Person quick preview, Person full page, Deal and Home Recents.
6. Open a native sent-quote/system Activity: full details must be available, but no **Edit activity** action should be shown.
7. Check dark/light themes, keyboard and touch navigation, iPhone bottom sheet scroll, Cancel/Discard/Save, and account/role permissions.
8. Verify external quote sent proof, task guarding and calendar Quote Sent badge are unchanged (no automatic lifecycle rewrite).

## Boundaries
No Supabase migration, RLS change, or automatic GitHub check setting changes. This feature does not send messages or collect calls/emails automatically; it edits only explicitly recorded CRM interactions.
