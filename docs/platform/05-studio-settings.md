# P5 — SalesShop Platform Studio Settings

The dedicated platform Developer account opens **Settings** from the
Platform Studio navigation. This is not the Settings page belonging to World
Stone or any other company; it is a separate, developer-only Headquarters
workspace.

## Ready-to-use settings

Studio preferences are stored in `private.platform_workspace_documents`
under a third document kind `settings`. Only the same dedicated Developer
account can read and change its settings using the existing
`public.platform_hq_get_document` and
`public.platform_hq_save_document` RPCs, which enforce active platform
Developer identity and use the current `auth.uid()`. Changes autosave using
optimistic revision checks and propagate between signed-in devices.

The first Settings page supports:

- **Start page:** Overview, Companies, Notebook, CRM, Developer Playground,
  or Settings. The selected landing tab opens on the next Studio login/page
  load, without automatically entering the Playground sandbox.
- **Density:** Comfortable or Compact, scoped to the Developer Studio.
- **Accent:** Gold, Teal or Blue, affecting Studio chrome only.
- **Follow-up summary:** show/hide on the Studio dashboard; CRM tasks and
  contacts are never deleted or modified by this switch.
- **Developer identity:** read-only signed-in email, verification indicator,
  platform role and reminder that Developers cannot hold company memberships.
- **Password reset:** request an email to the *current signed-in Developer
  email* via existing Supabase Auth password-reset flow. No plaintext
  password is stored by Settings or requested in the app.
- **Export private Headquarters data:** download a JSON archive of this
  Developer's Notebook, SalesShop CRM and Settings after all three documents
  load and save. Never exports tenant records; the file contains confidential
  SalesShop business notes and leads, and should be stored securely.
- **Developer Playground:** shortcut to fictional, local-only SalesShop preview.
- **Platform status:** registered company metadata count, lifecycle-configured
  workspace count, and correctly labeled unimplemented billing provider,
  privacy-limited usage analytics, support access and release controls.
- **External links:** GitHub architecture branch, Actions and Supabase
  project console. A link grants no new SalesShop access.

## Privacy and changes

Migration: `supabase/migrations/202610120002_platform_studio_settings.sql`.

The migration *only* adds `settings` to an existing Developer document-kind
check constraint, extends the private validator, and lets the existing
Developer-protected getter read this document type. It does not change the
existing save function's Developer authentication guard, organization
membership or other tenant table security.

The settings shape is strictly limited to:
`{schemaVersion:1,startTab,density,accent,showFollowUps}`.
Server-side validation requires listed enum values and a boolean follow-up
preference. Unknown accounts still cannot read, save, or enumerate private
Developer documents.

No usage tracking or billing configuration is activated by this release.
No World Stone or customer data is copied into Platform Studio.

## Implementation

- `src/platform/headquartersSettingsTypes.ts`
- `src/platform/HeadquartersSettings.tsx`
- `src/platform/headquarters-settings.css`
- `src/platform/useHeadquartersDocument.ts` (extended document kind)
- `src/components/DeveloperConsole.tsx` (Settings route, preferences)
- `src/services/platformStudioSettings.test.ts`

Production is built from `architecture/react-foundation`. The stable
`main` branch remains untouched.
