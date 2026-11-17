# Build #366 — Task-first Gmail actions for existing People

## Why

Gmail Person matching automatically displays conversations but does not create CRM email Activities. Batch #365 hid the separate Task-only workflow behind an expandable section beneath a more prominent Activity form. When a message was already logged, the Activity submit was disabled, making follow-up creation look unavailable.

## Changes

- A shared message, Person, Company and optional Deal selector appears first. When possible, existing People are preselected by exact address or the open Person record.
- Directly below the selectors, the independent Create follow-up Task form is visible whether or not this message has been logged as an Activity. Submitting creates a personal Task without logging an Activity, changing Last Contacted, or writing Gmail.
- The optional Activity logger is in a compact expandable panel. An already-logged message has a status-aware title instead of a disabled button dominating the screen.
- The combined Log email + create follow-up option remains inside the Activity panel for intentional combined actions. Deduplication and safe retry logic remain intact.
- The possible reply needed prompt selects the suggested message for Task planning; it does not turn on Activity logging.
- Tools Email description clarifies matching vs logging vs Tasks. No schema, OAuth, storage or privacy changes.

## Acceptance

1. Existing Person → Emails → Read an auto-matched message. The standalone Create follow-up Task controls are visible below the common selectors even if the message was already logged.
2. Create Task without opening the Activity panel. Check RECORDS → TASKS for the Task; no new CRM email Activity or Last Contacted change.
3. Reopen message; a duplicate Task is not created, and Activity state is unchanged.
4. Test Tools Email with one and multiple matching People, linking an optional Deal, and with an unlogged message.
5. Expand Activity logging and test the combined save, already-logged case, invalid Gmail token, role permissions and mobile layout.

Validated in the Cloudflare-equivalent QA build; interactive Gmail account acceptance remains for the user.
## Next increment: on-demand triage (#367)

TOOLS → EMAIL now filters the currently loaded Gmail conversations into All, Review replies, Existing People and Unknown participants. A conversation can appear in multiple views when it has both existing and unknown CRM participants. All matching is exact email-address matching, not name/domain guessing. Review replies is only a sender/date *candidate* and never automatically logs or schedules a Task. It does not prove the mailbox has no response. Counts are explicitly scoped to loaded pages; Load more fetches additional records. Quick filter changes invalidate in-flight detail requests so rapidly switching filters cannot show the wrong email.
