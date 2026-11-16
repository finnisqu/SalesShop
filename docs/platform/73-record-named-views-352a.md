# Batch 352a — Named Records views (columns, sorting, page size)

Date: November 15, 2026  
Branch: `main`  
Release gate: source reviewed; Cloudflare TypeScript / Vitest / Vite and authenticated mobile/browser acceptance pending.

## Original roadmap request

The user's November 12 SalesShop roadmap calls for **customizable fields and views**, not merely consistent styling. Existing Records worktables already remember *one* local column layout, sort choice and page size for each directory. They could not save or revisit several named arrangements. This first low-risk #352 batch adds reusable view presets before any changes to business data or custom-field schemas.

## Implemented in #352a

1. A **Views** disclosure appears beside the existing Columns menu in shared Records worktables (excluding Catalog Tags' special pagination mode). It uses the existing WorktableChrome/viewport-bound, dismissible popover, stays within the single worktable toolbar, and supports mobile touch targets and theme variables.
2. **Save view** names the current table presentation: visible columns and their order, current sort key/direction, and rows per page. A view name is limited to 48 characters, duplicate names are rejected case-insensitively, and each directory can contain at most twelve views.
3. **Apply** restores the chosen layout, sort and page size and returns pagination to page 1. Current row selection clears to avoid bulk actions on records outside the new layout. Applying a view never creates, edits, deletes, archives, or changes permissions for CRM data.
4. **Modified state:** after applying a saved view, the toolbar indicates which view is selected and whether current presentation differs. **Update selected view** saves the new column/sort/page configuration into that named preset. **Delete** requests confirmation and removes the preset only. Existing Columns `Reset columns`, sort toggles and page-size controls continue to work independently.
5. **User- and directory-scoped storage:** presets and the selected view ID live in the browser's localStorage with keys that distinguish local mode, signed-in account, organization, and directory. A shared device will not show one cloud account's named views in another's menu. The existing default column/sort/page preferences remain unchanged and device-local; no Supabase or new database schema is introduced.
6. **Schema resilience and input validation:** `src/services/recordSavedViews352a.ts` validates untrusted stored values, discards malformed/duplicate view IDs or names, drops removed column keys, preserves the mandatory Name column, and falls back from missing sort keys or unsupported page sizes. No arbitrary code, filters or SQL are accepted from local storage.
7. **Testing:** `src/services/recordSavedViews352a.test.ts` covers account/directory isolation, restore, corrupt data, schema changes, duplicate names/IDs, view limits, immutable update/delete, modified state, and worktable integration. Added once to the project's `test:quick-quote` Cloudflare build gate. Existing #350 column-order/density tests are intentionally not changed.

## Deliberate scope boundaries

- These are **named presentation presets**, not new record fields and not a replacement for the current filtering interface. The first version saves **columns, sort, rows-per-page**, but does not save external per-page filter chips or broad CRM custom-field definitions. The UI accurately lists what is included.
- Named views are **private to the current browser/account**, not synced across devices or shared across a company. User/org IDs isolate keys, but localStorage is not a server-side access-control mechanism. This is the safest first release before designing organization-wide customization permissions and data storage.
- No change to Quotes, prices, signed contracts, CRM property tables, RLS/Auth, cloud synchronization, document sharing, or protected bid Tasks.
- Future customized fields must have explicit type, validation, visibility, ownership and permission rules. They should not be improvised as arbitrary JSON on customer records without reviewing cloud data and reporting/export behavior.

## Acceptance checklist once Cloudflare is green

1. In Records → Companies, set a two-column compact layout, sort by name, set 25 rows; save it as “Outreach”. Change layout/sort/page size, save “Operations”, then Apply each and verify the exact presentation restores and current selection clears.
2. Modify the selected view's columns, observe **Modified**, press **Update selected view**, navigate away/back and reapply; verify the saved arrangement, display, sort and rows-per-page.
3. Try duplicate names with casing/spaces, empty names, and view 13; expect helpful validation, no data loss. Delete one named view after confirmation and verify it disappears without deleting CRM rows.
4. Navigate Companies → People → Deals → Tasks and confirm named views remain directory-isolated. Check a different signed-in account on the same browser does not inherit another account's presets.
5. Confirm existing Columns, Filters, sorting, pagination and pinned records still work normally. The Views and Columns disclosures should not overlap, including near screen edges and the mobile keyboard.
6. Reload the browser after saving; verify named presets persist on the device. Test WARM/LIGHT/DARK and portrait mobile layout with ≥44px controls, viewport popover clipping and safe-area behavior.
7. Verify untrusted/corrupted localStorage and removed catalog/record columns are handled without crashes. No cloud data should be changed when managing named views.
8. Run `npm run build` (`tsc --noEmit`, full quick quote suite, record gate, Vite) and inspect the Cloudflare deployment SHA. GitHub status checks are not proof of a successful Cloudflare publication.

## Next #352b

After any reported build errors, design and implement the **first real custom-field definition** capability with clear scope and durability. Start with a field schema and permission model for Companies/People/Deals (e.g. text, number, date, choice); decide which definitions are personal vs organization-owned, how values are stored securely and exported, and how fields become first-class Records worktable columns and picker/search attributes. Avoid modifying production RLS/schema without the user's explicit review. Preset-saved filters and device sync can be scheduled as follow-on enhancements. #353 Proposed Records and #354 BYOS/email remain subsequent roadmap priorities; multifamily Gantt remains deferred.
