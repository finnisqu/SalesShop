# SalesShop adaptable properties: safe + Option / + Field roadmap

## Principle

Put **+ Option** inside controlled pickers when the user wants to extend an existing vocabulary. Put **+ Field** at the bottom of an entity's optional fields list when the user wants a genuinely new typed data property. Keep both user-driven, not mandatory defaults. Render in the existing compact row/inspector language.

## Implemented in this batch

- Our Organization → Person → **Role / trade**: select existing roles found across that internal category or choose **+ Add role…**. Added roles persist in a metadata tag on the reserved internal company in the existing CRM document and can be reused by the team without schema changes.
- Our Organization → Subcontractors → **Subcontractor company**: a Person can belong to the internal subcontractor roster while their actual Company is a normal linkable Partner/other CRM Company. A stable internal membership tag preserves the internal category. Existing employee entries continue to work.
- Activity history → Method, Relationship, Record type and When filters; combinable (e.g. calls with Prospects in the last 30 days).
- Tasks primary tabs show **Open** and **Completed** only. Advanced views remain in More and Overview; Activity history remains in Connections for this batch, with a shortcut in Tasks More.
- Suppliers now opens from **Connections → Suppliers**, retaining the original supplier data/store, pricing publications, contact/location/rule editor and import logic. Previous Catalog supplier deep links redirect to Connections rather than becoming dead links.
- Companies → Type filter now lives in the same compact table toolbar as record counts, selected count and Columns.

## Safe next + Option candidates

| Entity/feature | Field | Why this is safe |
| --- | --- | --- |
| Our Organization | Role / trade | Implemented; a shared vocabulary without changing Team permissions |
| People | Title, department and contact category | Add a user-managed vocabulary distinct from login permissions; start optional |
| Companies | Industry / market segment, relationship tags | Add options without replacing protected Prospect/Customer core classification |
| Deals | Project type, source, reason lost, tags | Separate from system-governed stages and pipelines |
| Activities | Interaction method subtypes, outcome labels, purpose | Preserve the canonical method ('call') for filters and reporting |
| Suppliers | Supplier category (slab, sink, freight, import), trade and region | Keep pricing status/compliance fields distinct from custom tags |
| Tasks | Workstream / queue | Build on existing queue entries; avoid adding hard-coded mandatory categories |

## Safe next + Field candidates

| Record | User-created property examples | Notes |
| --- | --- | --- |
| Deal | Google Sheet URL, shared drawings link, install address, owner notes | URL validated, organization-shared permission as explicit choice |
| Company | Logo, Maps link, preferred payment terms, industry tag | Image upload later when secure file storage is staged |
| Person | Birthday, hobbies, favorite restaurant, private notes | *Personal/private by default*, opt in before sharing sensitive context |
| Our Organization | Certification, subcontractor insurance expiry, start date | Treat payroll/HR and sensitive personal information separately from CRM |
| Supplier | Drawings portal, contact emails, sample order link, product lines | Supplier-specific metadata on supplier profile, not quote-pricing fields |
| Activity | Recording/audio attachment, meeting location, disposition | Consent, storage/retention, restricted access needed before audio |

## High-level Settings design (future, no inert placeholders)

**Settings → Properties & Options** with four tabs: (1) Entities, (2) Fields, (3) Option Lists, (4) Views. Choose Company, Person, Deal, Activity, Task or Supplier. Each custom field has a stable ID, label, data type, entity scope, required/default behavior, visibility and order. Option list values can be renamed, reordered and archived without losing historical assignments. Personal and company-wide settings have distinct permissions. Records show **+ Field** only for configured field types and authorized editors; **+ Option** appears in expandable pickers when editing the option list is permitted.

**Do not** store arbitrary future custom values in CRM alias markers: the Role/Trade tags in this beta-scale example are a temporary compatibility bridge only. A normalized custom-field schema with RLS, audit history, and explicit file storage is required before generalizing. A future Deal↔People membership collection must be a real relationship table, not an Activity event.

## Structural caution

Suppliers remain sourced from a specialized supplier profile and pricing database. Moving their navigation under Connections does not silently convert supplier records to customer CRM companies or merge the two tables. A future unified record layout must preserve pricing publications, approved-drawings workflows, imports, contacts and permissions.

## Gantt freeze

No changes to the Project Timeline beta or advanced Gantt. Its future editable rows should follow the same + Option / + Field philosophy, but no roadmap work is authorized by this batch.