# #384 — Reusable personal workflow templates and multiple custom rules

**November 18, 2026 · Automations v0.3.** Source prepared; production status and authenticated device checks must be recorded separately.

## Working user experience

**Tools → Automations → My workflows** now supports up to eight **independent** custom Deal-stage-to-Task rules. Users can select **Blank**, **Bid follow-up**, **Negotiation checkpoint**, **Won Deal kickoff**, or **Discovery follow-up**. Template selection is opt-in and creates a **disabled** personal rule; selecting a template does not generate Tasks.

Each workflow can be enabled or paused, renamed, given a Task title, assigned one live Deal stage, scheduled 1–60 calendar days after its trigger, and set to Normal or High Task priority. Users can duplicate a rule (duplicate starts disabled) or remove it after an inline confirmation. Removing a workflow never deletes previously created Tasks.

The existing four Automations v0.2 built-in rules and their settings remain intact.

## Safeguards and lifecycle

- Rules stay inside the existing **browser-local Task-scope configuration**. The same scope-switch hydration, role/perspective restrictions, cloud Task-sync barrier and app-open-only execution cap apply. They do not alter CRM stage definitions, submit quotes, email customers or create notifications.
- A custom rule triggers only from a **real, latest** `project-stage-changed` Activity whose destination matches the Deal's **current** stage and that rule's selected stage. The event must be from the last 14 days. In cloud mode the Deal must currently belong to the signed-in salesperson.
- Stable rule IDs and immutable source keys (`automation:custom-stage-task:<rule-id>:<deal-id>:<stage-event-id>:<stage>`) prevent changing the workflow's display name or Task title from creating an extra Task. Previously created, canceled, or deleted Tasks in the loaded private Task history suppress another Task from that same event/rule.
- Separate rules may independently match the same event; each has a distinct reference and may deliberately produce its own Task.
- Execution re-checks the **specific custom rule** is still enabled, present, and matches the stage at execution time; disabling or removing a rule after preview prevents task creation.
- Settings reload validates IDs, supported stages, titles, offsets, priorities, limits, and duplicates. Unknown or corrupted saved rows fail safely. History retains the rule ID after a workflow is removed and displays a clear fallback.
- Manual Run remains explicit; automatic execution needs the existing **Automatically run enabled rules while SalesShop is open** option and remains capped at 20 Tasks per open app session. This is **not** a server scheduler or cross-device transactionally unique queue.
- No Supabase migrations, shared organization settings, RLS changes, providers, billing, quote pricing, or CAD-Lite integration.

## Acceptance

- [ ] Confirm the exact commit passes TypeScript, Vitest/quick quote tests, record gate, and Vite in Cloudflare.
- [ ] Tools → Automations lists the original four rules and **My workflows**. Add Bid follow-up template and verify it's Off by default.
- [ ] Edit its name, Task title, chosen stage, offset (try 4 days) and priority. Reload; settings persist only under this user/workspace.
- [ ] Add and independently enable a second workflow on the same stage, duplicate it, and verify the duplicate is Off. Delete one and verify old Tasks remain.
- [ ] Confirm both enabled workflows preview different Tasks for a **recent recorded** matching stage transition assigned to this salesperson.
- [ ] Manually run the rules, reload, and confirm no duplicate Task from an existing key even when a Task was completed or deleted.
- [ ] Disable one rule after preview; verify it cannot execute. Switch account/organization and verify unrelated custom rules are not shown.
- [ ] Confirm viewers/perspective mode and a cloud Task-sync-in-progress cannot execute rules. Check WARM/LIGHT/DARK and desktop/tablet/mobile widths.
- [ ] Verify all three original rule settings and the v0.2 configurable stage rule persist unchanged.

## Next opportunities

Multiple event types (Company/Person or email-derived events), reusable Task checklists, staged approvals, and organization-level workflow sharing should be treated as separate, deliberate projects requiring proper authorization and schema design. CRM Setup draft stages are not live stages and are intentionally unavailable as automation triggers until explicitly published.
