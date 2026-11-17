# Batch #363 — Log selected Gmail messages as CRM Activities

## Product behavior

- In Tools → Email → a selected conversation, or after selecting Read from a Person/Deal email panel, show **Log email Activity**.
- Select one message from the conversation. The original Gmail sent/received timestamp is used as occurredAt; invalid or future dates cannot be logged.
- Select a CRM Person whose email exactly matches a participant in this thread. The user's actual Company is inherited by the Activity; optionally link one compatible Deal, or select a Company if the Person has none. Do not infer that every Deal at that Company participated.
- Display an editable notes field initially containing the Gmail subject. **Only the explicit Log email Activity action** writes the standard manual-touchpoint with interactionMethod=email. The user is told that notes and CRM relationships are team-visible. Message bodies, mailbox, raw Gmail IDs, recipients and tokens are never stored in CRM.
- Persist a deterministic SHA-256 fingerprint of organization, normalized mailbox and Gmail message ID in Activity metadata. The activity's deterministic ID includes the first 40 fingerprint hex characters, providing idempotent retries; the full fingerprint prevents duplicate logging of the same message, while newer replies are separate messages.
- Direction is marked sent or received from the connected mailbox. The existing CRM Person/Company/Deal Activity history and personLastContactIndex provide Last Contacted immediately using the original message date; the same underlying CRM store synchronizes the Activity.
- No automatic Activity creation on Gmail connection, search, read, Person creation, or manual thread link. No direct Quote delivery claim, follow-up automation, Google permission expansion, Supabase schema changes or persistent OAuth.
- Confirm the Gmail token, organization/user identity and CRM write permission at submission, and again after awaiting the source fingerprint. Reject switched workspaces and unavailable records. This batch does not attempt to claim server-confirmed synchronization—standard CRM cloud sync handles it.

## Acceptance checks

1. Connect Gmail and load a conversation involving a known Person. Choose one message, select that Person, optionally associate a compatible Deal, and log. Check it appears in the Person Activity history, Deal timeline, Activity worktable and Last Contacted.
2. Try logging the same message again, from Tools and from the Person record: should be disabled with a clear already-logged message. Log another reply: permitted.
3. Select a conversation without an existing Person: create Person first. Confirm Gmail matching does not write an Activity until you explicitly log one.
4. Verify default Company association follows the Person and does not attach the message to unrelated Deals.
5. Test an incoming and an outgoing message, nontrivial subject and editable notes, no message-body storage, expired token, role preview/read-only user, changed mailbox/workspace, and narrow/mobile view.
6. Run targeted Vitest, npm run build, and Cloudflare production build; do not claim browser acceptance without testing.

## Next

After real-account confirmation, decide on optional **Log Activity and Create follow-up Task** plus smarter unanswered-email suggestions. True always-on synchronization requires a separately reviewed server-side Gmail OAuth architecture with restricted scope verification, encrypted token handling and tenant authorization.
