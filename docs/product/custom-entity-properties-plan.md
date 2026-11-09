# SalesShop extensibility: custom entity properties and flexible workspaces

Status: **design contract only**. No runtime custom fields or schema changes in this batch.

## Product principle

SalesShop records are durable objects, not fixed forms. Users should be able to tailor which facts they track, how they group them, and which records they relate, without altering core CRM lifecycle data or making every field a default.

### Two independent layers

1. **Custom properties**: User- or organization-defined typed information attached to Company, Person, Deal, Quote, Activity, or later a project schedule. Field definition controls label, type, entity scope, help text, defaults, validation, access, visibility and sort order. Actual field values are stored by stable field ID and record ID, not by display name.
2. **Custom layout**: Optional per-user and company-wide views determine which properties are shown as columns, grouped sections or compact detail cards. Hide, reorder, pin or collapse sections without deleting data.

### Field kinds to support progressively

| Field kind | Examples | Notes |
| --- | --- | --- |
| Text / long notes | Preferred fabricator, interests, family conversation notes | Manual opt-in; avoid setting intimate personal notes as defaults |
| URL | Google Sheets pricing worksheet, Google Maps pin, Dropbox folder | Display hostname and Open link, validate URL scheme, never embed untrusted HTML |
| Number / currency | Estimated units, project budget, custom rates | Typed; decimal and unit/currency metadata |
| Date / date-time | Birthday, anniversary, next event, renewal | Calendar visibility only with explicit opt-in, optional year omitted for birthdays |
| Choice / multi-choice / toggle | Preferred supplier, territory, priorities | Options stable IDs; rename safely |
| Person / Company / Deal relationships | Internal PM, customer contacts, subcontractors, deal team | True many-to-many relations with explicit association records. Never invent Activity logs or append data to another field |
| Image / file / audio | Company logo, employee photo, bid PDF, sales-call audio note | Authenticated storage with per-entity permissions, quotas, MIME/size limits, signed URLs and upload progress; consent and recording-law reminders for audio |

### Privacy and access

- A property definition has a scope: **my workspace** (private personal note) or **organization** (shared). Do not implicitly publish a private note when a record or workflow is shared.
- Permissions follow CRM read/write access by default, with explicit sensitive-field access controls before offering HR, birthdays, family notes or audio. Do not use ordinary shared-contact storage as a confidential HR database.
- Workspaces may choose no custom fields at all. No auto-generated personal-profile fields; all are explicitly created by the user.
- URL/file content is never followed or executed automatically; attachments are virus-scanned where available, private by default and deletable/exportable.
- Audit who added/edited each shared value; permission and workspace switches must not leak values across organizations or accounts.

### Storage and rollout

1. **Phase A: simple fields** — organization-scoped field definitions + field values with RLS for Company/Person/Deal; text, number, date, URL, choice. A compact Customize properties entry from record details; table column chooser can expose them. Start with one small user-selected example, not a mandatory field.
2. **Phase B: true relationships** — Deal↔People, Deal↔Subcontractors and optional role labels with an explicit association table. Bulk editor can add/remove multiple related People safely without fabricating interactions. Supports the current People panel.
3. **Phase C: assets and richer types** — safe files, images, logo/avatar previews, audio uploads; per-workspace storage quotas and private signed access.
4. **Phase D: configurable views and templates** — per-user column arrangements, custom record sections, optional team templates, import/export, search and filters, and later user-defined execution timeline rows.

### Migration and compatibility requirements

- Do **not** overload `nextAction`, `aliases`, or Activity history to store future relationships or arbitrary user properties. The current Prospect/Customer marker in company aliases is a temporary compatibility bridge because the normalized CRM `kind` field only accepts `customer`/`non-customer`.
- Design normalized tables for property_definitions, values and many-to-many links with organization RLS, uniqueness/versioning, soft deletion and stable field IDs. Stage and verify migrations before enabling cloud UI.
- Existing records without a value remain untouched; user-configured fields don't change quote totals or stages.
- Dynamic fields must support responsive spreadsheet-style bulk editing and right-side inspectors without becoming large cards.

### Notes for this batch

- Company relationship choices are now separate **Prospect**, **Customer**, **Partner / other** and **Unclassified** for legacy data.
- Bulk editor can assign/clear a Company for multiple Deals, and move multiple People to a Company. Direct Deal-to-Person membership requires the Phase B true association model above and is **not** simulated via an activity.
- Project Timeline beta is frozen; this specification is not authorization to alter its code.