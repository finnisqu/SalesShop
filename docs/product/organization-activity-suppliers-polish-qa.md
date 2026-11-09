# CRM polish pass — roster roles, activities, Suppliers and Tasks

## Navigation and user-visible changes

1. Connections → Our Organization → Add Person → Role/Trade: choose an existing role or **+ Add role…**. Roles saved for Employees and Subcontractors independently. They remain selectable even when no Person currently uses them.
2. Connections → Our Organization → Subcontractors: enter a Subcontractor company. The subcontractor Person remains under Our Organization, while the Company is a linkable Partner/other CRM Company. Employee records remain in their own group.
3. Connections → Activity history: Method, Relationship, Record type, When filters can be combined. Example: Phone calls + Prospects + Logged interactions + Last 30 days. Clear filters restores the original list.
4. Tasks: only Open and Completed main tabs. Detailed views live in More and Overview. Tasks More → Activity history opens Connections, retaining CRM source and separate private task permissions.
5. Connections → Suppliers is now the supplier directory. Catalog → More → Suppliers redirects to it, as do existing `openCatalog('suppliers')` calls. Supplier profiles, contacts, locations, rules, imported material pricing and publication history are not duplicated or migrated.
6. Connections → Companies: Type filter is placed in the main grid toolbar alongside record count, selected records, bulk editing and Columns. No second filter toolbar.

## Staging and data safety

- This batch contains **no new Supabase tables or migrations** and leaves Project Timeline/Gantt untouched.
- Reusable Role options and subcontractor internal membership use reserved, non-searchable alias metadata on the existing internal roster Company. These tags are a compatibility bridge, not a general-purpose custom-property architecture.
- Supplier records stay in their existing dedicated supplier tables and service. Moving them to Connections is a navigation/layout change only, not a merge into customer Company records.
- Activity relationship matching uses explicit linked Company/Person/Deal/Quote associations and Prospect/Customer status; legacy unclassified records remain unclassified, not guessed to be prospects.
- No activity history is fabricated to assign a subcontractor company or add a role.
- A global + Field or Settings Properties & Options builder is **not yet implemented**. See `extendable-fields-option-list-guidelines.md` for the field/option roadmap and permissions.

## Manual QA checklist

- Add Employee, create custom Role using Enter or Save Role, save Person. Create a second Employee and select the saved role. Switch to Subcontractors and verify role list remains separate.
- Add subcontractor with an outside Company, reload. Verify Person remains under Our Organization → Subcontractors, shows Company column, and does not appear in general People list. Open Person record and verify the outside Company link.
- Edit subcontractor to another Company, and move between Employee/Subcontractor. Verify membership list and company link update without duplicate People.
- Log a phone Activity linked to a Prospect; a second email Activity linked to a Customer. Filter Activity history by Phone calls + Prospects; only the intended call should remain. Test When and Record type toggles and Clear filters.
- Open Tasks on desktop and iPhone. Confirm only Open / Completed tabs. More still exposes Today, Upcoming, Overdue, Start later, All history and Activity history.
- Open Connections → Suppliers. Check pricing status, supplier profile details, contact editing, locations and import publication history. Check a legacy Catalog Suppliers link redirects to Connections with no duplicate supplier record.
- Check Supplier creation with a role lacking supplier permissions: the shared header create button should be disabled and server-side supplier RLS must still apply.
- In Companies select several records, switch Type filter while selection is active, adjust Columns, verify the Type selector stays in the same toolbar.
- Verify light/dark theme, mobile 390px and 430px, desktop 768px/1440px, menus, tap targets and keyboard navigation.

## Verification

Structural source/read-back checks and regression source tests are included. Full TypeScript/Vitest and browser QC have not been executed in the connector-only environment. Automatic GitHub CI remains off by prior request.