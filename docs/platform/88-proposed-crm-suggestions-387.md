# #387 — Proposed Records & Smart CRM Suggestions v0.1

**November 18, 2026.** Implements a deterministic, manual-review Suggestions inbox in **Tools → Suggestions**. Source is prepared for the existing Cloudflare TypeScript/Vitest/record-gate/Vite build; authenticated browser acceptance is separate.

## Working behavior

SalesShop proposes, but never automatically writes, three kinds of changes from *recent, manually logged Activities*:

1. **New Person:** A manually logged Activity explicitly includes a name and email in a format such as `Contact: Jane Smith <jane@example.com>` or `Met with Jane Smith (jane@example.com)`. If no Person already has the normalized email or normalized name, the inbox proposes creating one. The user can review/edit the name/email and explicitly Accept. If the Activity already links to an existing Company, the new Person inherits that exact Company ID only when the Company is still available. Existing CRM `createContact` is used. Cloud mode waits for `syncNormalizedCrm` acknowledgement before reporting a confirmed Person save.
2. **Existing Person → Activity:** An Activity contains **exactly one email**, it uniquely matches an existing Person, no Person is already linked directly or through metadata, and the Activity/Person Company IDs do not conflict. The inbox proposes attaching that exact Person to the Activity. Accept calls the existing server-confirmed `updateActivity`; the Activity summary, timestamp and other existing record links are preserved. It does **not** connect a Person directly to a Deal or update that Person's record.
3. **Follow-up Task:** An Activity explicitly states `Follow up by YYYY-MM-DD`, `Follow-up on YYYY-MM-DD`, `Call back by YYYY-MM-DD`, or similar unambiguous wording. The date must be valid and no more than 30 days past or 90 days ahead. A private Task is proposed, prelinked to existing Deal/Company/Person IDs where present. The user can edit the Task title and due date, then explicitly Accept. Creation uses the existing private Task store with a stable `suggestion:follow-up:<activity ID>` source key, so editing the Activity or accepting twice does not create a second Task. Cloud Task creation queues normal private Task sync; the interface explicitly calls that pending, not an immediate server-confirmed save.

The inbox includes **All**, **New People**, **Record links** and **Follow-ups** filters and Accept / Edit (where relevant) / Review / Dismiss actions. Dismissal stores **only a versioned suggestion ID**, not the source Activity, email, or generated record content, in a browser-local key scoped to current user and organization. If the Activity changes, a new, reviewed version can legitimately reappear. Source Activities are not modified by dismissal.

## Deliberate limits

- This first slice reads only **manual-touchpoint** and **notebook-touchpoint** Activities (so Notebook-originated *logged* interactions qualify). It does **not** scan full Notebook pages or Gmail, use machine learning, perform background monitoring, infer relative dates like “next week,” or identify People by name alone. Those additional evidence sources require separate user consent and visibility checks.
- Only the current user's Activities are considered in cloud mode, requiring `metadata.recordedByUserId` to match. Unattributed legacy entries, other sellers' entries and automatic system activity types are excluded. In local mode, local manual Activities are considered.
- Only Activities from the last **60 days** are considered. Scanning is capped at 120 recently recorded matching Activities and 90 proposals. Multiple emails in one Activity, ambiguous existing emails, conflicting Company associations, or name collisions do not produce a Person suggestion.
- Accept permissions are rechecked. CRM must be hydrated, user must have CRM-area edit access, and role perspective must be disabled. Creating private Tasks also requires the exact current personal Task scope, with cloud sync `saved`. A proposal is recomputed immediately before acting; changed evidence is rejected.
- No suggestion auto-sends a customer email/text, changes a Deal stage, creates or issues Quotes, modifies existing Person details, grants permissions or publishes custom fields. No Supabase schema/RLS migration, new server worker or provider consent.
- In cloud mode, a failed Person save can leave a local CRM cache entry pending sync. The UI warns not to recreate that Person. A Task's standard background private sync can remain pending; it is not misrepresented as cloud-confirmed.
- Existing Activity and Task creation APIs are reused, preserving record integrity and their existing permission and recovery behavior.

## Acceptance checks

- [ ] Exact GitHub commit passes Cloudflare `npm run build` (TypeScript, Vitest, record gate, Vite).
- [ ] Tools → Suggestions appears on desktop and mobile, with consistent header/nav in WARM/LIGHT/DARK, and no overflowing action buttons at narrow desktop sizes.
- [ ] Log manual Activity: `Contact: Jane Smith <jane@example.com>. Follow up by 2026-12-10.` Review. Verify Person and Task cards appear, with editable fields. Dismiss a card, reload, verify dismissed locally.
- [ ] Accept the Person. Confirm a new Person is created (and cloud save confirmed when signed in). Existing email/name prevents an extra duplicate.
- [ ] Log an Activity containing the unique email of an existing Person but no Person link; review and Accept. Verify the original Activity now shows the linked Person without changing its summary or unrelated associations.
- [ ] Accept an explicitly dated Task; verify the title, due date and record associations in Tasks, reload after private cloud sync, and confirm no duplicate proposal.
- [ ] Try an Activity with multiple emails, an unknown name, duplicate Person emails, conflicting Company IDs, invalid date, or “call next week” wording. No speculative Person/Task action should appear.
- [ ] Switch account/organization; dismissal history and available Activities must not leak between users. A viewer or active role perspective can review but never accept.
- [ ] Verify existing Automations, CRM imports, Activity edit history, Quotes and existing Tasks work unchanged.
- [ ] Force a cloud save failure: no false “confirmed” notice, and the Person cache uncertainty is explicitly explained.

## Next

Expand optional inference sources only after individual source permission/visibility review. Potential #388: Notebook **selected-text** suggestion intake (without bulk scanning) or an on-demand review option when manually logging Activities. More sophisticated AI extraction should be opt-in, review-first and measured against false positive risk. Shared organization-wide queues and server automations require separate authorization and schema design.
