# Batch 351b — Create and link a Company while recording an external Quote

Date: November 15, 2026  
Branch: `main`  
Status: Source changes and regression suite committed; new Cloudflare TypeScript/Vitest/Vite acceptance and authenticated phone/cloud runtime QC are pending.

## Connection to November 12 feature roadmap

The user wants universal inline **Create & Link** for Companies, People, Deals, Activities, Tasks and Quotes, using canonical CRM relationships rather than separate local shadow records. Batch #351a added global/contextual New Person creation. This sub-batch addresses a concrete issue in the **Record External Quote** flow, where a new Deal could previously be created with an optional existing Company chosen from a plain select, but could not create a Company in the same workflow.

A partial failure could also leave a newly created Deal behind if Company association threw, while returning an error from the create picker and inviting a second attempt. That second attempt could create a duplicate Deal or strand the user.

## Implemented

1. **Search/create Company while creating an external-bid Deal.** The Deal picker in `ExternalQuoteBackfillDialog` now hosts the existing `UnifiedRecordPicker` for the Company in its optional-detail area. Users can choose an existing Company, stage a brand-new Company name, or leave Company empty. The selection is visible and clearable; no Company is created when the nested picker closes or the user cancels. The new Company is created only after the Deal has been successfully created, retaining the existing CRM store, Company relationship metadata and Prospect classification.

2. **Validate before side effects.** Added `src/services/externalQuoteDealCreateLink.ts` with `createExternalQuoteDealWithCompany` and `linkExternalQuoteDealCompany`. The helper validates the Deal name, case/whitespace-normalized duplicate Deal name, Company selection and new Company duplicate name **before** creating a Deal. A missing Company ID or conflicting existing/new choice fails before any new Deal is created. Optional Company is still allowed.

3. **Keep real Deal IDs on partial failure.** If the Deal is created successfully but subsequent Company resolution/classification/assignment fails, the service returns a recovery object with the created Deal ID and either the intended existing Company ID, resolved new Company ID, or the uncreated Company name. The UI selects the created Deal and displays an inline **Retry Company link** action, rather than throwing the user back into Deal creation. A resolved new Company ID is retained if assigning it failed, so retries do **not** create a second Company. The user can still record the external bid against the already-created Deal without a Company, consistent with partial information being valid information.

4. **No alternate bid or Quote representation.** The same `ExternalQuoteSentForm` remains keyed by the selected existing CRM Deal, with the same pending submission, customer delivery, Tasks and Calendar logic. A link failure does not invent a native SalesShop document, submission proof, private relationship copy or a second Deal.

5. **Theme/mobile parity.** The nested Company picker uses the shared search/create UX and existing record association surface, with small scoped styles for Company selection and the recovery message. The old plain Company `select` inside the new Deal picker was removed. Mobile touch targets use the established 44px conventions, and no additional modal, table, or body scroll region was added.

6. **Eight regression tests.** `src/services/externalQuoteCreateLink351b.test.ts` covers linking an existing Company, name-only Deal, pre-create duplicate/missing selection validation, staging Company until after Deal creation, existing Company link rejection + retry, new Company assignment rejection + retry by retained ID, Company creation failure + retry by retained name, and component/source integration with the existing external Quote form. Registered exactly once in `test:quick-quote`; source checks pass. This is a source and contract review, not a claim that the full build succeeded.

## Manual acceptance after green

- Open Record External Quote from Global Quick Create, Deals, and Quotes. Choose an existing Deal; verify its original Company and external Quote submission form remain unchanged.
- Clear the Deal; search a new Deal name and choose an **existing** Company via searchable picker; create Deal, confirm CRM Deal's Company link and bid submission/history.
- Repeat with a **new** Company name; cancel before Deal creation and verify no Company was saved. Create the Deal and verify its Company is prospect-classified and linked. A name-only Deal should still work.
- In a controlled test account, simulate a failed Company assignment **after** creating the Deal. Confirm the new Deal remains selected, **Retry Company link** appears, and retry does not create duplicate Deals/Companies.
- Simulate Company creation failing after the Deal exists and retry the same Deal. Confirm no duplicate Deal was created. Attempt duplicate Deal/Company names and a missing selected Company; no new Deal should be created.
- On phone and desktop, verify the nested Company picker, no accidental modal dismissal or keyboard form submit, Focus/Escape behavior, WARM/LIGHT/DARK styling, and usable form scroll.
- Run `npm run build` (TypeScript, `test:quick-quote`, record gate, Vite); inspect Cloudflare's specific deployment commit and confirm authenticated runtime behavior. GitHub status list may be empty even when Cloudflare has a separate deployment.

## Scope and next

No Supabase migrations, authorization/RLS changes, Quote snapshot changes, signed documents, task completion rules, or multifamily Gantt. The stored Deal–Company relationship continues to use `setProjectCompany`, and the external submission uses its existing CRM flow.

Next Batch #351c: continue the original Create & Link audit of Activity and Task association pickers; prefer shared pickers that **stage** new records until parent save or provide explicit recovery if the parent save can fail, with role-scoped access and no duplicate Activities. Also verify #351a/#351b production mobile interactions before a wider rollout.
