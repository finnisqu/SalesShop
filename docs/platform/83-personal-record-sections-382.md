# #382 — Personal left-panel record tab presentation

**Implemented scope:** Company, Person and Deal record pages; per-browser, per-account and per-organization, using the reviewed CRM Setup profile from #380.

## What now works

On each record type, **Settings → CRM Setup → Customize → Record page arrangement** controls the presentation of the *left* record-panel tabs:

- **About** is always visible and accessible. It follows the saved Details position in the personal tab order.
- **Files** and **Notebook** can be reordered, or removed from the primary tabs. When hidden, they remain available in a **More sections** menu in that same panel header.
- When a hidden tab is selected through More, SalesShop displays its content and a temporary active tab until the user visits another section. This does not discard or unlink any files or Notebook pages.
- Unconfigured/record-specific tabs, including **Forecast** on Company and **Email** on Person, retain their original slots and remain visible. Configured tabs are sorted into their own slots.
- Changes are individual to the logged-in user and workspace. An absent or invalid Setup profile uses the existing tab presentation.

## Explicitly unchanged

- **Connections** and **Recents** remain visible, regardless of the broader Setup blueprint, to preserve link, task, quote, and activity actions.
- This does not move whole columns, alter the live pipeline, share layouts with teammates, change record content, or activate new custom fields. Those broader column-layout choices remain preview-only.
- Server permissions, Supabase authorization, and all related record mutations remain unchanged. No migration or background task is involved.
- The original record header and tab tools are retained; the new menu follows the shared panel styling and uses the existing dismissible-details behavior.

## Acceptance checks

- [ ] Cloudflare build, TypeScript, existing regression suite, record gate and Vite are green.
- [ ] Save a Company arrangement with Notebook before About and Files hidden. Open a Company record: About/Notebook should reorder, Files should be under **More**.
- [ ] Select Files from More: file links appear normally and the tab becomes selected; switch back to About to retuck Files.
- [ ] Different arrangements for Person and Deal must not affect Company.
- [ ] Person Email and Company Forecast should remain present and editable; Deals/Tasks/People and Quote/History actions should remain accessible.
- [ ] Unsaved setup edits must not change live tab order; a saved profile should survive reload.
- [ ] Switch user or organization; verify the other identity's profile is used, with no cross-account display leak.
- [ ] Try narrower desktop and phone, light/warm/dark themes, including keyboard navigation and menu dismissal.

## Next steps

Apply full responsive column placement only after a design/QA pass that preserves the persistent context and operation access in the three-column Record layout. The wider CRM Setup field/stage/terminology plans still require explicit safe implementation. Team-shared configuration and custom-field values remain blocked pending approved disposable Supabase/RLS validation.
