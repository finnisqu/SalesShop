# #395 — Gmail forwarded-chain address discovery and searchable CRM linking

**Status:** Implementation PR, not yet deployed or verified with live Gmail. No new server OAuth scope, Gmail writes, or production database migration.

## What users can do

1. Open a Gmail conversation under **Tools → Email**. SalesShop reads the visible conversation's Gmail MIME text and detects literal `name@domain.com` addresses from From/To/Cc, **Reply-To**, and bodies including quoted/forwarded threads. HTML-only builder notifications are safely converted to plain text; no remote HTML, scripts or attachments execute.
2. An unobtrusive **Recognized People in this conversation** row shows CRM People whose saved email addresses exactly match detected ones, including historic correspondents not listed in the current From header. Click a name to open its CRM Person page.
3. Expand **Detected email addresses** to review all found addresses, their evidence (Reply-To / Mail header / Message or forwarded chain), and matching People. Click **Create Person** beside an unknown email to prefill the Create Person form. Users can edit the proposed name, choose an existing Company or create a Prospect Company. A forwarded/quoted email is **not proof of the sender or ownership**; all suggestions require user review.
4. For a list of already loaded Gmail conversations, **Find People in message contents** scans the selected page of threads on demand, in batches of two, and updates each row's existing-People badges in memory. It is intentionally opt-in to avoid fetching every private message body unnecessarily. Opening an individual conversation always scans that conversation. Switching accounts, searching a different mailbox or reloading drops the in-memory discovery cache.
5. The **Link record** action now uses the shared `UnifiedRecordPicker`: type to search People by name/email or Deals by name/company, select a suggested record, or choose **Create New record** and create a Person or Deal in place. Creation only stages a selected record; **Link conversation** is still a separate deliberate confirmation and thread links remain browser-local, as before. When creating a Person from that picker, the user can also choose **Enter manually / no email yet**; empty email fields remain empty and don't fabricate Gmail matching.

## Limits and safeguards

- Only exact email-address matches identify a CRM Person; a shared domain alone is not identification.
- Very long individual Gmail messages are read to a bounded 100k-character text excerpt for discovery, while the displayed message remains capped at 12k. The latest 40 messages of a thread are inspected; there is no guarantee of finding addresses beyond the current MIME limit or in image/attachment text.
- Email addresses quoted by other people can be outdated, copied from unrelated proposals, or impersonated. The UI labels their origin; it does not automatically create, link, enrich, reply, log activities, or set follow-ups.
- Existing-Person matching from body text does not turn a quoted address into an automatic reply obligation. A manual Person with no email will not be matched to Gmail until an address is assigned.
- Body-derived addresses do **not** affect the automatic **Review replies** status. The review algorithm remains based on header-only metadata to avoid creating a false follow-up obligation from a quoted historical participant.
- Suggestions and scanned addresses stay in memory only, scoped to current Gmail mailbox and SalesShop organization/user; they are not written to browser storage, Supabase, CRM Activities, Gmail or an external enrichment service. Only a user-confirmed Person/Deal creation writes the usual CRM fields.
- Gmail integration remains read-only with short-lived in-memory access tokens. No refresh token or background sync is introduced.
- The new UI is accessible with keyboard/mobile-friendly controls and follows the current shared search/create pattern.

## Verification before release

- [ ] Run `npm run test:gmail-body`, `npm run test:gmail-connection`, TypeScript and full build.
- [ ] Test real Gmail with forwarded builder-platform messages, real Reply-To addresses, long quoted chains, HTML-only messages, and multipart/alternative messages.
- [ ] Confirm People matching and the Existing People list update only after opening or opting into the body scan; verify no false link or false completed reply review.
- [ ] Verify Create Person from a quoted address, duplicate detection, Company selection/create, Deal creation and search by contact email inside **Link record**.
- [ ] Verify Gmail sign-out, changed SalesShop user/organization, expired token, thread reload, and browser reload cannot retain a previous mailbox's matches or create from stale content.
- [ ] Validate mobile picker keyboard behavior and no dialog overflow. Keep PR #394 popup-primary work separate and avoid disrupting a currently connected Gmail browser session with an unannounced deployment.

**This batch is not activated in production until built and the Gmail browser smoke test is performed.**
