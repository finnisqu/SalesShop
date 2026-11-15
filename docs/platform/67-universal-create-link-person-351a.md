# Batch 351a — Global Person Quick Create and contextual linking

Date: November 14, 2026  
Branch: `main`  
Status: Source, six regression tests and roadmap committed. Cloudflare build and authenticated phone/cloud QA pending.

## Product intent

The November 12 SalesShop priority message called for the ability to create and link **People, Companies and Deals from anywhere**, preserving partial information and reusing shared CRM relationships. By Batch 350f, the shared `UnifiedRecordPicker` already supported Company selection in Deal/Person editors and direct Deal–Person linking on the two record pages, but the global/contextual `QuickCreate` offered only **New Deal** and **New Account**. There was no **New Person** entry. This focused batch closes that real gap without inventing a parallel record/link system.

## Implemented

1. **New Person in the existing Quick Create sheet.** Added a Person glyph and option alongside Deal and Account, protected by the existing CRM edit-eligibility check (`canRecordExternal` currently represents the same local/team CRM permission). Entering a name and selecting **Create & open** creates the CRM Contact using the existing `createContact` store operation, records its standard contact-created Activity provenance, and navigates to that Person. A name alone is enough; Company and Deal are optional.
2. **Company context uses the primary Company FK.** Quick Create launched from a Company creates the new Person with `companyId` pointing at that Company. Choosing an already existing same-name Person offers an explicit **Move to this Company & open** action and warns that this changes their primary Company. No shadow association or activity-log proxy is created.
3. **Deal context uses the existing durable Deal–Person relationship.** From a Deal, Quick Create first checks the Deal still exists and loads the scoped `deal_people` link store; if unavailable, it stops **before** creating a Person. The new Person inherits the Deal's current Company when available, then `await links.add(dealId,personId)` saves the real Deal contact row. Linking an existing Person checks the same scope and avoids a duplicate row if already linked. No Quote document or Deal stage is changed.
4. **Safe retries and partial-save recovery.** Existing async pending guards prevent Enter+click double submissions. If Person creation succeeds but the server rejects the direct Deal link, Quick Create presents **Open created record** instead of repeating creation; the Person can be linked to that Deal from its existing record page. Link-existing failures keep the sheet open with an error for retry. Browser/team workspace scope is rechecked when saving.
5. **Same-name handling accommodates homonyms.** Normalized names match regardless of case and repeated whitespace; exact matches appear in a compact in-sheet chooser instead of silently creating a duplicate. Users can open or link the existing Person, or explicitly check **This is a different Person with the same name** to create a distinct record. Changing the name resets that override. This protects data without assuming every identical name means the same human.
6. **No invented Person–Person links.** If Quick Create is launched from an existing Person, another new Person can be created, but the sheet explicitly says no direct Person–Person link will be inferred. Users can associate People with a Company or Deal through supported FK and direct relationship workflows.
7. **Phone-safe styling and tests.** The existing Quick Create sheet hosts the matching-record buttons and confirmation checkbox, with theme tokens, flexible wrapping and 44px touch targets. Six tests (`src/services/quickCreatePerson351a.test.ts`) cover local Person creation/activity provenance, Company FK, durable Deal relationship, loading-before-create, normalized duplicate/homonym behavior, permissions and partial-save recovery paths. Registered once in `test:quick-quote`; source-contract checks passed.

## Safety and limitations

- No Supabase migrations, RLS/Edge/Auth changes, new tables, Quote/price edits, Activity schema changes, or alternate relationship stores.
- Source tests are not a substitute for running `tsc --noEmit`, Vitest, record gate, Vite build, or live Cloudflare. No live device or cloud session was available for interactive acceptance.
- **Create & open** opens the Person after the local CRM action. Cloud-backed replication of the existing CRM store and Deal–Person insert still requires authenticated QA.
- Existing Company and Deal Quick Create paths are left unchanged; their independent reliability/access-control audits remain in the #351 queue.

## Acceptance after Cloudflare green

- Global + button → New Person → create a name-only contact; verify it appears in Records / People and can be edited without requiring a Company.
- Company record → + New → New Person; verify the Contact primary Company is set and the Company record lists them. Type an existing Person's exact name and deliberately select **Move to this Company & open**; verify reassignment is explicit and reflected on both pages.
- Deal record → + New → New Person; verify direct Deal contact displays on both Deal/Person pages, and Company membership is inherited when the Deal has a Company.
- With cloud link access unavailable, verify Deal creation stops before creating a Person when link store cannot load. Simulate a link insert rejection after Person creation; verify **Open created record** recovery, without duplicating the contact.
- Enter a name already used by another Person; verify existing record selection and opt-in same-name creation both work. Ensure multiple homonyms are not silently merged.
- On mobile portrait and keyboard-open landscape, verify options, matching People list, warning text, checkbox, buttons, and focused input fit in Quick Create. Check WARM/LIGHT/DARK themes.
- Verify Quotes, Tasks and Activities continue working unchanged. Run full Cloudflare `npm run build` including `tsc --noEmit`, `test:quick-quote`, `test:record-gate`, `vite build`.

## Next #351b

Continue the original Create & Link vision. Audit and normalize **Activity, Task, Quote, and CRM record** pickers, including creating a Company/Person/Deal in context, relationship persistence, unlinking, orphan/duplicate prevention, and the saved cloud relationship state. Prioritize any actual Cloudflare regression before further changes. No new platform settings, Proposed Records, email sync or multifamily Gantt in this first sub-batch.
