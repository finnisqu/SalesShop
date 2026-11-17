# Build #365 — Email Activity + personal follow-up in one confirmation

## UX

Within **TOOLS → EMAIL → selected conversation** and **Person/Deal → Email conversations → Read**, the existing **Log email Activity** form gains **Also create a personal follow-up Task** (off by default). When enabled, the user can set a Task title, due date, due-date shortcut, priority and private Task notes. A single explicit click logs the selected email and creates the follow-up.

- Existing Activity behavior and original Gmail message date are preserved.
- Existing Task-only workflow remains accessible in the collapsed **Create follow-up without logging email** section. This avoids two full forms competing for screen space.
- A message already logged but missing its follow-up can be safely retried with the checkbox checked. The deterministic hashed Gmail message fingerprint prevents duplicate email Activities and duplicate personal Tasks. If the Task step fails, show an explicit partial-success message and allow a retry.
- If the Task already exists, show that state and do not create another, even if it has been completed; explicit deletion permits new creation.
- Private Task links are the exact Person plus their existing Company and any explicitly selected Deal. No automatic Deal association.
- The Activity is shared with CRM via standard Activity persistence. Personal Tasks use existing per-user task sync. Only the editable Activity and Task notes are persisted; Gmail body, raw message/thread IDs, mailbox and tokens aren't saved.
- Read-only CRM roles, preview perspective, invalid Gmail token, changed user/org/mailbox, invalid/past due date and unhydrated personal Tasks block new writes.

## Conservative reply-needed suggestions

The same conversation reader displays a **Possible reply needed** hint when the most recent loaded Gmail message:
- Is from one external sender and addressed directly to the connected mailbox.
- Is between 24 hours and 14 days old.
- Doesn't use a common automatic/no-reply sender local-part.
- Has no later message from the connected user in the loaded conversation.

The hint is advisory, not a confirmed unanswered email. It explicitly asks the user to verify in Gmail and only sets up the form when **Plan a follow-up** is clicked. It doesn't log, write Gmail, create Tasks, mark Last Contacted, or send messages automatically.

## Validation

- Targeted tests: src/services/gmailCombinedWorkflow365.test.ts, predecessors #359/361/362/363/364, and standard quick quote/CRM regression build.
- Simulate partial success (Activity saved, Task creation failed), retry, already-logged email, already-completed Task, changed account, invalid date and changed Person/Deal.
- Check suggested vs non-suggested conversations, sent replies, no-reply senders, wrong recipients, old conversations and outgoing-only emails.
- Check mobile input sizing, compact collapsed standalone Task option, Cloudflare build result, and real Gmail account end-to-end before claiming UI acceptance.

## Next

Potential future sync: verified background Gmail OAuth and unanswered-thread checks with explicit user consent, tenant RLS, strong credential storage, and email privacy controls. Neither this feature nor the current read-only Gmail token provides always-on monitoring.
