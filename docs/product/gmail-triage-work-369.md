# Build #369 — Gmail triage shows existing follow-up work

## Motivation
Previously, **Review replies** suggested conversations even when an explicit personal follow-up Task was already created for the same email message. This added noise and hid the existing Task's due date or status.

## Product behavior
- **TOOLS → EMAIL** now uses the already loaded Gmail metadata to discover only the **latest message ID** per conversation, without fetching additional email bodies.
- With the existing SHA-256 message identity algorithm (org + Gmail mailbox + message ID), SalesShop matches the latest email to the personal Task `gmail-followup:<fingerprint>` and to any explicitly logged email Activity.
- Task/Activity status is computed in memory using the current signed-in user Task scope and hydrated CRM Activities. Neither raw message IDs nor any new email content is persisted by the status feature.
- A compact **Follow-ups** filter shows only loaded conversations with an outstanding (open, in-progress, or waiting) Task for their latest message. Lists show due date or overdue status and a **View in Tasks** shortcut using the existing RECORDS → TASKS navigation.
- A Task that exists for the latest message, even if completed, removes that email from **Review replies** (without implicitly marking anything read in Gmail or logging an Activity). A canceled/deleted Task does not suppress the suggestion. Completing a Task removes it from Follow-ups, with a completion label still visible under All.
- An incoming reply with a new Gmail message ID is **new work**. Older follow-ups do not suppress review suggestions for that new message.
- **All**, **Existing People**, **Unknown participants**, **Set aside**, **Mark reviewed**, **Snooze 3 days**, independent follow-up creation, and explicit Activity logging all remain available.
- An explicitly logged Activity is labeled **Activity logged** for that latest message only; it does not imply all Gmail mail was logged.
- This does not create, complete, or edit Tasks, log Activities, send emails, change Gmail data, store OAuth tokens, trigger reminders, or add any database tables.

## Verification
- New `gmailTriageWork369.test.ts` tests open/overdue/completed/canceled/deleted Tasks, Activity identity, last-message metadata, and old-message vs new-message fingerprints. Added to standard Cloudflare quick-quote gate.
- Cloudflare-equivalent QA builds with Node 24 + Bun 1.4.4, then production check.
- Manual: create a follow-up from a review candidate; see it under Follow-ups and out of Review replies; complete or delete it, return; receive a new reply, reload; check a different Gmail account/user; verify mobile list and navigation.
- Counts are for **loaded conversations** only. Gmail read-only OAuth and personal browser review settings remain unchanged.
