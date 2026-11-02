# CRM preview-first interactions and shared tables — Nov 2026

## Behavior
- On Board, the deal/account name behaves like a link on hover and click. Card dragging is preserved. Explicit Edit still opens the Board editor.
- On Connections desktop and mobile, the first click opens a Board-styled, dimmed, right-docked preview. Company: About, People, Deals. Person: About, Company. Deal: Company, About, Quotes. Quote: About, Company, Deal.
- Record previews have **Go to page**, while quote previews also have **Open quote**. The quote's metadata page is a Connections resource; the actual commercial document editor is reached only via Open quote.
- Quotes are accessible from Connections > More, not a top-level Connections tab. The quote metadata directory and previews mirror personal My Documents ownership in cloud mode.
- Sales Documents and Tasks desktop lists now share the existing Connections table component: searchable through their original search filters, sortable rows, configurable columns, pin tray, per-row checkboxes, optional bulk-task creation and bulk-completion for Tasks. Mobile cards are preserved.
- Cross-workspace quote metadata navigation uses a one-shot sessionStorage request when switching into Connections; never route directly into quote editing.
- No database schema or quote pricing changes, no bulk delete.

## Acceptance
- Hover and single-click Board name without triggering drag; use Edit to enter Board editor.
- Open Company, Person, Deal from Connections; dim backdrop, Escape and outside click dismiss; Go to page retains full record.
- More → Quotes: preview metadata, Go to page, Open quote; ensure archived quotes are not unintentionally editable.
- Confirm company/deal preview never reveals other people's cloud quotes.
- Desktop Sales Documents and Tasks columns/pin/sort/search/checkbox work; narrow widths show existing mobile cards.
- Verify Tasks bulk completion confirmation and re-open; no cross-user task or quote metadata leaks.

Tests/browser verification pending. Build check required on the published commit.
