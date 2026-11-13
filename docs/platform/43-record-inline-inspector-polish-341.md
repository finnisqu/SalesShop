# Batch 341 — Record inline editors, read-only safety and shared inspector polish

## Objective

Make Company, Person and Deal record editing predictable in desktop and mobile without replacing the existing compact About panel, Record sections, relationship navigation, or CRM stores. The read-only Board preview follows the same edit permissions.

## Changes

### Per-record inline edit coordinator

- A new testable `createRecordInlineEditGuard()` owns an individual record's active About-field edit. A second field cannot open until the active field is saved or canceled. This prevents a partially typed value from being silently displaced.
- `RecordInlineEditScope` provides that guard to the existing `RecordInlineProperty` components, and the shared `RecordPageLayout` attaches the provider without adding a new DOM box or altering layout widths.
- Company, Person and Deal pass **stable record IDs** through `recordKey`. Navigating to a different record resets the edit scope; renaming a record does **not** reset it.
- An editor releases its claim on successful Save, Cancel/Escape, permission withdrawal, or unmount (including conditional Account forecast properties).
- Other fields' pencil controls become temporarily disabled with a contextual tooltip while an inline edit is active; the existing Save, Cancel, error, focus restoration and keyboard behaviors stay in place.
- Added shared disabled-pencil styling for WARM/LIGHT/DARK and mobile touch targets.

### Permission and validation parity

- All three record pages now close the full-page editing/unlink mode if editing permissions are withdrawn or a read-only perspective is activated.
- Their full-page Save handlers reject stale submissions when CRM editing rights are no longer granted, even if a form managed to remain on screen.
- **Deal** no longer exposes an Edit Page action to read-only users; it now follows Company and Person behavior.
- The shared More/Actions menu indicates read-only mode and prevents its trigger from opening unavailable operations.
- A Board quick preview only offers its Edit action when the user can actually edit CRM records.
- A Person inline email edit cannot remove the contact's last remaining name/email identifier. The existing email-format check still runs.

### Tests

- `src/services/recordInlineEditing341.test.tsx` adds eight regression cases for lock ownership, release, separate record scopes, compact rendered controls, permissions, and Person identity validation.
- The Batch 332 legacy Record inline test now expects the new successful-save release call.
- The Batch 341 tests are registered in `test:quick-quote`, executed by Cloudflare's existing `npm run build`.
- Static source-consistency checks passed; full TypeScript/Vitest/Vite and browser validation remain pending external build confirmation.

## Suggested QC

1. Open Company → About, edit its Name, then try to edit a different About property. The first unsaved value should remain intact and the second pencil should be temporarily disabled.
2. Press Escape on the first editor. The record should stay open, the original value should remain, keyboard focus should return to the pencil, and a second property can now be edited.
3. Save a Deal amount or a Person phone number. The editor should close and return keyboard focus to that same property, without shifting or stretching the About panel.
4. Start editing a Company, then navigate to a different Company. The second record must start with no editor open and no draft carried across. Rename the current record and confirm its stable identity is preserved.
5. Switch to a read-only Owner perspective or Viewer permissions during a record edit. The full edit form should close; Save actions must not still mutate the CRM record.
6. Check the Board's Company/Deal preview in read-only mode: the Edit action must not be available. The read-only More menu should not open.
7. On a Person with no Name and only Email, try to clear Email inline. The editor should show the required identifier error instead of producing an unnamed contact.
8. Inspect relationships, private Tasks, and quote links. Existing confirmed Unlink buttons, deletion safety checks, and recorded historical Activity should behave unchanged.
9. Check phone and desktop layouts in WARM/LIGHT/DARK. Disabled pencil controls should be visually distinguishable; focus and touch target sizes should remain accessible.

## Next

Batch 341b: record quick-preview action parity, linked-record navigation, and inline save/error feedback in Tasks and Activity inspectors. Then Batch 342 mobile sheets/keyboard UX. Deal timeline/Gantt remains deferred.
