# Activity logging and shared Calendar — initial release

## Scope
- Home Quick starts opens **Log Activity**, a quick dialog for Call, Email, Text, Video Call or In Person. Date/time and a CRM record/summary are required; notes are optional.
- The logger links one Person, Company, Deal and Quote per type using the existing Tasks association picker. Company and Deal are inferred from related records when not explicitly chosen.
- An interaction is a completed CRM breadcrumb, **not** a Task or a message sent through an email provider. Logged methods and notes live in Activity.metadata.
- Activity History remains under Connections → More; the calendar and task/bookmark entrypoints do not revive the retired dashboard or nag the user about tracking.
- A month popover appears in Home, Tasks, Activity History, Notebook, and the desktop app header. Day badges show actual Task due dates, Deal due dates (bid due), completed touchpoints, and the latest scheduled follow-up for a visible quote.
- Date selection reveals an actionable glimpse with links to the corresponding record. Blank/unlinked CRM interactions open Activity History; personal tasks open Tasks.
- Tasks and quotes keep their existing privacy boundaries: calendar tasks are loaded from the current user's personal task scope and cloud quotes are limited to owned quotes. The server's existing CRM RLS still governs CRM records.

## Backend compatibility
The existing `public.activities` type check allowed neither `notebook-touchpoint` nor new `manual-touchpoint`. A narrow additive constraint migration allows both while preserving all previously allowed types and existing organization RLS. It was applied to the connected SalesShop project and verified with a constraint query. The matching SQL file is retained for source-controlled migration parity.

## Acceptance checklist
- Home quick Log Activity: all five methods, current date, notes, company/person/deal/quote linkage, no duplicate same-type associations, success persists through refresh and cloud reload.
- Role preview/viewer: no manual CRM logging; existing activity records remain governed by current read permissions.
- Tasks: personal deadlines and completed due tasks appear only for signed-in scope; clicking opens Tasks.
- Deals: due-date badge opens the Deal record; no fabricated deadlines for untimed work.
- Touchpoints: events render on the date of the interaction, including past-dated entries; unlinked entries open Activity History.
- Quote follow-ups: only last scheduled state per visible quote appears; cleared follow-ups disappear; no unauthorized private quotes surface via CRM activity.
- Phone: 7-column grid, numeric type badges, scrollable day glance, safe area above Safari bottom controls; date/time and association picker remain usable above the keyboard.
