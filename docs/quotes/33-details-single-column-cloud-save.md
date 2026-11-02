# Quotes Beta — Details form and cloud-save recovery (2026-11-02)

## Incident: cloud save rejected on a new World Stone draft
Observed in authenticated Supabase project logs (about 15:04–15:13 UTC): repeated 403 POST /rest/v1/quotes and PostgreSQL `new row violates row-level security policy for table "quotes"`. The session belonged to an existing organization owner. Existing `quotes_insert_editor` and `quotes_read_org` RLS policies remain intact.

Previously `syncNormalizedQuotes` used PostgREST `upsert(... onConflict organization_id,id)` for **both** new and existing quote IDs. The read rule delegates to `private.can_read_quote`, which looks up **existing rows**; an ON CONFLICT path can require read/update permissions before a brand-new row is visible. New quotes now use INSERT without conflict merging, while pre-existing, server-visible IDs retain guarded upsert. `acceptedQuotes` still requires matching signed-in owner, organization, and timestamp. No schema migration, policy change, privileged key or security-definer bypass. An invisible existing row triggers a safe duplicate-key error rather than assuming overwrite authorization.

**Critical verification pending:** This change requires a fresh Cloudflare deployment and a retry by the same authenticated user. Verify Saved to cloud (not merely saved on device), reload and reopen, and confirm sections, lines, private costs, revision history and document names persist. Confirm the new ownerless/stale drafts are not silently replayed. If 403 remains, inspect the response body and read-only Postgres logs before another change; do not weaken quote RLS. Do not clear browser site data while a pending draft exists.

## Details page layout
- Narrow 430px max-width, one column regardless of viewport; full width on phones. Cards ordered Customer, Deal details, Notes.
- Deal Advanced disclosure contains CRM deal linkage and the entire Document & revisions panel. The timeline, status and prior customer copies remain accessible; no data migrated.
- Removed the redundant Continue to takeoffs card. The existing persistent Details footer now follows the next Area shortcut, including starting the first Area, reopening an existing Area, or sending a user to the Area builder.
- Removed the extra desktop header for Quotes Beta (the left sidebar has documents and undo/redo already). Phone header keeps Back, status and global navigation, including Settings.
- Removed in-Beta Classic buttons from Quote, Area, Review and Team; switching editors remains available from Settings → Beta Features.
- Keyboard: Tab uses native focus order; Enter in normal text/email inputs advances to the next visible field, while CRM suggestion menus own Enter and textareas keep newlines. Passing focus to the next card scrolls that card into view; reduced-motion selection is honored for the Enter shortcut. The advanced disclosure remains keyboard-operable.

## Acceptance list
1. Confirm active app commit is at least this patch; retry a **non-issued** failing draft while preserving its local cache. Confirm `Saved to cloud` and reopen after reload. Then create a second fresh quote and save.
2. At desktop 1280–1440px confirm three cards form a 430px column with no secondary toolbar and a visible review panel at right; phone form fills available width without horizontal scrolling.
3. Tab Customer company→contact→email→date→address→Division; press Enter in ordinary fields to progress, and Arrow/Enter in CRM suggestions to select without accidental navigation.
4. Expand Advanced: CRM deal links, document type, draft status, revision label and frozen historic documents accessible, with correct permissions. Close/reopen without changing data.
5. Confirm last text field → next section scrolls naturally, textarea Enter makes a newline, and screen-reader keyboard focus remains visible.
6. From Details bottom CTA, create first Area; from Details again reopen that same Area (no duplicate). No Continue to takeoffs card.
7. Use Settings → Beta Features to switch to Classic and back, preserving same quote, measurements, prices and sync state; no direct Classic buttons in Beta.
8. Retest signed/issued customer revision immutability, privacy, role restrictions and Cloudflare production bundle. Manual Visual QC still required before release acceptance.
