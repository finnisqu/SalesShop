# Build #370 — Final email usability bundle

## Scope
Close the current Gmail prototype work with user-configurable review rules, fast search entry points and confirmed bulk triage actions. Keep read-only Gmail, independent follow-up Tasks and explicit Activity logging intact.

## Shipped features

1. **Review settings:** Accessible as a collapsed details panel in TOOLS → EMAIL; choose when a conversation becomes a review candidate (1, 2, 3, 5 or 7 days after latest message), how long to consider it (7, 14 or 30 days) and whether suggestions should involve only saved CRM People. Defaults preserve the former 1–14-day rule with all participants. Both summary triage and detailed reply hint use the same age thresholds.
2. **Quick searches:** Four one-click Gmail searches: Last 7 days, Last 30 days, Last 90 days, and Sent in last 90 days. Uses the current read-only Gmail search action. Manual Gmail query entry remains available and editable. No saved search query state is persisted.
3. **Batch triage:** In the **Review replies** filter only, reveal collapsed Batch actions with **Mark visible reviewed** and **Snooze visible 3 days**. Every batch requires a confirmation with the exact count of currently visible candidate conversations. Session/mailbox and timestamps are rechecked at submission; all selected review states are persisted in one browser write using the existing per-mailbox review storage. Snoozing is not a notification/reminder.
4. **Simple defaults and recovery:** Reviews continue to respect existing Tasks, new incoming Gmail messages, completed Tasks, and existing user-snoozed decisions. Switching accounts resets view-specific state; unsuccessful browser-storage persistence reports an error instead of claiming success.

## Privacy, tenancy and constraints
Only review settings (three primitive values) and explicit review decisions (thread references and timestamps) persist in scoped browser storage. Email subjects, bodies, snippets, recipients and OAuth tokens are never written by these new features. Gmail remains read-only. No Supabase schema, RLS, scheduled job, Activity or Task write was added.

Review counts apply only to loaded Gmail results; candidate classification is based on the last loaded sender/date and does not prove an unanswered email. The "existing People" condition matches exact CRM email addresses, not domain. No email feature should claim to have checked the entire Gmail mailbox or supplied push notifications.

## Validation
- Test file: `src/services/gmailTriagePrefs370.test.ts` covers defaults, mailbox/user isolation, sanitization, age ranges, only-known matching, search and settings UI source, batch decisions, bounded storage and no message persistence.
- Standard gate: TypeScript, quick-quote CRM test suite, Records gate and Vite production build under Node 24 and Bun 1.4.4 on isolated QA branch.
- Production Cloudflare check follows promotion to main; a green build does not establish authenticated UX acceptance.
- User acceptance: TOOLS → EMAIL, open Review settings, adjust the minimum/maximum; try only-existing People with a known vs unknown sender; test each Quick search; Review replies → Batch actions → Mark visible reviewed, then Set aside and Resume review; confirm independent Task and Activity actions still work; check WARM/mobile.

## Next priority
Pause new Gmail features and move to **CAD-Lite bridge v0.1 (P5)** with a safe Deal/Quote project link and explicit manual takeoff import. Cloud provider integrations, shared custom-field RLS execution and BYO documents remain separate gated priorities.
