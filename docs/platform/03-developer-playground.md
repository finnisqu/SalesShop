# P3 — Developer Playground (local-only first batch)

## Shipped design

**Platform Studio → Developer Playground → Launch Playground** opens the real React SalesShop
workspace on `?studio=playground`. The menu includes Overview, Companies, and
Developer Playground. The authenticated developer-only preview is editable; its
floating `◇ Playground` control resets demo content or returns to Platform Studio.

**This is NOT a staging Supabase backend.** It is a carefully isolated *local-only*
app preview for interaction/design testing, with fictional starter content.

- `src/lib/supabase.ts` exports `supabase=null` and `supabaseConfigured=false`
  for the Playground route, even in deployed production builds. This blocks
  ordinary customer-data, sync, quote-sharing and admin RPC paths at their
  common client interface. Only `playgroundIdentityClient`, which is not used by
  tenant stores, can contact Supabase Authentication and the narrowly scoped
  `public.is_platform_developer()` identity RPC.
- `DeveloperPlaygroundGate` requires a Supabase Auth session and a **true
  server-verified Developer role** before the app mounts. Failed checks show
  an access-denied screen and never show the workspace.
- Company CRM, quotes, signatures, notebook, materials, rates, sinks, supplier
  imports, appearance and navigation store data are under the
  `salesshop-playground-v1:` key namespace, separate from regular cloud
  cache keys. `resetPlaygroundStorage()` removes ONLY that namespace.
- Sample construction firms, projects, contacts, quotes, brand and materials
  are invented, clearly labeled Demo/Fictional/Sample, and email addresses use
  the reserved `.example` suffix.
- Normal `main` is untouched; no migration or new tenant records are needed.

## Using it

1. Sign in using the separately provisioned Developer login.
2. Open **Developer Playground** on Platform Studio's left/top navigation.
3. Click **Launch Playground**. This navigates to the same deployed app,
   authenticated through the developer identity RPC but with all business
   Supabase services turned off.
4. Navigate anywhere within the app; edit projects, quotes, notebook and
   local catalog items. Results remain in the same browser across reloads.
5. Tap **◇ Playground → Reset demo** to restore the original fictional data.
   **← Platform Studio** exits the preview and restores the real Developer shell.

## Limits and next phase

The full React layout is available, but tenant-cloud workflows intentionally
cannot run (company invitations, quote sending/sharing, publishing normalized
supplier catalogs, team permissions, RLS and subscription operations). Testing
those securely requires an entirely separate staging database, isolated Auth
users and data, and a staging app deployment. **Do not simulate tenant Owner
status by elevating Developer privileges on customer records.**

This preview is currently tied to this browser's local storage, not backed up
or shared across devices. It is safe for UI/logic experimentation, not for
authoritative security regression or production-change approval.

Follow-on batches: role and viewport simulation inside the preview; dedicated
staging Supabase project with explicit cost approval; automated browser checks;
release/version controls. Code editing still occurs via GitHub development
branches and normal validation/rollout.
