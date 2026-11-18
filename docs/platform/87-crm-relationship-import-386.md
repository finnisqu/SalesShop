# #385b — Review-first Deal–Person relationship imports

**Scope:** Tools → Import → Link People to Deals. Source prepared November 18, 2026. Cloudflare build and authenticated browser checks are required before declaring the feature deployed.

## Workflow

1. Import Companies, People and Deals with **#385** or create them normally.
2. In **Tools → Import**, select **Link People to Deals**. Upload a CSV, XLSX or XLS file (same 2 MB, 500-row, 50-column limits as #385), choose a worksheet when needed, and review the suggested field mapping.
3. Identify an existing Deal with its **SalesShop Deal ID** or exact Deal name. When multiple Deals share a name, the Deal Company column can disambiguate by its existing exact name/alias; otherwise supply the SalesShop Deal ID.
4. Identify an existing Person with its **SalesShop Person ID** or unique email. Name alone is insufficient. When extra identifiers are supplied, they must **agree** or the row is blocked.
5. Optionally supply a **Relationship role** (such as Estimator, Architect, General Contractor). The role applies only to a newly created link; existing links and existing roles are never updated.
6. Preview each row as **Ready**, **Already linked**, or **Needs review**. Select individual Ready rows or explicitly select all Ready, then check the separate confirmation checkbox. Unapproved, ambiguous and already-linked rows are skipped.
7. The import uses **the existing `useDealPeopleStore.add(dealId,personId,role)`** path, honoring its organization-scoped Supabase insert confirmation and duplicate protection. It never creates new People/Deals or modifies Company, Person, Deal, Quote, or activity records.

## Matching and consistency

- SalesShop IDs are exact internal identifiers, **not** arbitrary external CRM IDs. Imported files from external CRMs should use unique email and unambiguous Deal names/Companies unless their ID columns already contain genuine SalesShop IDs. No external-ID table or persistence migration is introduced.
- Deal names and Person names use normalized exact comparison, **not fuzzy matching**. Person email matching is normalized and must produce exactly one record. No name-only Person inference. Company names use exact normalized names/aliases and must produce a single match.
- If a source row supplies multiple identifiers, all supplied identifiers must refer to the same existing record; contradictory IDs, names, emails or Company references fail review.
- Existing links are detected in the loaded scoped `deal_people` store; repeated link pairs within a file are flagged. Every selected row is revalidated against the **current** CRM and relationship store just before saving. Any resolution change stops the import rather than linking a different record.
- A user may select no rows without any write. Every selected index must refer to a unique Ready row from the full preview. The interface never auto-approves matches.
- Saves are sequential. If a later link fails (server permission, a concurrent duplicate, or network), previously acknowledged links remain; the UI reports the partial state and asks for a fresh review. There is **no promise of atomic multi-row transactions**.
- Identity, CRM edit capability, role perspective, CRM hydration and exact link-store scope are verified before and during import. The parent Import component remounts per identity; uploaded raw spreadsheet contents are never saved for reuse after switching accounts.
- No bulk delete, merge, overwrite, background job, new server endpoint, migration, Supabase policy change, external email, or custom-field publishing.

## Manual acceptance checklist

- [ ] Cloudflare build of exact commit passes `tsc --noEmit`, Vitest quick test suite, record gate and Vite.
- [ ] Tools → Import shows **Import records** and **Link People to Deals** modes, usable on desktop, compact desktop and phone in WARM/LIGHT/DARK.
- [ ] Download sample Link CSV, replace placeholder identifiers with a real Deal name+Company and unique Person email, upload, and confirm suggested field mappings.
- [ ] One Ready link: manually select and confirm, save, open Deal and Person records, and verify the direct relationship and optional role persist after reload.
- [ ] A repeated row in the same file: only one Ready. An existing link: Already linked, never changes the role.
- [ ] Duplicate Deal names require Company disambiguation or exact SalesShop Deal ID. Duplicate Person email or email/ID mismatch must remain Needs review.
- [ ] Unknown Company name, stale Person/Deal IDs, invalid/oversized role and missing identifiers remain unselectable.
- [ ] Only selected Ready rows are saved; no automatic selection and no record creation.
- [ ] Viewer, active role perspective, unhydrated CRM, wrong identity or wrong/incomplete link store cannot save.
- [ ] Simulate a multi-row failure and confirm partial results are reported, with a safe re-review path and no automatic duplicate replay.
- [ ] Verify unrelated Quotes, automations, CRM stage events and existing company/person associations remain unchanged.

## Next

A future `#385c` could add explicit review of **external identifiers within files** and a durable tenant-specific external-ID mapping table, after a disposable staging/RLS audit. Do not infer that source-system IDs are native SalesShop IDs. Large, atomic, background imports require dedicated transaction-aware server architecture and are not part of #385b.
