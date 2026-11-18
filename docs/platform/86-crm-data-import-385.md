# #385 — Review-first CRM CSV/Excel Import

**Feature:** Tools → Import, November 18, 2026. Source is submitted to the existing Cloudflare build gate; a green build is not a substitute for authenticated browser testing.

## What works

1. Pick **Companies**, **People**, or **Deals**. The tool imports one record type at a time so a user can first import Companies, then link People and Deals to them.
2. Upload a **CSV**, **XLSX** or **XLS** file, up to **2 MB**, with a header row, at most **50 columns** and **500 data rows**. For Excel files, choose the worksheet. Parsing is performed in the browser; the raw file and preview are not stored in browser storage or uploaded to a separate service.
3. Get suggested mappings for known common column names. Manually change or unmap optional fields. Supported Company fields: name, classification. Person fields: name, email, phone, job title, linked Company. Deal fields: name, linked Company, stage, pipeline, amount, due date and next action. A downloadable sample CSV is available for every record type.
4. Review **Ready**, **Already exists** and **Needs review** rows in a scrollable table. The name field is required. Invalid dates, unsupported stages/pipelines, malformed amounts, unknown classifications, bad email, repeated in-file IDs, ambiguous name matches, and unresolved Company links are flagged. Company links use existing exact normalized names or aliases; ambiguous or suffix-similar names are never guessed.
5. Confirm the explicit checkbox to **Create only Ready rows**. Existing, uncertain and invalid rows are not written. No overwrites, deletes, merging, new linked Companies, or auto-generated People↔Deal associations.
6. Actual created rows use **the existing CRM create/link operations** (Company resolution, Person creation, Deal creation, explicit Deal/Company link). These retain the current record model, creation Activity history, and local recovery behavior. In cloud mode the tool waits for a normalized CRM upsert acknowledgement before reporting a confirmed save. On failure, it reports the locally created row count and uncertainty; it does not blindly retry or claim cloud success. Refresh/review deduplication prevents unnecessary replay.

## Security boundaries

- The tool is behind **Tools**, respects the same CRM edit capability check, signed-in account/organization presence and role-perspective guard, and requires CRM hydration before import.
- The Import component is remounted on identity changes. The commit step also checks identity before each row and again around the cloud confirmation.
- No bypass of existing Supabase RLS, no new SQL tables, policies, exposed public API, cloud storage bucket, provider permission or background task.
- Shared custom field definitions and field **values** are NOT imported: those need a safely deployed tenant-secured schema and tested RLS first. Imports use supported *core* fields only.
- Importing cannot provide all possible cross-file external-ID relations automatically. In v0.1, People and Deals link only to existing Companies by **reviewed exact identity**, so import Companies first.
- The preview uses the first 60 rows for display, but checks every row up to 500. If any rows are flagged, they remain skipped unless source data is corrected and the file reviewed again. This is an additive conservative importer, not a bulk overwrite/upsert tool.
- Browser-local import files never persist across tab reloads or account switching. Actual CRM creation is persisted by the existing CRM repository and cloud sync.
- If a cloud commit fails after some records were created, users must check records and sync rather than assume an atomic all-or-nothing transaction; the importer explicitly reports this. Multi-record atomicity would need a server-side migration/process.

## Acceptance checks

- [ ] TypeScript, Vitest quick-quote tests, record gate and Vite green for exact SHA in Cloudflare.
- [ ] Tools → Import appears in desktop and mobile section navigation, with no header collisions at narrow desktop and tablet widths.
- [ ] Download each sample CSV and upload it. Suggested field mappings should be selected. Review prior to saving, note sample Company reference is not created automatically for People or Deals.
- [ ] Company file with 2 new, 1 exact duplicate and 1 suffix-similar name: count as Ready=2 / Existing=1 / Needs review=1; only Ready records created.
- [ ] Import Company first, then Person with its exact Company name, then Deal linked to same Company with valid current stage/pipeline/due date/amount. All links and history retained after reload.
- [ ] Upload Excel with two worksheets; switch worksheet and confirm mappings/review are rebuilt. Oversized, invalid and formula-dependent sheets must be rejected or flagged, not silently invented.
- [ ] Viewer, role perspective, missing organization/identity, unhydrated CRM: cannot create. Switching account/org while upload is parsing should not leak file contents to another workspace.
- [ ] Cloud mode: verify normalized Company, Person, Deal rows and Activity history from a newly created test account; confirm RLS prevents foreign-tenant records.
- [ ] Intentionally simulate a cloud save failure and confirm the UI clearly reports partial/local data and does not offer a blind re-submit.
- [ ] WARM/LIGHT/DARK and desktop/tablet/phone: mapping, table overflow, active button, input focus and confirmation checkbox remain usable.

## Follow-up

#385b can add explicit, **reviewed** Person↔Deal relationship mapping from stable external IDs after the initial creation flow is authenticated and verified. A separately approved import job with an import ledger and a server transaction would be required before supporting unattended jobs, large files, background scheduling, or transactionally atomic batch commits. Do not touch CAD-Lite, Google Sheets export, or shared custom-field migrations here.
