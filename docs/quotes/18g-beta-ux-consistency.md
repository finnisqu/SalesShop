# Batch 18G — Quotes Beta final UX consistency pass

**Scope:** React development only. Classic Quotes stays selectable. No production
`main`, Supabase, Edge deployment, or new CRM permissions.

## Corrected inconsistencies

1. **One document lifecycle vocabulary** in phone, desktop and document library:
   - Draft/Ready: Review and issue, with explicit pricing blocker counts.
   - Sent/Viewed: Share **issued** quote or schedule; issuing alone does not send it.
   - Signed: View signed quote or schedule; never invite a second issue.
   - Declined/Expired: Review revision options, not an unusable sharing action.
   - Archived: View archived document, with restore required for any action.
   - Status badges use "Issued" and "Ready for review" instead of internal values.
2. **Review now matches the real four-stage handoff:** Preview → Approve →
   Issue → Share. "Issue and share" was misleading because issuing never
   automatically creates a link, transmits an email or confirms delivery.
   The fourth stage appears explicitly after issue and explains manual
   delivery confirmation.
3. **No phantom send wording:** Reviewed drafts require approval *before issuing*,
   not "before sending". Desktop's inspector explains the actual next action.
4. **Mobile and desktop share the same source of truth.** The fixed phone footer
   and desktop inspector both use `quoteBetaPrimaryAction`; a newly issued or
   signed quote no longer carries an "Review & issue" CTA.
5. **Preview instructions** use the four-stage process and customer-option text
   correctly says review before "issuing or sharing".

## Regression coverage

- `quoteBetaLifecycleLanguage.test.ts`: complete document-status, archival,
  Pricing Schedule and blocker mapping.
- Existing phone customer issue regression verifies the explicit fourth stage.
- Existing desktop historical-revision regression verifies that changing to a
  new draft switches the action back to Review & issue.
- Preserve existing Playwright role names for the draft Review entry point.

## Deliberately deferred (not Classic sunset ready)

No rewrite of the quote calculator, no theme redesign, no new mobile route,
no direct email send or automatic delivery proof. Real authenticated cloud
link/signature/RLS testing still requires a separately approved, isolated
Supabase staging project. Final user acceptance needs actual jobs and both
phone landscape and desktop with signed historical snapshots.
