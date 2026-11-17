# Gmail v0.2a — automatic exact-address matching on Person records

A signed-in SalesShop user who has connected Gmail in **Tools → Email** can open an accessible Person record with an email address and see live, automatically matched Gmail conversations in **Email conversations**. Auto-matching is enabled by default for each Person/mailbox. No one needs to manually link every thread.

- Searches the connected mailbox's Gmail From, To and Cc fields with no default date cutoff. Fetches one page (20 threads), with **Load more** and **Refresh** controls.
- Filters the returned metadata by an exact, case-insensitive From/To/Cc participant email match before displaying a thread. Body/subject text, matching domains, or similarly named addresses do not qualify.
- Shows manually linked and automatically discovered threads together without duplicates. Manual links remain separately managed.
- Each user can turn matching off for a Person, hide a specific automatic match, or restore hidden matches. These choices are browser-local, scoped to SalesShop organization, user, Gmail mailbox and Person.
- Clicking **Read** fetches the actual message body from the connected Gmail mailbox. Token and messages stay in memory; no email bodies or recipient lists are written to localStorage or Supabase.
- This is live, on-demand discovery while the user is connected; it is **not** background sync, a team-shared email archive, automated email Activity logging, Quote delivery confirmation, or last-contacted mutation.
- It does not silently roll emails onto Deals or Companies. Existing explicit Deal/Person thread links keep working.
- On Gmail disconnect, token expiration, account or organization switch, message details become unavailable. Users reconnect to view email again.

## Verification
Run the targeted tests in src/services/emailAutoMatch361.test.ts and src/services/emailIntegration359a.test.ts. Test the production OAuth connection, an incoming and outgoing thread, a multi-participant thread, unrelated message text that contains the Person address, pagination, refresh, hidden thread restoration, Gmail disconnect and CRM identity switching.

## Next step
Offer explicit "Log email Activity" with thread-ID deduplication and reliable source timestamps, then persistent backend OAuth for offline sync only after user-approved credential storage, tenant RLS and restricted-scope Google verification. Do not auto-log or mutate Last Contacted from a partial Gmail search.
