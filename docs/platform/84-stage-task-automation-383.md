# #383 — Configurable Deal-stage Task automation

**Prototype v0.2 · November 18, 2026.** Source prepared for Cloudflare TypeScript, Vitest, record-gate, and Vite validation. Do not mark live or device-verified until the exact commit finishes successfully.

## Working feature

Open **Tools → Automations** and use **Deal reaches stage → Task**. A salesperson can select one of the **currently supported live Deal stages**, choose an offset of 1–60 days after the recorded transition, and save a 2–70 character Task name. The stage and title are browser-local and user-scoped. The rule starts **disabled**.

With the rule enabled, SalesShop previews eligible changes alongside the existing three automation rules. Users can **Run enabled rules** deliberately; opt-in automatic execution only occurs while SalesShop is open. This creates a private, Deal-linked, ordinary **Task** and never sends Gmail, Slack, text, or external notifications. Neither the chosen stage nor Task name changes any Deal.

## Trigger and safety

- Requires a real `project-stage-changed` Activity whose `metadata.toStage` equals both the chosen stage and the Deal's **current** stage, recorded within the previous **14 calendar days**.
- The Deal must be assigned to the current salesperson in cloud mode. Local mode follows the existing local rules.
- The most recent matching transition determines the due date and unique reference: `automation:deal-stage-task:<dealId>:<eventId>:<stage>`. An existing Task with that `sourceObjectId` (including a canceled/deleted Task in the loaded history) prevents another creation. A later **separate confirmed stage change** can generate a distinct Task if the Deal returns to that stage.
- Stage input is constrained to the actual, existing `PROJECT_STAGES` list; a saved invalid stage falls back to **Bid Sent**. Malformed title, overflow, control characters, and bracket markup are rejected to a safe default.
- Existing private Task syncing and scope guards, permissions, 20-task per-session automatic execution cap, explicit preview, and idempotent executor remain in place.
- This is not reliable server-side scheduling, and multi-device uniqueness is not guaranteed in the absence of a transactionally unique cloud queue.
- CRM Setup's **draft stage names** do not create live Deal stages and are intentionally not selectable here; publishing custom Deal stages requires a separate migration and compatibility plan.

## Check before accepting

- [ ] Cloudflare's exact `main` commit passes `tsc --noEmit`, quick-quote/Vitest, record gate, and Vite.
- [ ] In Tools → Automations, verify the fourth rule is initially **Off**, with stage and Task name settings and pending count.
- [ ] Pick a stage and custom title; reload and confirm both persist. Confirm other three rules retain their previous choices.
- [ ] Change a Deal's stage through the app. With the rule enabled, verify **Preview** lists a new, assigned Deal-linked Task with the right due date and title; manually run it, open the Task, reload, and verify no duplicate.
- [ ] Try a different Deal owner, no recorded transition, a stale transition, and disabled rule: no Task created.
- [ ] Verify viewer/perspective cannot configure or run; cloud Task sync must be saved before running.
- [ ] Check warm/light/dark and desktop/tablet/phone layout of stage selector, editable Task name, and action bar.

## Next

Evaluate editable task templates with multiple opt-in rule instances, or surface an Automation summary on HOME after device QA. External CRM writes, unattended processing, Gmail actions and scheduled processing remain separate guarded work.
