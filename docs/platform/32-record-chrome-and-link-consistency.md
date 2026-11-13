# Batch 332e — Record inspector and linked-control consistency

## Shared components and scope

- `RecordPageLayout`: Company, Person and Deal record headings, breadcrumbs, three-column panels and mobile Details / Records / Related section navigation.
- `RecordInlineProperty`: one-at-a-time About-field editor, which preserves the location of a field instead of reflowing the panel. It now has form-level Escape for text/select/date/number/email, delayed keyboard focus restoration after Save/Cancel and error clearing on both input types.
- `RecordActionsMenu`: shared record-level More menu with deliberate Delete confirmation and existing CRM safety checks. The native-details popover now uses the same viewport-aware positioner as Worktable Filters, Actions and Columns.
- `RecordUnlinkButton`: shared confirmed Unlink action for `RecordUnlinkAction`, `RecordTasksPanel`, and both Deal–Person relationship directions. It owns visual semantics, confirmation, busy/error state and accessible labels; it does **not** grant permission or decide whether a link may be removed.

## Protected behaviors retained

- Internal SELF-company roster relationships cannot be removed through the ordinary CRM unlink action.
- Issued, archived and signed Quotes are never unlinked by an editable-Draft relationship action.
- Bid-submission Tasks remain protected from manual unlink.
- Person/Deal relationship removal still uses its original cloud store and keeps retry/error handling.
- Organization/role preview restrictions are checked by each owning component. The shared button is not an authorization layer.
- Record deletion still goes through the existing confirmation and CRM dependency safety checks. No new deletion path or schema mutation is introduced.
- The native Quote document editor and Quote metadata view remain specialized; their customer content and permissions are unchanged.

## Regression checks

- `src/components/RecordChrome332.test.tsx` covers read-only vs editable markup, shared editor Escape/validation/focus behavior, More menu positioning/focus, shared Unlink controls, and mobile control height.
- `src/components/RecordPageLayout.test.tsx` now verifies all three labeled jump destinations are programmatically focusable, with `tabIndex=-1` so they do not inflate normal Tab order.
- `src/components/RecordPageConsistency.test.ts` confirms that explicit confirmation moved into the shared Unlink component, while original Quote/Task safety guards remain.
- Existing worktable viewport and record management tests remain registered. New RecordChrome tests run in the normal `test:quick-quote` build gate.

## Visual acceptance to complete after a successful build

1. Company, Person and Deal: Edit Page / More / Activity / + New have consistent dimensions and visible focus across WARM, LIGHT and DARK themes.
2. Inline property edit, select, Save and Cancel: focus returns to the same edit button; Escape does not close the whole inspector; invalid values remain in place with an alert.
3. Record More on a phone with the keyboard raised: menu stays within the visible viewport, and deletion remains guarded.
4. Linked CRM / Task / direct Deal–Person Unlink buttons: same appearance, clear confirmation, no accidental removal, no Edit mode permission bypass.
5. Mobile Details / Records / Related jumps: scrolling goes to the right region, keyboard focus follows and a visible focus indicator appears.
6. Record previews, native Quote metadata and private Tasks remain navigable without new scroll parents or overlapping popovers.

Full TypeScript/Vitest/Vite, actual authenticated Supabase checks and real-device visual QC are still pending; source-level assertions are not a substitute.
