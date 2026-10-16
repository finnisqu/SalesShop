# SalesShop Headquarters — Developer Notebook & CRM (P4)

SalesShop Platform Studio is the home for the SalesShop business. It is separate
from the customer-facing SaaS workspaces. Its pages are:

- **Overview:** real registered-workspace metadata from `platform_console_overview`,
  CRM lead count, overdue/today follow-up count and Notebook page count.
  Usage telemetry and billing are not yet collected; no activity, active-seat or
  revenue figures are inferred from customers' private content.
- **Companies:** existing platform customer-workspace metadata only. No tenant
  contacts, team memberships, quote totals, revenue or private documents.
- **Notebook:** multi-page private rich-text editor, title search, pin/delete,
  heading/bold/italic/list/quote, undo/redo, account-specific cloud autosave.
- **SalesShop CRM:** create/edit lead companies, stages (Lead, Contacted,
  Demo, Trial, Customer, Cold, Lost), sources, notes, next actions and
  follow-up dates; contact names/emails/titles; logged touchpoints.
  Optional manual link from a lead to a registered company UUID is strictly
  **metadata only** and never grants access to that company's tables.
- **Developer Playground:** the prior full UI local-only test sandbox remains
  separately accessible with fictional content and its own browser namespace.

## Persistence and isolation

Migration: `supabase/migrations/202610120001_platform_headquarters.sql`.
Applied live to project `pvchgibllozuwickhfqz`.

`private.platform_workspace_documents` is keyed by
`(owner_user_id, document_kind)`; both documents are owned by the current
authenticated platform Developer, NOT by a tenant organization. RLS is enabled,
no direct client table grants or policies exist, and only the
`platform_hq_get_document` and `platform_hq_save_document` RPCs may access it.
Each uses `private.is_platform_developer()`, scoped `auth.uid()`, explicit
`security definer set search_path=''` and grants EXECUTE to authenticated
users only. Document versions, top-level shapes, record count and size limits
are checked server-side. Save requests include the current revision;
concurrent stale writes fail closed with SQLSTATE `40001` and the UI exposes
the conflict instead of silently overwriting another device.

The developer's existing `private_documents.notebook` record is deliberately
left untouched. The Headquarters Notebook starts fresh, not copied from any
former test/workspace records.

No World Stone owners, memberships, pricing, quotes, customer records, or
production data are modified. `main` remains frozen; changes land on
`architecture/react-foundation` via normal GitHub Pages deployment.

## What is NOT implemented

No aggregate usage tracking, employee active user counts, billing or subscription
status beyond already-configured metadata, support impersonation, server-side
role simulation, customer document access or live customer account actions.
Those require a privacy policy, explicit minimal telemetry events, retention
rules and security tests before enabling.

## Operating notes

Sign in with the separately enrolled platform Developer login, open Notebook
or SalesShop CRM in Platform Studio. Data saves automatically after edits, and
the screen shows save status. Pause before leaving if it says Saving; an
unsaved-change warning guards navigation. If a cloud-save error appears, do
not silently discard your edits: the Reload action intentionally replaces
unsaved changes with the last server copy.

The CRM is for *selling SalesShop*, not customer-company end customers.
New platform leads are empty by default and are never inferred from
an organization's presence in the database. Manually connect a sales lead to a
registered organization when the identity has been confirmed.

Next step: opt-in, minimally scoped analytics (e.g., per-organization active-seat
buckets and feature-use counts with no document details), followed by
subscriptions and GitHub release metadata.
