# Board quick Deal creation and record page consistency — Nov 11, 2026

Draft release: [PR #104](https://github.com/finnisqu/SalesShop/pull/104).

## Scope

- Desktop navigation: Home → Board → Tasks → Connections → Quotes → Catalog → Notebook.
- Board > + Deal: polished name input, optional More details with searchable/create-new Company and People and bid due date. New Company/People names remain staged until Create deal. No CRM records should be created on cancel.
- Company, Deal and Person record pages: inline pencil editing for individual About properties, with original read-only layout retained until click. Full Edit Page remains available for multi-property edits.
- Record header ellipsis: Unlink connections mode and guarded Delete record where supported; no delete for SELF Company or internal roster members.
- Recents in center column: Quotes and Activities tabs. Tasks immediately after. Company and People relationships on right.
- Unlink styling aligned across CRM records, direct Deal contacts and private Tasks; protected bid tasks and immutable quote history stay protected.

## Human release checks

1. Desktop (wide screen): verify global nav order. Board > + Deal > enter only name > Save. Confirm new card stays on Board.
2. Board > + Deal > More details: select existing Company, select two existing People, enter bid due date. Save. Confirm the Deal card, Deal record, direct People relationships and task due date. Reload and check again.
3. Repeat with new Company and new Person; cancel first and ensure neither is created. Then save once; confirm no duplicates.
4. Company/Deal/Person About: hover/focus pencil, edit one property and save. Ensure position, property width and surrounding panels do not jump. Check dark theme and mobile.
5. Ellipsis > Unlink connections: select a direct relationship, confirm unlink. Verify the underlying record remains accessible, and the history of issued Quotes stays unchanged. Confirm private Tasks can be unlinked and generated bid-submission Tasks cannot.
6. Ellipsis > Delete record on a disposable record with no protected relationships. Verify confirmation, permanent deletion and return to collection. On a record with CRM history, deletion must refuse with a clear message.
7. Recents tabs: switch Quotes ↔ Activities for a Company, Deal and Person. Confirm historical external quote submissions appear as Quotes, and Activities do not bleed across unrelated records.
8. Check mobile layout and touch targets on 390px phone, plus desktop ~1280px. Confirm no clipped menus.

## Release policy

This PR should remain draft and unmerged until the current head passes TypeScript, unit tests and Cloudflare preview. The tests added in `RecordPageRedesign.test.tsx` are source-layout regressions, not authenticated browser tests. Browser visual and multi-account data isolation are separate manual release checks. The legacy sink pricing PR #95 is a separate release candidate.
