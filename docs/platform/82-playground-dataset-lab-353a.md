# Batch 353a — Repeatable manual datasets in the Developer Playground

Date: November 16, 2026
Status: Source implemented; TypeScript/Vitest/Cloudflare build and interactive manual QA pending.

## Purpose

A repeatable **import → test → reset → reimport** loop without a paid Supabase branch or any possibility of deleting a real customer workspace. SalesShop already has a disconnected Developer Playground, accessible only after platform Developer authorization. This batch uses its existing local-only storage partition and Reset demo control.

## How to try it

1. In Platform Studio, open **Developer Playground**.
2. Open the floating **◇ Playground** controls.
3. Choose **Download sample JSON**. The fixture includes five fictional Companies, four People, six Deals, two Activities, three Quotes and three Tasks.
4. Modify the JSON in a text editor: create different combinations of stages, pipelines, pricing, follow-ups and relationships.
5. Upload the file using **Select a JSON file to preview**. Inspect counts and the reported validation errors. Nothing imports before confirmation.
6. Choose **Replace local test records** and confirm. The Playground reloads with exactly that CRM, Quote and Task dataset. Other Playground preferences persist.
7. Run normal manual operations, report results, then choose **Reset demo** to wipe only the dedicated Playground browser namespace. The original fictional sample loads again. Repeat with a different file.

## Import format

`format: "salesshop.playground.records"`, `version: 1`. Root arrays `companies`, `people`, `deals`, `activities`, `quotes`, `tasks` are required, but each may be empty.

Record IDs must start `demo_`; quote numbers must start `DEMO-`; email addresses must end `.example`. Links among Company, Person, Deal, Quote, Task and Activity must resolve within the same file. Unknown properties (including authorization IDs or submission proof), unrecognized fields, duplicate IDs, bad dates, invalid numbers, forged signed quotes or quote-delivery activities reject the **entire file**. A 250 KB limit and record-count ceilings apply.

All imported records are materialized to current app document contracts:
- `crm`: normalized Company, Contact, Project and Activity entities.
- `quotes`: simplified quote documents and saleable line items; Draft/Ready/Sent only. These are **not** real delivered/signed proposals.
- `tasks`: personally scoped browser-only Tasks, optionally linked to imported Deals.

The import is a **replacement** in the disconnected Developer Playground, not an additive CRM import. It never calls a Supabase API, publishes customer records, or makes a cloud schema change. The existing Playground access gate confirms platform Developer identity before mounting the actual workspace.

## What this does not yet cover

- Import into a **normal new cloud SalesShop account**; production tenant records must not be overwritten with a browser import. That requires a separate role-gated, empty-workspace guard and clearly audited/imported ownership.
- An **account-wide cloud reset**. This is intentionally not implemented without a server-enforced sandbox flag, proper authorization, transactional deletion and a non-customer-data guarantee. Reset demo is complete only for the isolated local Playground.
- Test real RLS boundaries and multi-user sharing. Browser-only mock data cannot validate PostgreSQL RLS. Separate local PostgreSQL test execution remains necessary before live custom fields.
- Complex customer quote revisions, signed approvals, external quote proof, catalog import, Notebook histories, project phase timelines. The Playground itself still supports manually exercising their existing editors, but the JSON format currently imports the six listed record types only.

## QA checklist after deployment

- Generate file, immediately import it, verify Companies/People/Deals/Activities/Quotes/Tasks and correct associations.
- Edit a Company, move a Deal, create a Quote or Task. Reset demo. Confirm original state returns.
- Upload a malformed file; verify no data was changed.
- Test with non-Developer identity and ordinary SalesShop cloud login: no Playground access and no tenant document changes.
- Test mobile panel scrolling, file picker, Warm/Light/Dark palettes.
- Confirm actual Cloudflare green for exact deployed SHA; a source-only assertion is not browser proof.

## Next

Build an optional **new-account importer** with CSV/JSON mapping, deduplication and cloud-side preflight; separate an audited **test-workspace reset** feature from ordinary customer data deletion. Both should share the pure validation/mapping model, but a cloud reset must not borrow the local Playground's unconditional namespace clearing.
