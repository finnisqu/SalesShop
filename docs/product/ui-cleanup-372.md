# Build #372 — Quote continuity and record-page UI cleanup

## User-reported issues and delivered changes

- Quick-preview footer had an unconditional flex row with overflow-x and redundant Record external quote. Deal preview now offers New Task, Log Activity, Edit, Go to page in a 2×2 fit-width layout; external quote recording remains on the full Deal and Quotes workflows. Quote/Person quick previews share the same adaptive footer.
- The selected, personally owned, non-archived Draft/Ready Quote appears as a contextual pseudo-tab at the end of the desktop primary nav and as a **Working quote** option in the mobile menu. It uses the existing authorized `openQuote(id)` route and quote store. Navigation away from Quotes does not clear the current selection or document. No extra permanent main tab or duplicate editor state.
- Quote editor Draft/Ready status is clickable when existing `canPermanentlyDeleteQuote` and ownership/permissions allow deletion. Its popover includes Back to documents, independent copy, and Delete this Quote draft; Delete opens the existing modal with eligibility rechecked at confirmation and clearly warns that deletion is permanent. Never silently deletes an issued/revised/signed document.
- Company, Deal and Person full pages now arrange existing cards into **tabbed resources** at left, **Connections** (Deal/People/Tasks) at center, and right-side **Recents** with Quotes, Activities, History. Existing record action components and direct-ID associations are reused instead of copied. The legacy inline help/record history stays available behind tabs; no CRM record migration.
- Deal People rows explicitly use a minmax(0,1fr) text column plus fixed Log action, normal text wrapping and no vertical slivers.
- Tools desktop tabs now style active aria-selected/aria-pressed states. Global calendar popover day cells have theme borders matching the embedded month grid.
- Global Task Create uses the local calendar day when its incoming request has no date; the existing TaskEditor also defaults to local Today for uncoupled new Task forms, preserving supplied and recovered dates, plus the blank due date of existing Tasks.

## Boundaries / manual acceptance

CAD-Lite remains **on hold**. No Supabase schema/RLS, Quote data format, prices, customer delivery, automations, or provider permissions changed. Browser route and quote store still own draft persistence and integrity.

After a green build: create a Draft and work in it, navigate Home, Records, Notebook, Tools; use the temporary desktop/mobile draft tab to resume; delete an eligible draft via status and verify it disappears; ensure issued/archived Quotes offer no delete there. Open Company, Deal, Person and switch all three column tab groups. Test relationship navigation, task quick view, external Quote entry on the full Deal; verify screenshot Deal People row and quick preview at 390px and desktop. Create Task from Home and Records (default Today), explicitly remove due date, and test another task with supplied date. Check Tools tabs and the global calendar popover in WARM/LIGHT/DARK.

Tests: `uiCleanup372.test.ts` added to existing gate; unchanged prior record, quote, task and navigation regressions must still pass. Real authenticated browser/device acceptance is separate from TypeScript/Vitest/Vite pass.
