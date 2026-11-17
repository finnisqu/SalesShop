# Build #375 — Records panel action refinement

## Scope
- **Deal People:** Remove instructions and empty quote-linked placeholders. Show direct contacts first; only show quote/activity linked contacts when present and not already direct contacts. Hide private role utility when no eligible user-owned quote contacts or company scope exists. Keep direct role editing and add/link existing People.
- **History:** Remove accidental button fills from event titles. A two-column event row gives the subject a wrapping left column and reserves the date in a right aligned, non-wrapping column. Preserve click-to-open Activity and Quote actions.
- **Deal stage:** Stage in the record header is now a native accessible selection control, backed by the same authorized CRM stage update and stage choices as the About field. Read-only perspectives cannot change it.
- **Editing:** Remove global Edit Page button; the full-editor workflow remains available under a compact **Edit details** button in each About tab. Existing individual inline fields and validation remain functional.
- **Unlinking:** Remove global Unlink connections command from the page More menu, retaining guarded Delete record when applicable. A local **Manage links** button in each Connections tab exposes safe unlink controls; the Quotes tab has its own independent **Manage Quote links** button. Unlink requires a confirmation, leaves Activities/history intact and disallows issued/archived Quote unlink. Permission loss closes both link-management modes.
- **Company Forecast:** Replace reliance on unobtrusive field pencils with an explicit **Edit forecast** action inside Forecast. Supports annual units, revenue/unit and expected share, validates finite nonnegative values, whole units and share <=100%; keeps derived annual potential/work calculations. Only CRM-editable users can save changes.

No new database schema, email permissions, Quote pricing, CAD-Lite code or provider writes.

## Acceptance
1. Open Deal → Connections → People: direct links appear without empty-state prose, and Add Person still links People.
2. Choose stage from the Deal header; confirm the Board and About stage update.
3. Open About on Person, Company and Deal; select Edit details; verify changes and cancel, then use Manage links on individual Connections tabs.
4. On Company → Forecast use Edit forecast, save numbers, check expected annual work; test validation with invalid values.
5. Open History containing long event names; date stays on the right, no gray label fill, and each event still opens details.
6. Repeat under viewer permissions and narrow layout; destructive actions must not appear to unauthorized users.

QA validates TypeScript, Vitest, the source-level record gate and Vite production bundle. Authenticated browser and mobile visual acceptance are separate.
