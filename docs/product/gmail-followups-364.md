# Batch #364 — Gmail → follow-up Task

## Workflow

From **TOOLS → EMAIL** or a Person/Deal **Email conversations → Read**, select an email message and an existing matching CRM Person. The **Create follow-up Task** action now appears alongside **Log email Activity**, independent of it.

- Prepopulates an editable “Follow up · Person” Task title and notes from the email subject and date (never the body). The user must explicitly submit the Task. Defaults to tomorrow, with Today/Tomorrow/In 3 days/Next week shortcuts and editable native due date.
- Supports low/normal/high/urgent priority. Saves via the existing personal Task system with type='follow-up', queue='Follow-ups', and normalized Person + actual Company + optional selected Deal associations. No Deals are inferred from the domain alone.
- One follow-up per Gmail message per personal Task user. Source key is a SHA-256 of organization, normalized Gmail mailbox and selected Gmail message ID, stored only as a fingerprint, not the underlying Gmail ID. Duplicate clicks and revisits find the current Task, including completed Tasks. An intentionally deleted Task may be recreated.
- Preserves existing Gmail scopes: no extra Google OAuth, no Gmail writes, no auto Activity logging, no email body/token/mailbox persistence in Task. Only user-edited title and notes from email are saved as private Task content.
- Checks current user, org, Gmail token, CRM permission, private Task scope, actual Person email participant, and selected Company/Deal before creation. Rechecks after source-fingerprint async derivation to prevent identity changes from causing cross-account writes.
- Shows “View in Tasks” to navigate to RECORDS → TASKS and retains normal Home Agenda visibility. Any personal-task cloud sync failure remains visible to the user rather than falsely claiming a confirmed server save.

## Validation

Run targeted src/services/gmailFollowUp364.test.ts and Gmail predecessor tests as part of the standard build gate, and reproduce Cloudflare Node 24+Bun 1.4.4 build on isolated QA branch before updating main. Manual tests: incoming and outgoing Gmail; selected message vs another message in same thread; multiple matching Persons; Person with/without Company; Deal association; wrong Company or changed access; duplicate attempt before and after reopening; completed/removed task; due date shortcuts; Activity logging remains independent; mobile layout; private Task appearing in HOME/RECORDS.

## Next

Consider one-click **Log email & create follow-up** and interactive follow-up suggestions on conversations that are actually unanswered, with review and opt-in. Continuous background inbox monitoring requires a separately reviewed server-side OAuth token architecture.
