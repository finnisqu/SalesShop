# November 2 — Task associations popover and directory hardening
## Related records picker
- The task form's record search list is now a viewport-positioned portal rather than a flow child. It cannot push Type, Priority, Status, or other task fields down.
- Search results reposition on task-dialog scrolling and viewport changes, open above the field when bottom space is insufficient, and retain the selected-record chips.
- Escape, outside click and moving focus away close the popover. Arrow keys navigate matching options; Enter links a highlighted record without accidentally saving the task.
- Color tokens are passed from the task form to the portal for light/dark compatibility.
- Cloud-mode Task Editor offers only current user's quote associations; existing saved associations remain preserved.

## Shared table hygiene
- Missing/outdated saved column keys safely fall back to defaults. The Name/Document/Task column is mandatory so users can always open a record.
- LocalStorage failures are non-fatal: no loss of access to tasks, companies, or Sales Documents.
- Numeric amounts and raw ISO timestamps sort accurately, while display date and currency formatting remains user-friendly.
- Tasks initial table sort emphasizes deadlines and priority; Sales Documents initially sorts by recent update.
- Tasks' Priority table column uses the stronger existing priority indicators.
- On desktop, Sales Documents uses one table-header sorting UI; the mobile legacy sort selector remains.

## Manual verification
1. Create/edit a task; focus Related Records; ensure no form layout jump. Search several company/person/deal/quote names. Add and remove several records. Scroll form, use arrow/Enter, click away and Escape.
2. Try both small mobile viewport and dark/warm/light themes; verify the popover stays inside viewport and anchors above when near the bottom.
3. Confirm private cloud account cannot search other users' quotes through new task associations.
4. Verify desktop table columns persist; hide/reorder, reload; date and money sort numerically; name always openable; pinned comparisons and bulk actions continue functioning.
5. Verify Cloudflare build; browser and cloud persistence checks remain separate from source review.
