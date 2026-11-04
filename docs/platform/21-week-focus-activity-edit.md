# Home 7-day focus and editable Activity preview — 2026-11-04

## Desktop week focus
- Selecting **7 days** gives Home two columns: a compact week strip above the selected day's agenda on the left; Recent Quotes/Activity on the right.
- The redundant weekly summary list is hidden. Short agendas start at the top. A busy day scrolls within the same fixed-height area.
- **Month** retains its existing three-column layout; mobile retains its stacked layout. The saved display preference continues to work.

## Activity preview/edit
- The Activity drawer now follows the active appearance palette throughout, including its header, section backgrounds, notes, links, and footer. Long notes use consistent readable typography.
- An authorized user can select **Edit activity** inside a manually logged Activity, then change method, completed timestamp, notes, and related People/Companies/Deals/Quotes.
- Multiple People are stored in the existing Activity metadata JSON. The primary ID columns stay backward-compatible; no new database migration is required. New Activity logs also preserve full associations.
- Preview displays all links. Unlinking is explicit; a Company is not silently re-added through a Person or Deal.
- Unsaved editing uses account-scoped local recovery by Activity ID. Back or Close preserves an unfinished correction; Discard clears it; a confirmed Save clears it.
- Cloud edits must be acknowledged by the normalized activities row under RLS before changing the local CRM cache. Original author attribution is retained, and correction time/editor metadata is recorded. Identity changes in flight are guarded.
- Cleanup logic recognizes additional Person, Deal and Company links before deleting related records.

## Acceptance checks
1. In desktop 7-day mode, switch between dates with one and eight items; the calendar height must not jump. Verify week above agenda and Recents at right.
2. Switch to Month; the previous three-column layout should remain.
3. Edit yesterday's Activity note, save, reload and verify the change.
4. Add a second Person, save, reopen and click both preview links; remove one and confirm it stays unlinked.
5. Type a draft and close without saving; reopen and confirm recovery. Discard separately.
6. Reject future timestamps, deny editing another user's activity without authorization, and never edit automatic audit events from this panel.
7. Verify light/dark styling, narrow mobile viewport and cross-device cloud sync.

Full TypeScript/Vite and live browser checks were not run as part of this GitHub-only development batch.
