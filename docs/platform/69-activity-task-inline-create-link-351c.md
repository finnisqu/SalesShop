# Batch 351c — Activity and Task inline create/link parity

Date: November 15, 2026  
Branch: `main`  
Status: Source and regression suite committed; Cloudflare TypeScript/Vitest/record-gate/Vite build and authenticated browser/phone QA pending.

## Product goal and findings

The user's November 12 roadmap calls for People, Companies and Deals to be creatable and linkable from Activities and Tasks without repeatedly navigating to Records. The Activity form already had a shared inline create component (`ActivityRelatedQuickCreate`), while the Task editor only searched existing relationships through `TaskAssociationsField` and saved selected links as part of its locally recoverable Task draft.

We found an Activity data-integrity problem: the **nested Company picker** was creating a permanent Company at selection time, even if the user canceled the surrounding Person/Deal editor. That created needless CRM records during an exploratory selection.

## Implemented

1. **Activity Company staging:** Added `src/services/activityCompanyStage351c.ts`. Selecting “Create Company” in the Activity Person/Deal editor now only stages a name. A Company is materialized only when the user actually presses **Create & link Person/Deal**. Cancel, clear or change record type before submit no longer creates the staged Company.
2. **Preflight + retry safety:** `stageActivityCompanyName` rejects empty and normalized-duplicate names. `resolveActivityCompanyStage` validates stale existing IDs, staged-vs-existing conflicts, and concurrent duplicate Company names. It remembers a newly created Company's ID *before* optional classification or related Person/Deal creation, allowing a failed save to retry against the existing ID rather than creating a duplicate Company.
3. **Company/Person dedupe parity:** A pending new Company no longer gets treated as the same primary Company as an unrelated unassigned Person when comparing Person names. Existing same-email checks still apply. Direct Company creation remains an intentional action, separate from staging a Company to attach to a Person/Deal.
4. **Task inline creation:** The standard `TaskEditor` now has a collapsed **+ Create and link Person, Company or Deal** section, authorized by the existing CRM edit permission and blocked during role preview. It reuses `ActivityRelatedQuickCreate` directly, not a second create API or nested HTML form. The creator receives `contextLabel="Task"` for correct guidance. On successful CRM creation its `TaskAssociation` is added to `selectedLinks` using `taskAssociationKey` to prevent duplicate chips.
5. **Draft and cancellation behavior:** The existing Task draft `writeSavedDraft(scopeKey,{...selectedLinks})` persists the added association locally and `onSave` writes it with the Task. The UI explicitly states that a CRM record is **created immediately** by **Create & link**, and **remains in CRM if the Task is canceled**. This is an intentional explicit create action, *not* an atomic Task+CRM transaction, and avoids promising that unsaved Task records were committed. Existing Task edits, due dates, reminders, statuses and completion protections remain unchanged.
6. **Double-submit protection and mobile consistency:** A synchronous `pendingRef` guards the shared inline creator against Enter+click duplicate submissions before React state settles. Scoped Task styles preserve WARM/LIGHT/DARK theme tokens and 44px mobile controls, without a new modal or scroll-parent overlay.
7. **Regression coverage:** Eleven tests in `src/services/activityCompanyStage351c.test.ts`: stage-without-write, duplicate/empty names, optional/existing links, stale/mixed selections, materialization order, classification failure + ID recovery, concurrent duplicate check, Activity integration, Task reuse/no nested form, draft persistence and explicit cancellation semantics, and permissions/double-submit/mobile contract. Updated pre-existing `CrmPickerPinPolish.test.tsx` assertions to the new staged lifecycle. The new suite is registered once in the existing `test:quick-quote` Cloudflare gate. Source contract checks passed; the full build is **not** verified.

## Operational boundaries

- **Important:** A direct Person, Deal or Company created from an open Activity form is still an explicit CRM create. The parent *Activity log* may not yet be saved. Likewise, a CRM record created inside a Task editor persists even when the Task is later canceled; this is clearly disclosed in the Task UI. The new staging improvement specifically prevents a *Company choice* from creating a record before the linked Person/Deal itself is submitted.
- No migrations, Auth/RLS changes, task status policy changes, Quote price/signed-document mutations, new CRM relationship tables, or background jobs.
- Existing CRM `createContact`, `resolveCompany`, `createProject`, and `relinkProjectCompany` remain the authoritative storage operations. Task uses existing `TaskAssociation` fields; no shadow linkage is introduced.
- Cloud role permissions and actual persistence/synchronization need authenticated testing. The presence of a passing source contract does not guarantee a green Cloudflare build.

## Acceptance steps after a green Cloudflare build

1. **Activity → Person/Deal → Company picker:** Type a brand-new Company, select Create, then cancel or change record type before submitting the Person/Deal. Confirm no new Company appears in Records.
2. Submit the Person/Deal with that staged Company; confirm both records exist and the real primary Company relationship is correct. Verify duplicate Company selection and existing Company search still work.
3. In a controlled test account simulate Company classification or child creation failure after Company materialization. Confirm the same Company ID is reused on retry and a second Company is not created.
4. **Task editor → Related records:** Search and link an existing Company/Person/Deal/Quote; verify current behavior unchanged. Expand **Create and link**, create a new Person/Company/Deal, then save the Task. Verify relationship chips and saved Task associations in both Task quick view and Records.
5. Cancel a Task after explicitly creating a new CRM record, then reopen the Task draft; confirm the record remains available in CRM and draft link can be restored. Verify warning text is visible.
6. Verify CRM Viewer/role-preview users cannot create CRM records from the Task editor; non-CRM task operations remain available per existing permissions.
7. Test mobile portrait/keyboard in Task and Activity forms; inspect WARM/LIGHT/DARK styling, scroll, focus/Escape, 44px controls, and no nested submit triggered by picker Enter.
8. Run the actual Cloudflare `npm run build` gate: `tsc --noEmit`, quick-quote Vitest, record-gate Vitest, and Vite. Log/confirm the deployed commit separately from a blank GitHub combined-status response.

## Next: #351d

Investigate a transaction-like *draft first / commit on parent save* workflow for new CRM records created from Tasks and Activities, with explicit partial-success recovery after a failed Task/Activity write. Also sweep existing link pickers for stale/duplicate associations and permission parity. Prefer concrete bug reports or authenticated runtime evidence ahead of larger feature changes. Follow-up planned initiatives remain configurable record fields/views (#352), Proposed Records (#353), and BYOS/email (#354); multifamily Gantt remains deferred.
