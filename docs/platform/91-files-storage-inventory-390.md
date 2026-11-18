# #390 — Files & Docs storage inventory and BYO storage foundation

**November 18, 2026. Status: source-only first slice; no uploads, storage bucket, provider connection or production schema migration enabled.**

## Why this batch

SalesShop previously had a browser-local URL directory with links to files and folders attached to Companies, Deals, SalesShop Quotes and External Quotes. A user wants a real file workspace with sort-by-size, inventory accounting and the option to bring a customer's own storage SaaS.

The existing **Tools → Files** surface is now **Tools → Files & Docs**, with:
- An inventory/library table (search, linked record navigation, source/provider filtering, sort newest/oldest/name/provider, size sort gated until authenticated size metadata exists).
- Real counts for indexed links and providers, explicit unknown-size counts, provider breakdown.
- A separate **Manage links** mode preserving existing create/edit/remove dialogs, relationships and URL safety.
- No fabricated byte sizes, quota, billed usage, file uploads, company-wide visibility or server storage.
- Provider-neutral code in `fileStorageInventory390.ts` with `FileInventoryItem`, a capability registry, stable size sorting (unknown always last) and known-size inventory totals. Provider IDs cover SalesShop-managed Supabase, customer Supabase, S3-compatible services, Cloudflare R2, Drive, Dropbox, OneDrive and Box.

## Proposed durable architecture

**Control plane in SalesShop's Supabase PostgreSQL (future audited rollout):** Organization-scoped file index (opaque object ID, provider-connection ID, filename, exact provider-returned size in bytes, MIME type, category, optional folder, record links, uploader, timestamps, checksum and soft-deletion state). Provider credentials, refresh tokens, API keys and temporary signed URLs **never** stored in these public-facing metadata rows or in browser localStorage. The index powers sorting, filtering, record relationships, storage dashboards and permissions. Source provider remains authoritative for actual bytes.

**Storage data plane via adapters:**
1. **SalesShop-managed Supabase Storage**: opt-in default private bucket, organization-prefix paths, authenticated upload/download/delete, backend-confirmed metadata, RLS.
2. **BYO Supabase Storage**: an individual organization may connect its own Supabase project; SalesShop's backend brokers authorized operations with encrypted tenant-scoped credentials. The customer's external Supabase Auth/RLS cannot be assumed to accept a SalesShop user's JWT.
3. **BYO S3-compatible service / Cloudflare R2**: backend-managed credentials, bucket allowlist, presigned upload/download, provider-side size metadata. Never send long-lived S3 keys to the browser.
4. **Google Drive / Dropbox / OneDrive / Box**: existing links continue to work immediately. A *future* per-organization OAuth/provider connector may read file metadata (with permission); until then, link sizes and external storage usage are unknown. No automatic import of private files.

**Important:** Supabase's S3-compatible endpoint means standard S3 tools can interact with *Supabase Storage*. It does not automatically route managed Supabase objects into an arbitrary customer's S3 account. True BYO needs a separate storage adapter or a customer-owned Supabase project.

## Storage management requirements

| Feature | Indexed Supabase object | Unconnected link | Authenticated BYO provider (future) |
| --- | --- | --- | --- |
| Search, sort by name/date | Yes | Yes | Yes |
| Sort by actual size | When provider reports exact bytes | Unavailable | When provider reports exact bytes |
| Group by Company/Deal/Quote | Verified record association | Existing local association | Verified record association |
| Folder hierarchy | Virtual metadata prefixes | Existing folder URL | Provider-specific |
| Known byte usage by provider/org | Verified object metadata | Excluded | Provider metadata/usage APIs |
| Quota / billed usage / egress | Provider API or billing feed required | Unknown | Provider account/tenant permission required |
| Upload/download/delete | Under private-bucket policies | Open/remove link only | Authorized adapter operations |
| Trash, restore, versions | Separate explicit future policies | Remove/readd link | Provider-specific |
| Duplicates | Hash + scoped candidate review | No body access | Provider checksum when available |

**Do not label indexed bytes “Supabase billed usage.”** Supabase's billable storage may use average GB-hours, and external providers have distinct quota/billing semantics. A customer-facing usage dashboard must distinguish known object bytes, provider-reported quota and billing.

## Required security and production release gates before first upload

1. **Do not modify the live Supabase database or create a bucket in this batch.** Existing README staging hold remains in effect. Do not publish sensitive customer documents through a public bucket.
2. Design the private `sales-documents` bucket and a narrowly scoped file metadata table with explicit RLS for `organization_id`, member roles and authenticated uploader. Use organization+random object-ID prefixes to prevent path collisions and name enumeration. Restrict `storage.objects` LIST/SELECT, INSERT, UPDATE and DELETE per operation; never grant broad access based only on `TO authenticated`.
3. Record-level authorization: where Quote or CRM records are privately scoped, a user's access to the organization alone is not sufficient to disclose linked file metadata. The first rollout may deliberately restrict attachments to shared Company/Deal records until Quote permission parity passes.
4. Upload intent must validate organization, record, user, storage size/quota, MIME/extension safety and actor permissions on the server, then issue a short-lived scoped upload URL. Finalize only after verifying the *storage provider's* actual object size/type/path. Clean up incomplete uploads without overwriting existing paths. Consider antivirus scanning / block executable & HTML content for previews.
5. Downloads use authenticated responses or short-lived signed URLs; do not save signed links in CRM or localStorage. Deletions are explicit, ideally soft-delete first, with separate object deletion and reconciliation jobs. Multi-account switches must invalidate local inventory and temporary access.
6. BYO connections are owner/admin-managed, encrypted at rest, org-bound, revocable, and testable without exposing provider credentials to other tenants. Verify tenant isolation with two organizations and member/viewer roles; test records outside user's CRM visibility.
7. Review billing and quota behavior before a production storage rollout; confirm cost and migration safety. Add a controlled feature flag and server-side checks. Run TypeScript, unit, Cloudflare build, device smoke and real signed-in permission tests.
8. Only after security review and explicit production approval, apply migrations/provision bucket, then enable uploads for one organization.

## Next implementation batches

- **#391 — Managed Supabase private upload + document metadata**, initially staged; link to verified shared Company/Deal records, filter size/type/date/uploader, secure download, soft delete, orphan cleanup.
- **#392 — Organization storage administration**, per-provider indexed bytes, usage/quota/retention policies, trash and storage settings, auditing; careful distinction between stored bytes and provider billing.
- **#393 — BYO Storage connections**, begin with S3/R2 and BYO Supabase broker; encrypted credentials, scoped signed operations, sync/reconciliation. Drive/Dropbox/OneDrive can remain link-only until integration is separately authorized.

## Technical references

- Supabase Storage private buckets and RLS: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Storage RLS operations: https://supabase.com/docs/guides/storage/security/access-control
- Storage schema and metadata: https://supabase.com/docs/guides/storage/schema/design
- Supabase storage GB-hour billing: https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
