# Mobile sheet handles, calendar cells and global nav — Nov 10, 2026

## Delivered
- Task, Activity and Company quick-view sheets use the existing draggable grip only; the legacy CSS header grip is hidden whenever the real grip is present. Remove the now-unused header top padding; close buttons and drag gesture remain.
- Home calendar **Month** keeps every day cell 56px high even when three or more metric badges wrap. Overflow stays within the day's square; the compact **7 days** layout is unchanged.
- Main mobile hamburger navigation is one icon-labeled full-width row for Home, Quotes, Tasks, Board, Connections, Notebook and Catalog, with theme-aware active state and 48px touch targets.
- **Catalog** navigates directly instead of opening stale nested categories in the drawer. Its existing mobile header section picker (Materials/Sinks/Other/Rates/Tags) is visible again, alongside More, Search and Add. Suppliers remains accessed through Connections as currently implemented.
- No CRM records, quotes, Supabase schema or user permissions modified.

## Mobile QC
1. From Home Recents, open a Task quick view and an Activity detail quick view. Confirm only one visible drag grip, no blank faux grip area, drag to dismiss and tap X still work.
2. On Home calendar, use **Month** and find a day with 3+ badges; ensure all week rows remain equal height. Switch to **7 days** and check its row height is still the established compact size.
3. Open the hamburger from Home, Catalog and Connections; confirm seven full-width rows with icons, clear selected state, and tapping **Catalog** opens Catalog immediately.
4. In Catalog, use its own section dropdown to switch Materials/Sinks/Rates/Tags, then search and add. Check the catalog header does not overlap the content or iOS browser toolbar.
5. Check light, warm and dark themes, portrait/landscape, and keyboard controls on a narrow iPhone.
6. Cloudflare build needs to validate TypeScript, configured Quick Quote test suite and Vite; visual iPhone QA is still a separate check.
