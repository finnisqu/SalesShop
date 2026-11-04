# Home calendar preview, density and record cleanup — acceptance notes

## Home layout

- The desktop Home calendar has a fixed-height month grid and scrollable selected-day agenda. Choosing a busy day does **not** resize the page. Every day has a thin border so an urgent red exclamation belongs visibly to its date.
- Urgent tasks sort to the top of that day's agenda and show an independent red ! marker in the row, without incrementing badge counts.
- The previously awkward month arrows and Today icon now form a single left-side period-navigation cluster, with Today first.
- The wide bottom "Pick up where you left off" cards are gone. The desktop calendar has three areas: Calendar, selected-day agenda, and a narrow sidecar with tabs for Recent Quotes and Recent Activity.
- Desktop week view uses a 7-day strip and compact week summary rather than stretching a single calendar row. Mobile keeps its stacked/touch-friendly flow.
- Redundant All Tasks and All Quotes links have been removed from Home.
- Clicking Calendar tasks uses the existing global Task preview; Calendar/sidecar Quotes and related CRM records open a side preview. A logged Activity opens its own quick-view panel with notes and Person/Company/Deal/Quote links, all without navigating away from Home.
- Task preview CRM associations open the same record preview instead of navigating directly.

## CRM Activity and chrome

- Related-record dropdown placement now prefers the side with room for the entire result/footer and prevents horizontal scrollbar overflow.
- Global Search uses root-level SalesShop theme variables even when portaled outside the app root, including dark mode.
- The four desktop toolbar controls (Calendar, Search, +, Post-it) are centered vertically, use identical 38px hit targets, and have tighter spacing. Existing navigation tabs remain bottom-aligned.

## Guided cleanup

- Home sidecar and + menu offer **Review overdue tasks**, a one-at-a-time modal. Per task: Today, Tomorrow, In 7 Days, Mark Done, Delete (confirmation), or Skip. It never silently changes data.
- **Record cleanup** offers search and record type tabs for Quotes, People, Companies, Deals and Activities. Safe rows allow deletion and multi-select bulk delete with explicit confirmation. Issued/non-draft Quote records are archived rather than erased. The last test draft can now be deleted without generating a new Untitled Quote.
- Dependencies block deletion: linked Quotes, People, Deals, Activities and currently visible personal Tasks. Inline blocking messages show why. Manual test Activities can be removed explicitly (including as a separate cleanup step before deleting test People/Companies).
- Narrow automatic creation/stage events may be deleted along with an otherwise unlinked fake Person or Deal. After a draft quote is deleted, orphaned `quote-created`/`quote-linked` setup events whose quote no longer exists may be separately deleted from the Activities tab. Sent, signed and revision audit entries remain protected. Quote status history, manual touchpoints and other linked Activity history are preserved. Auto-generated submission tasks do not prevent deleting an otherwise empty test Deal; they are canceled by the standard reconciliation after its removal.
- People/Company/Deal/Activity deletion in cloud mode uses a server-confirmed request under existing RLS before local removal. Cloud permission or relational failures show an error. Local mode uses its existing local document store.
- No bulk deletion occurs automatically. CRM deletion is intentionally destructive; other browser sessions/devices with stale local state should be refreshed before large batch cleanup. We do not currently have globally coordinated tombstones for every shared CRM record.

## Acceptance checks (on next Cloudflare/browser QA pass)

1. Check TypeScript and Vite build; new source files are imported from App / calendar / Home.
2. Home month and desktop week: select Nov 3 and Nov 4 (different agenda counts), verify identical calendar height. Borders clearly contain urgency badges, and the urgent task is first.
3. Today control and previous/next arrows stay on one line at desktop and mobile widths; week/month toggle persists.
4. Click a logged Activity in agenda: Activity preview appears over Home; click linked Person, then Company, and close to return to the same day. Recent Quote opens metadata preview, with explicit Open Quote for the guided workflow.
5. Use Home + to open overdue task cleanup. Verify Skip, reschedule, Done, and Delete affect only the selected task and the dialog can close without navigating.
6. Record cleanup: delete last test draft without a replacement. Verify only a compatible Draft deletes permanently; a Sent document archives. People/Deals with only automatic creation history can be deleted; manually logged CRM history blocks until cleaned. Validate bulk selection disables protected records.
7. Search for one related record in Log Activity near dialog bottom. Ensure result and Done footer are visible, with no sideways scrollbar.
8. Global Search palette matches Light, Warm, Dark, and Contrast themes; toolbar icons share height/gaps.
9. Ensure permissions and account scope block viewer and owner-perspective cleanup controls, and that remote deletes persist across reload. Check stale second-device behavior separately.

Source-only review and regression tests were added; the full Cloudflare TypeScript/Vite build and live browser acceptance are **not verified** by this batch.
