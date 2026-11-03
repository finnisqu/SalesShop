# Session continuity and compact Home — 2026-11-03

## Intent

Make SalesShop keep the current mounted workspace when Supabase reconfirms an unchanged signed-in user, and make Home a compact, calendar-led work surface on desktop and iPhone.

## Session / tab lifecycle

- `authStore.applySession` reuses the current ready cloud workspace when the same user receives another auth event. It updates the session without setting `ready:false`, stopping cloud sync, or rehydrating the full CRM/quote/notebook stores.
- A new user, missing workspace, unresolved invitation, signed-out state, or initial startup still follows the normal bootstrap. The pure decision is in `authSessionPolicy` with unit coverage.
- The global app shell no longer waits for a Notebook page before rendering Home, Tasks, Quotes, Catalog, or Connections. Notebook itself retains its loading guard.
- `appLifecycleDiagnostics` records only non-sensitive indicators in the current browser tab: browser discard vs reload vs navigation, and reused vs reinitialized authentication events. No customer records, user IDs, tokens, emails or page content are collected. Hover the desktop build badge to inspect the summary.
- This does **not** prevent Chrome Memory Saver from discarding a tab. Browser-managed reloads can still occur; existing local draft recovery guards unsaved Task and Activity forms.

## Compact Home

- The calendar itself is the agenda, so the duplicate My Today/task panel has been removed.
- Desktop: compact month grid plus selected-day agenda side-by-side. The inline month omits unused sixth-week padding when possible.
- Phone: seven-day calendar strip, previous/next **week** navigation, Month/Week expansion, selected-day items in normal document flow. Day items initially show at most five, with explicit Show more; no internal mobile agenda scroll jail.
- Recent work is a capped, horizontal, touch-friendly strip (personal Quotes, Tasks, unhidden Notebook pages); role previews hide it, and cloud quotes/tasks remain account-scoped.
- Log Activity and + remain the only creation controls on Home. + Quote still opens guided template selection.
- Calendar event-click behavior remains linked to preview/detail routes.

## CRM privacy

- New activity log records include `metadata.recordedByUserId` (existing normalized `activities.metadata` JSONB field; no SQL change).
- Cloud personal Calendar displays owned quote deadlines, deals linked to an owned quote or personal task, and touchpoints authored by the signed-in user or linked to that work.
- Legacy team activities without attribution are not surfaced on personal Home unless there is a permitted quote/deal link. They remain in Connections/Activity History.
- Local-only mode keeps its existing full local calendar behavior. All actual data permissions remain enforced by the existing backend RLS and role checks.

## Acceptance checks when a browser / Cloudflare deploy is available

1. Open SalesShop in Chrome, switch away and back. Verify an existing session does not show `Connecting SalesShop` because of a `SIGNED_IN` or `TOKEN_REFRESHED` reconfirmation.
2. If Chrome performs a **real tab discard**, a full reload is expected; inspect the desktop Build Badge tooltip for `browser discard`, then confirm navigation and Activity/Task draft recovery.
3. Switch between accounts and confirm a new workspace initializes and the previous user's draft/task/notebook data does not appear.
4. Desktop Home: month dates, 4/5/6-week grids, agenda links to Tasks/Deals/Quotes, horizontal Recents, no second Tasks list, no sales totals.
5. iPhone Home: 7-day strip, week arrows cross month boundaries, month expands/collapses, selected-day agenda has touch-friendly rows, Show more displays the rest, no horizontal viewport overflow.
6. Recents open the precise Quote, Task preview, or Notebook page; unhidden private records only.
7. New manually logged Activity from a Person appears in the author's calendar after CRM cloud sync, but not in a teammate's personal Home unless linked to their accessible own work.
8. Verify light/dark themes, empty calendar state, role preview and read-only accounts.

The GitHub unit suites include the auth reuse policy and calendar layout/privacy tests. **A live Cloudflare/Vite build and browser pass are not verified by these source changes.**
