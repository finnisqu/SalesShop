# Owner perspective switcher

This is a **UI simulation for an existing Owner**, not account impersonation, authorization testing, or a change to any Supabase role. The actual Owner's JWT and database privileges remain unchanged.

## Workflow

1. Sign into a cloud workspace as the **Owner**.
2. Open **Preview as** in the desktop header, or **Roles** in the mobile command bar.
3. Select Admin, General Member, Salesperson, Estimator, Purchasing, Project Manager, or Viewer.
4. A persistent top banner identifies the simulated role. Switch among perspectives from the banner without signing out.
5. Use **Exit Preview** in the banner to return instantly to the normal Owner interface.

The selection lives only in React memory, not the database or localStorage. Refreshing the page clears preview. The banner also clears it if the real account is no longer Owner.

## Safety and fidelity

- All actual backend and cloud authentication continues as the original Owner. The preview has **no write/impersonation privileges** of its own.
- Screens for simulated roles with edit access render their existing interface **inert**; they cannot be clicked, edited, or used to send customer-facing quotes while previewing.
- Simulated areas without write access use the existing navigable, read-only ViewerWorkspace browser for safe inspection.
- The simulated **Settings** section explains role capabilities without displaying real Owner management controls.
- Preview route gating is driven by the simulated role/department; no mutation is made to `organization_members` or `team_invitations`.
- Quote Send buttons are visibly disabled in an Estimator simulation, in addition to all previewed editor controls being inert.
- Global Quick Create and Search are hidden during active preview to prevent cross-surface mutations.
- This is for checking layouts and navigation, **not verifying RLS**, private data redaction, actual team sharing, or full edit flows. Use separately signed-in test accounts for those tests.

## Manual QC

- Owner sees role selector desktop and mobile; Admin/Member/Viewer do not.
- Role selection shows banner on every tab. Changing tabs preserves perspective.
- Banner never scrolls away; Exit Preview is always visible on a phone.
- Estimator preview has a quote draft editor layout but cannot Send or edit.
- Viewer preview provides a navigable read-only Board/Quotes/Catalog/Connections.
- Purchasing preview shows Supplier navigation and read-only references elsewhere.
- Settings preview never exposes real Owner team-management controls.
- Switching roles in the banner works without signing out or reloading.
- Exit Preview restores normal Owner editing and removes banner instantly.
- Reload/sign out resets preview; Owner/real member records are unchanged.
- Unit tests and GitHub Pages build must pass before broad use.
