# CRM interaction linking, internal roster, and Deal People

## Usage

### Reopen logged activities

- Connections → More → Activity history now opens an Activity detail preview instead of jumping to its first linked record.
- For manual interactions, choose Edit activity to update the method, date, notes and related People, Company, Deal or Quote records. Save confirms the CRM update. Automatic system events stay read-only.
- Deal details → Activity history also opens the same Activity preview/editor.

### Create records while logging

- Log Activity → Related records → Create while logging → + Company, + Person, or + Deal.
- Fill the small inline fields and choose Create & link. The new record is created through the ordinary CRM store, automatically added to the draft's link list, and no navigation occurs.
- Creating a Person or Deal can optionally set its Company. Existing matches are not silently duplicated.
- This also works when editing a previously recorded manual Activity.

### Our Organization

- Connections → Our Organization is a separate directory for Employees and Subcontractors.
- + Person in the standard header adds an internal contact; fields are name, role/trade, email and phone. Edit within the compact directory table.
- Internal people open normal Person details with an Internal contact indicator and a return path to Our Organization.
- The directory reuses the **shared normalized CRM** company/contact tables without SQL migrations: two reserved, tagged non-customer Company records identify the group, and internal Contacts are assigned to the corresponding group.
- Those internal Company and Contact records are excluded from ordinary Connections Companies and People tabs, but internal people may still be linked explicitly to an Activity as People.
- Do not use this as an employee authentication, payroll, confidential HR or permissions system. Team logins and access are managed in Settings → Team.
- Existing CRM access controls apply to this directory, so it is not a private manager-only HR roster.

### Deal People

- Deal details now shows **People** with contacts explicitly connected through linked quotes or logged activities, including secondary People stored in multi-link activity metadata.
- An expandable **Other people at this company** section shows helpful candidates without treating them as Deal participants.
- **Log** opens an Activity prelinked to the Deal and selected Person.
- **+ New person** creates a Person linked to the Deal's company and opens a prelinked Activity; save the interaction to record the person's Deal relationship.
- Full native Deal-to-Person assignments independent of Activity/Quote are not part of this batch. This avoids creating fake interaction events or changing the CRM schema merely to mark a relationship.

## Data and safety

- No new tables, migrations, permissions or app-role changes.
- Existing cloud CRM sync persists Companies, Contacts, Activities, and their existing alias/metadata JSON fields. Internal roster records have normal CRM visibility.
- Activity edits continue to use the existing server-confirmed update path. Existing activity draft recovery and current-user permissions remain.
- Project Timeline beta remains frozen and unchanged.
- Only user-entered business contact information should be stored in this directory.

## QA to run when Cloudflare builds

1. Log a Call associated with a Deal and Person; reopen from Connections → Activity history; add another Person and save; verify both appear on Deal People.
2. Edit an activity to remove a relation and confirm the Deal People list updates while unlinked Company contacts remain suggestions.
3. Open a past manual activity from Deal history, edit notes and links; confirm saving and return navigation.
4. Begin logging an Activity, create a Company, then create a Person assigned to it; check auto-linked chips and that the unfinished Activity stays open.
5. Use + Deal in the same Activity draft and save the interaction. Confirm the CRM Deal exists and links appear on reopening.
6. Add one Employee and one Subcontractor via Our Organization; verify no internal people appear in standard Companies/People tabs, but do appear in their own roster.
7. Edit an internal Person and verify category, role, email and phone persist after reload and across signed-in devices (depending on successful CRM cloud sync).
8. Check viewer/no-CRM-edit permissions, owner preview mode, mobile keyboard and sheet safe-area behavior, light/dark contrast, and no extra horizontal overflow.
9. Confirm no duplicate Person is silently created when an exact matching email or name/company already exists.

## Validation limits

Structural code and reference checks may be performed through the GitHub connector. Full TypeScript/Vitest build and browser QC require an actual checkout and have not been run in the current environment. Automatic GitHub CI is not re-enabled.