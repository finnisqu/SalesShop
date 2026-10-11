# SalesShop Supabase foundation

This folder contains the database migration for the React architecture branch.

## Apply

Apply `migrations/20261005_sales_shop_cloud_foundation.sql` to the Supabase project, then configure the deployment with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (preferred) or `VITE_SUPABASE_ANON_KEY`

Without those variables SalesShop intentionally stays in local prototype mode.

## Current cloud boundary

This first backend batch uses document snapshots as a migration bridge:

- `crm`, `quotes`, and `signatures` are stored in `org_documents` and shared with members of the shop organization.
- `notebook` is stored in `private_documents` and can only be read or written by its owning authenticated user under RLS.
- localStorage remains an immediate/offline cache; authenticated startup hydrates it from Supabase before the application stores open, and subsequent changes are debounced back to Supabase.

The application/service seams remain unchanged so later batches can normalize Companies, Contacts, Projects, Quotes, Activities, and Signatures into row-level repositories without rebuilding the UI.
