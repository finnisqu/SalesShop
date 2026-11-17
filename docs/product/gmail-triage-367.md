# Build #367 — Gmail triage and CRM matching

## Goal
Turn **TOOLS → EMAIL** into a useful, low-clutter triage screen without expanding Gmail permissions, silently creating Activities, or storing Gmail content.

## What changed
- Four compact filters above the existing conversation list: **All**, **Review replies**, **Existing People**, **Unknown participants**, each with a count of currently loaded conversations.
- Existing People are identified by exact, normalized participant email addresses. Unknown participants are external addresses not present in the CRM. A conversation with both appears in both matching views; the list shows the matched Person names and unknown participant count.
- Review replies is a conservative candidate: the most recent message's sender is external and non-automated, the mailbox is a participant, and that last message is 1–14 days old. Gmail summary metadata alone cannot prove that an answer is outstanding. The screen tells users to open the full conversation to check, where the earlier detailed message-level hint is available.
- The current thread details, Create Person, independent follow-up Task, explicit Activity logging and manual link controls remain unchanged. The Gmail search query still controls what messages are loaded, and pagination remains explicit.
- Switching filters or search terms invalidates previous in-flight full-message reads, preventing an older response from replacing the selected conversation.
- No new Supabase schema, Google scopes, background sync, automated CRM logging or irreversible filtering. Classifications are computed in memory from the connected Gmail session, never persisted.

## Coverage and security
All counts and groups apply only to **loaded** Gmail results, not the whole mailbox. Grouping is on demand while a Gmail read-only token is valid. Automatic discovery under Person records and explicit shared CRM Activity/user-private Task storage are unchanged.

## Verification
- Unit/source regressions in `src/services/gmailTriage367.test.ts` run as part of `test:quick-quote`.
- Verify exact email matches, known + unknown overlap, outgoing/no-reply exclusions, loaded-only counts and no CRM mutations.
- Run the Cloudflare-equivalent QA build (Bun 1.4.4, Node 24) before promoting.
- Real account acceptance: connect Gmail, search recent mail, switch filters, load more pages, open a candidate, create a Person for an unknown address, log an Activity explicitly, create follow-up Task separately, try rapid filter switches, and mobile layouts.

## Follow-up
If Gmail triage proves useful, next explore user-approved “mark for follow-up” review queues with owner/account isolation and explicit off-line sync requirements. Persistent Gmail monitoring must be designed with secured server-side OAuth and tenant permissions; this feature does not implement it.
