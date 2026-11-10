# Notebook mobile page navigation and ruled-paper alignment — November 10, 2026

## Implemented
- **Notebook header:** Replaced the Pages/Agenda header view switcher with a live page navigator. On phones, the standard page-selector dropdown shows the currently active page and searches page titles; on desktop, a compact Page select replaces the old header tabs. New Page action and the search control remain.
- **Mobile single-page:** At widths up to 820px, the Notebook mounts just one editable page. The previously stored desktop split arrangement is left intact but the companion pane, split buttons, split-only sidebar and split layout are absent. Resizing wider restores the desktop split option and existing saved preference.
- **Compact mobile header:** The Calendar action moves into the Notebook header where the redundant More button was; the separate Single Page / Split View control strip is removed entirely on phones. The primary page and formatting toolbar remain visible.
- **Ruled paper:** On both desktop and mobile, text and stationery rules use the same `--notebook-rule-step: 32px` cadence. Removed the old +9px paper-rule offset and the mobile 30px text-vs-32px rule mismatch. This also aligns ruled Cornells and two-column layouts and the vertical rhythm of grid paper.
- Styles are scoped to Notebook; customer quote pages and documents are unchanged.

## QC checks
1. On iPhone, open Notebook: the header page dropdown should show the current page name rather than Agenda. Switch to two other pages; their titles, content, and selection state must update. Search for a page and select it.
2. Create a new page with +. It should become the active page and be available in the navigator.
3. Verify the mobile header contains Calendar, Search and +, with no More or Side-by-side menu. The Calendar should still open.
4. Verify no Sidebar, companion editor, Side-by-side / Stack / Split button or oversized Single page strip appears on mobile.
5. Open split view on desktop, then resize to mobile: only one page should show. Resize back to desktop: the split preference should be retained.
6. Use an existing ruled page with long wrapped paragraphs and blank lines. Confirm text baselines stay a constant distance above each printed rule after 20+ lines, on both desktop and phone. Also spot-check H1 and lists, Cornell and grid stationery.
7. Check narrow iPhone, dark/light themes, external keyboard use, and switching back to Home/Quotes/Connections.
8. Verify Cloudflare TypeScript, configured quick quote tests and Vite build before claiming deployed. Signed-in visual QC remains manual.

## Boundaries
No Notebook data conversion, deletion, Supabase migrations, permission changes or automatic CI toggle. Split View remains available on desktop; this batch disables it on mobile without deleting stored state.
