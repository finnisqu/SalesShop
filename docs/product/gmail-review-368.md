# Build #368 — Personal Gmail review decisions

## Purpose

Make the **Review replies** filter actionable while retaining read-only Gmail and manual CRM logging. Previous triage only offered candidate lists; there was no way to clear known non-issues without losing the review prompt on the next search.

## Behavior

- Each candidate conversation in TOOLS → EMAIL has two lightweight choices outside its open button: **Mark reviewed** and **Snooze 3 days**. No dropdown or extra modal is necessary.
- Reviewed suggestions move out of Review replies and into **Set aside**. They stay reviewed until a new Gmail message changes the conversation's latest-message timestamp, or the user clicks **Resume review**.
- Snoozed suggestions move to Set aside until three days after the click, when they become Review replies candidates again. A new Gmail message also returns them early. A snooze is NOT a scheduled reminder or push notification; the status is evaluated when the Gmail screen is visited or refreshed.
- **All** still includes every loaded conversation; Existing People and Unknown participants are unaffected. Their counts and Review/Set-aside counts are explicitly for the currently loaded Gmail page(s).
- Decisions are stored only in browser localStorage under the signed-in SalesShop organization/user plus connected Gmail mailbox, with thread ID, timestamp, status and optional expiry. No email bodies, subjects, recipients, tokens, or new Supabase tables are stored. Another user/mailbox has separate choices.
- Opening a reviewed/snoozed thread suppresses the detailed **Possible reply needed** suggestion on the TOOLS → EMAIL screen; actual Person record matching and direct Task creation remain available.
- Buttons do not send Gmail messages, mark email read/unread, create Tasks, change CRM Last Contacted or auto-log Activities. Explicit independent follow-up and Activity workflows are unchanged.

## Validation

- Gmail #368 storage/TTL/account-isolation tests added to the existing Cloudflare quick-quote gate.
- Verify scope isolation, exact timestamp change returns suggestions, three-day expiry, malformed stored rows, bounded storage, and no email content persistence.
- Cloudflare-equivalent build under Node 24 and Bun 1.4.4 prior to release; production build must turn green.
- Manual browser checks: Review replies → Mark reviewed → Set aside → Resume review; Snooze 3 days; All/Existing/Unknown unaffected; reconnect as another Gmail mailbox; read Person and create an independent follow-up; narrow/mobile layout.

## Next

For true future notifications and multi-device queues, migrate opt-in review decisions to properly authorized tenant/user storage. That requires security design and Supabase schema review; this batch intentionally remains browser-local.
