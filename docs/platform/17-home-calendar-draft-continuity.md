# Home, calendar, task preview and draft continuity — acceptance pass

## Interaction design
- Home is a calendar-first working surface, not a revenue dashboard. It has Log Activity and a + launcher, an inline month calendar with day glimpse, capped My Today list, and Recents.
- The global calendar launcher is icon-only, consistent with Search, + and Post-it.
- Clicking any calendar-linked or Home-listed Task opens a read-only task detail with Edit task, Mark complete / Reopen, and related-record links.
- Quick Create's Quote / Schedule starts the guided template selector before creating anything; Task starts its editor. Navigational tabs still open the relevant libraries.

## Safe draft behavior
- Activity and Task editor form drafts persist to **this browser and this device only** through account-scoped localStorage (workspace plus signed-in user). Drafts expire after 7 days.
- Activity saves method, timestamp, CRM links and notes; it no longer requests a Summary. The system generates an activity description based on the selected method and linked record. An associated record is required.
- Task editor saves every change (title, type, priority, dates, time, queue, notes, CRM associations). Closing preserves it; only explicit Discard or successful Save clears it.
- An open Task editor is automatically restored when its Tasks workspace remounts. Activity reopens if it was open when the app was discarded. Closed drafts remain available when that form is opened again.
- Drafts are local recovery copies, **not cloud autosaves**. Browser storage being deleted, blocked, private mode, or another device is not covered. The app does not claim a cloud save until the actual record is submitted.

## Materials
- Reference browse shows only 25, 50 (default), or 100 matching materials per page.
- Filtering and sorting apply to the full set before paging. Both desktop table and mobile cards use the selected page.
- Switching search, filters, sort, or page size resets to page 1. Pinned comparison variants remain independent of pagination.
- Editing is still handled by the existing MaterialRateBook editor; its load cost is a separate future optimization.

## Smoke tests after Cloudflare deploy
1. Start new Activity, link a Person, write notes, switch browser tabs and reload. Check draft still shows, then Save and verify CRM History only has one activity.
2. Start a second Activity, close and reopen; note remains. Discard and reopen; empty form. Different user/company must not receive the previous draft.
3. Start a Task from +, fill title, date and links, reload, verify restoration; Save, reopen, and verify no stale draft. Repeat using Close and explicit Discard.
4. Calendar Task tomorrow → preview, then Edit. Related record navigation and Mark complete should work. Home Task title opens the same preview.
5. Home: calendar and list remain scrollable at desktop and phone widths; verify no sales totals and no old shortcut tiles. Calendar has usable day badges.
6. + Quote → template picker → select Quick Quote template → guided Project Details. + Deal/Account/Notebook still works as before.
7. Materials with 1,000+ colors: next/previous, 25/50/100, search, sort, filters, mobile cards, expanded variant, and pin/compare.
8. Verify logged-in role restrictions, light and dark themes, and mobile Safari safe areas.

## Deployment note
Cloudflare builds run `npm run build` (TypeScript, Quick Quote tests and Vite). No local full build or browser automation was run for this change; inspect the deployed Cloudflare log before declaring it green.
