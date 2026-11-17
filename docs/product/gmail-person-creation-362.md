# Batch #362 — Create a CRM Person from a Gmail conversation

From **Tools → Email**, select a conversation. Under **Create Person from email**, choose a participant other than your connected mailbox. SalesShop offers an editable Person name and verified participant email.

- First check for existing CRM People with the **exact normalized email address**. If present, show **Open existing Person** rather than a create button; no duplicate gets created automatically.
- Suggest existing Companies from other already-linked People using the same *non-public* email domain. An exact resemblance between a Company name and domain label is a lower-confidence suggestion. The user sees the reason. Never infer an employer from Gmail/Outlook/other common personal domains or mere appearance in a conversation.
- If there is one strong existing-company suggestion, prefill the Company selection visibly, but saving the form still requires an explicit Create Person action. The user can select any Company, choose **No Company**, or choose **Create a new Company**.
- New Company names are entered by the user, not silently generated from email. Check normalized CRM Company identity first and reject duplicates; use the established resolveCompany and companyRelationshipPatch(...,'prospect') mechanisms. New Company is created only at form submission, alongside Person creation.
- Use standard createContact with the primary companyId FK and normal contact-created Activity. Do not create a fake email Activity or mark Quote delivered.
- Check permissions, original signed-in mailbox, SalesShop org/user scope, selected Gmail thread and recipient address just before writing. Double submission is blocked. Failed Person creation after Company creation leaves a recoverable Company selection to prevent retry duplicates.
- No Supabase migration or change to Google OAuth scopes. Email bodies, tokens and headers are not persisted in this feature. Incoming/outgoing auto-match remains live/read-only while Gmail is connected.

Acceptance: choose unknown sender, create with suggested existing Company; choose another participant; test personal Gmail address (no employer inferred); create new Company as prospect; duplicate existing email; unauthorized CRM role; change email account or org mid-form; narrow mobile layout; connected Cloudflare build.

## Next: explicit Gmail Activity logging (#363)

The next batch adds a per-message Log email Activity control on Gmail thread detail and the Person/Deal record conversation reader. Last Contacted and standard CRM Activities are driven by this user-confirmed action, never simply by reading Gmail. See docs/product/gmail-activities-363.md.
