# Build #373 — Email workspace and Records UI cleanup

## Email

- Gmail remains read-only. Explicit CRM Activity logging and fingerprint deduplication are retained; matched conversations do not silently write shared Activities.
- The desktop Email workspace has a compact Subject / Correspondents / Date list with independent vertical scrolling and a second scrollport for the selected plain-text conversation. Search and review filters remain available above the list.
- CRM actions are moved to a toolbar beside the conversation: New task, Log Activity, Create Person, and Link record. Each action opens a dismissible panel rather than consuming the document reading area.
- Creating a Person from a conversation confirms success in place and closes the panel, without automatic navigation. Opening an existing or created Person is still an explicit separate action.
- These changes do not copy raw Gmail message IDs, recipients, messages, or access tokens into CRM storage.

## Records

- Record header, breadcrumb, and bottom whitespace are condensed. The More menu appears before Edit in Company, Deal, and Person page headers.
- The Person's main left panel keeps the name visible with About / Email / Notebook tabs. Call, text, email, and Log Activity shortcut controls sit under the title; the old center-column Contact tab is removed.
- The Person Deals page no longer shows the two verbose quote-contact relationship explanations.
- Recents has two tabs: Quotes and History. History encompasses logged Activities and other relationship history. Person and Deal histories are no longer collapsible, and all three record types use a bounded history scroll area on desktop.
- Left, center and right panel section tabs follow the Recents capsule appearance; columns stretch to fill the available viewport height on desktop.
- The full-width Records page host owns the scrollbar at the app's right edge instead of centering the scrolling element itself.
- Quick-preview contact method icons and Close are grouped in a dedicated flex control cluster to avoid overlap. Embedded Meeting and Task action launchers no longer stretch to full-panel width.

## Manual acceptance

1. On desktop, open TOOLS → EMAIL and select a conversation. Confirm the email list scrolls without moving the reader, and long messages scroll independently. Try each CRM action and close a popover with Escape and by clicking outside.
2. Create a Person from an unknown email participant and confirm that the email remains selected. Opening the Person record remains possible on deliberate click.
3. Open Person, Company and Deal pages. Verify More is the first header action, Person left tabs keep the name visible, History contains Activities, and the page scrollbar touches the right edge.
4. Check the Person preview at narrow phone widths to ensure Call/Text/Email icons and X are separate.
5. Verify the embedded Create Task and Schedule meeting buttons are compact, including in dark and warm themes.

QA uses TypeScript, Vitest, source regression gates, and a Vite production bundle. These cannot substitute for authenticated browser/mobile visual acceptance.

CAD-Lite is untouched. No new Supabase schema or changes to Quote pricing or customer delivery.
