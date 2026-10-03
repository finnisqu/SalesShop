# SalesShop Roadmap

> Living product and architecture roadmap for SalesShop.
>
> The goal is not to reproduce every feature of HubSpot or Salesforce. SalesShop should become a focused, low-friction sales operating system for relationship-driven project sales: capture naturally, structure quietly underneath, quote effectively, connect to the systems the team already uses, and hand won work downstream cleanly.

## North Star

SalesShop should behave less like a database that salespeople must maintain and more like a **shared sales memory that builds itself while the team works**.

The intended lifecycle is:

```text
Relationship -> Opportunity / Project -> Quote -> Award -> Handoff
```

The visible experience should remain simple and human:

- Notebook
- Accounts / Companies
- Projects / Opportunities
- Quotes
- Search
- Tasks / Follow-up

The underlying platform can become much more sophisticated without forcing that complexity onto the salesperson.

---

## Product Principles

1. **Partial information is valid information.**
2. **Capture should not require classification first.**
3. **Write -> link -> promote** is preferred over forcing structured forms up front.
4. **The Notebook is a first-class workspace, not a CRM notes field.**
5. **A Project is not a board card.** The card is only one view of the project.
6. **A Quote is not the quote editor.** The quote is domain data with one or more presentations/editors.
7. **External systems should be linked, not duplicated unnecessarily.**
8. **SalesShop should own commercial context; specialist tools should own specialist data.**
9. **One underlying product, progressively disclosed by role and need.**
10. **AI should amplify good structured data, not substitute for it.**

---

# Roadmap Overview

| Phase | Goal | Major capabilities |
| --- | --- | --- |
| 0 - Product Discovery | Make the interaction model excellent | Notebook, paper system, Board, quote experiments, search/capture workflows |
| 1 - Architecture Foundation | Make future growth cheap | Domain models, stable IDs, repositories, migrations, services, events, integration links |
| 2 - Real Backend | Become a real shared application | Database, authentication, users, workspace, storage, API, backups |
| 3 - CRM Core | Become a credible CRM | Companies, contacts, projects, activities, tasks, relationships, timelines, views |
| 4 - Notebook Intelligence | Make SalesShop distinct | Linking, promotion, entity recognition, semantic search, voice, contextual memory |
| 5 - Professional Quoting | Replace fragmented quote workflows | Revisions, sections, alternates, allowances, pricing, PDFs, approvals, delivery |
| 6 - Communication & Files | Capture work automatically | Gmail/Outlook, Calendar, Drive/SharePoint, Slack/Teams |
| 7 - Workflow Automation | Reduce manual follow-up | Rules, triggers, reminders, assignments, notifications, scheduled actions |
| 8 - CAD Lite / Operations Integration | Connect commercial and technical scope | Shared project identity, takeoffs, variance checks, drawings, handoff |
| 9 - Management & Analytics | Support leadership | Pipeline, forecasting, conversion, aging, activity, revenue, account health |
| 10 - Platform Maturity | Make it trustworthy at scale | Permissions, audit logs, monitoring, security, retention, recovery, API/webhooks |
| 11 - Intelligence Layer | Make the system proactive | Summaries, extraction, meeting prep, suggested actions, natural-language retrieval |

These phases are directional rather than strict release boundaries. Some capabilities will overlap, but dependency order matters.

---

# Phase 0 - Product Discovery

**Status: current / ongoing**

SalesShop is still young enough that interaction design should remain fluid.

Current areas of exploration include:

- Physical-paper / binder-style Notebook experience
- Daily and freeform working pages
- Paper styles, annotations, Post-its, pencil marks, spatial objects
- Project and account boards
- Frictionless capture
- Memory / structured records underneath
- Flexible quote creation
- Search and promotion workflows

The objective is to learn how SalesShop should feel before locking the UI into heavy infrastructure.

---

# Phase 1 - Architecture Foundation

## Goal

Create enough architectural separation now that SalesShop can continue developing quickly without later requiring a CAD Lite-style multi-day excavation and migration.

This should be a **small foundation pass, not an enterprise rewrite**.

## Target domain model

Canonical concepts should exist independently of their UI:

```text
Workspace
User
Team

Company
Contact
Project / Opportunity

Quote
QuoteRevision

Notebook
NotebookPage
NotebookObject

Activity
Task
Reminder

File
IntegrationAccount
ExternalLink
```

## Important foundations

### Stable IDs

Adopt permanent IDs for all durable entities. Never rely on names, array indexes, DOM state, or UI-generated identity.

Example:

```text
company_...
contact_...
project_...
quote_...
page_...
object_...
activity_...
```

These IDs become especially important for integrations such as CAD Lite.

### Formal schema versioning and migrations

Replace ad-hoc normalization with explicit schema versions and migration steps.

```text
schemaVersion: 4

1 -> 2
2 -> 3
3 -> 4
```

Old data should remain loadable as the product evolves.

### Storage abstraction

The UI should not know whether data lives in localStorage, Postgres, or a remote API.

```text
UI
 ↓
Application services
 ↓
Repositories
 ↓
LocalStorage adapter today
API / database adapter later
```

Application code should prefer operations such as:

```text
projects.get(id)
projects.save(project)
quotes.create(data)
notebook.savePage(page)
```

rather than direct storage access throughout the app.

### Separate domain state from UI state

Persistent business data:

```text
project.status
quote.amount
company.name
notebookPage.objects
```

Transient interface state:

```text
selectedObjectId
activeTab
zoom
openFlyout
hoveredObject
sidebarCollapsed
```

These should not be mixed.

### Commands / services

Business actions should go through named operations rather than arbitrary state mutations.

Examples:

```text
createProject()
updateCompany()
moveNotebookObject()
linkNotebookObject()
promoteNotebookText()
createQuoteRevision()
changeProjectStage()
```

This creates future hooks for validation, saving, undo, events, synchronization, audit history, and automation.

### Lightweight event system

Establish a simple internal event model now.

Examples:

```text
project.created
project.updated
project.awarded
quote.created
quote.sent
notebook.object.linked
activity.created
```

Initially these events may only drive UI refreshes. Later they can drive integrations, workflow rules, notifications, and audit history.

### Generic integration links

Avoid adding provider-specific IDs to every business object.

Prefer a generic model:

```text
ExternalLink
- provider
- externalType
- externalId
- entityType
- entityId
```

A project could then be linked to:

```text
Gmail thread
Slack channel
Google Drive folder
CAD Lite project
HubSpot deal
```

without contaminating the core Project model.

### Notebook modularization

Keep the Notebook visually flexible, but separate:

```text
Notebook model
Notebook rendering
Notebook interactions
Paper styles
Annotations
Selection
Persistence
```

The current prototype-style accumulation of `final`, `qc`, `hotfix`, and similar layers should not become the permanent architecture.

## Realistic duration at current development pace

**Approximately 1-3 focused development days.**

A likely sequence:

1. Domain model + ownership rules
2. Stable IDs and schema conventions
3. Storage / repository abstraction
4. Formal migrations
5. Domain state vs UI state separation
6. Commands / services
7. Event bus
8. IntegrationAccount / ExternalLink foundations
9. Notebook modularization
10. Architecture regression / QC pass

The goal is to finish this quickly and return to product development.

---

# Phase 2 - Real Backend and Multi-User Foundation

## Goal

Turn SalesShop from a browser/localStorage prototype into a real shared internal application.

Target shape:

```text
Browser
   ↓
SalesShop API
   ↓
Database
```

## Core capabilities

- Durable relational database
- Authentication
- User accounts
- Workspace concept
- Server-side API
- File/object storage
- Environment/secrets management
- Backups
- Database constraints
- Sessions
- Basic roles / permissions
- Record ownership
- Reliable loading/error states
- Migration/import from prototype data

A likely early deployment model is one `World Stone` workspace with multiple users, while retaining a data model that could support additional workspaces later.

## Two definitions of completion

### Backend MVP

SalesShop successfully runs against cloud persistence with shared login-based access.

**Estimate: about 2-4 focused days after Phase 1.**

### Trusted internal deployment

SalesShop is reliable enough for roughly 10-15 real users to depend on in daily work.

Additional hardening should include:

- permission testing
- simultaneous-use testing
- data integrity checks
- deletion / relationship behavior
- backup and restore strategy
- session behavior
- failure handling
- device/browser testing

**Estimate: roughly 5-8 focused development days total for Phase 2 including hardening.**

The distinction matters: getting a backend working is fast; becoming comfortable treating the application as a system of record deserves deliberate testing.

---

# Phase 3 - CRM Core

## Goal

Become a credible operational CRM while keeping the salesperson experience lighter than traditional CRM software.

## Company / Account record

A mature account should be able to expose:

```text
Company
├── Contacts
├── Active projects
├── Past projects
├── Quotes
├── Activities
├── Tasks
├── Files
├── Related organizations
└── Integrations
```

Important capabilities:

- Account ownership
- Sales vs non-customer relationship classification
- Contact roles
- Account stages
- Project / opportunity stages
- Tags
- Custom fields where genuinely useful
- Duplicate detection and merge
- Import / export
- Saved filters / views
- Recent activity
- Relationship history
- Account status / health facts

## Contact record

- Company relationships
- Contact role/title
- Email and phone
- Project involvement
- Communication timeline
- Notes
- Tasks
- Last contacted / next follow-up

## Project / Opportunity record

- Company
- Contacts
- Owner
- Stage
- Due dates
- Value
- Quotes
- Scope / notes
- Files
- Activity timeline
- Tasks
- External integrations
- Award / loss outcome
- Loss reason

## Activity model

One normalized `Activity` concept should eventually represent:

```text
notebook note
email sent
email received
call
meeting
Slack message / event
quote created
quote sent
project stage change
file added
CAD Lite drawing update
award
```

This unified timeline is one of the most important mature-CRM foundations.

## Tasks / reminders

SalesShop must reliably answer:

> What do I need to do next?

Capabilities should include:

- due dates
- owners
- priorities
- project/company/contact relationships
- recurring tasks where appropriate
- completed history
- overdue follow-up views

---

# Phase 4 - Notebook Intelligence

## Goal

Make the Notebook the major differentiator rather than merely another CRM notes field.

The principle:

> Do not make the salesperson feed the CRM. Let CRM structure emerge from the salesperson doing normal work.

Example input:

```text
Called Austin. Blue Jay revision needs alternate pricing by Friday.
```

SalesShop could infer or suggest:

```text
Austin -> Contact
Blue Jay -> Project
alternate pricing -> project context
Friday -> possible task
```

without interrupting writing with mandatory forms.

Important capabilities:

- Link notebook text/objects to existing entities
- Promote content into Contacts, Companies, Projects, Tasks, Activities, etc.
- Entity recognition
- Context suggestions
- Semantic search
- Voice notes and transcription
- Quick capture
- Project/account-aware pages
- Search by remembered concepts instead of exact fields

---

# Phase 5 - Professional Quoting

## Goal

Evolve Quotes from a flexible prototype into a serious sales tool without losing the ability to create a simple rough quote quickly.

Potential quote model:

```text
Quote
├── customer
├── project
├── contact
├── revision history
├── sections
├── line items
├── alternates
├── allowances
├── exclusions
├── taxes
├── scope notes
├── internal costs
└── customer-facing presentation
```

Important capabilities:

- Simple or detailed quotes
- Sections
- Alternates / options
- Allowances
- Taxes
- Internal vs customer-visible information
- Quote templates
- Account / builder pricing profiles
- Revision snapshots
- Revision comparison
- Approval workflow
- Expiration dates
- PDF generation
- Email delivery
- Share links
- Customer acceptance / acknowledgement later

The existing estimator can remain a specialist calculation source while SalesShop increasingly owns the customer/project/quote lifecycle around it.

---

# Phase 6 - Communication and Files

## Integration architecture

Use a common foundation rather than one-off provider hacks.

Important concepts:

```text
IntegrationAccount
ExternalLink
Activity
WebhookEvent
SyncCursor
ProviderAdapter
```

Provider adapters may expose capabilities such as:

```text
connect()
disconnect()
fetchChanges()
handleWebhook()
search()
getRecord()
createAction()
```

## Email - Gmail / Outlook

Potential capabilities:

- Recent emails on Contacts, Companies, and Projects
- Automatic email Activities
- Thread-to-project linking
- Last-contacted tracking
- Send / draft from SalesShop
- Attach quote PDFs
- Suggested reminders from customer requests
- Surface unanswered customer communication

## Calendar

- Meetings become Activities
- Project/company association
- Meeting preparation view
- Upcoming meeting context
- Follow-up suggestions

## Files - Google Drive / OneDrive / SharePoint

SalesShop should usually **index and relate files rather than replace the file system**.

Potential relationships:

```text
Project
├── plans
├── bid package
├── quote
├── contract
├── shop drawings
└── supporting documents
```

## Slack / Teams

Potential capabilities:

- Link project/company to channel
- Post award or status notifications
- Convert meaningful messages into Activities
- Suggest project updates / tasks from conversation

---

# Phase 7 - Workflow Automation

## Goal

Move SalesShop from a passive database toward a system that helps coordinate work.

Examples:

```text
WHEN quote becomes Sent
THEN create salesperson follow-up task in 5 business days
```

```text
WHEN project becomes Closed Won
THEN notify PM team
     create handoff checklist
     create / link CAD Lite project
     create Drive folder
     optionally post award to Slack
```

```text
WHEN active opportunity has no activity for 14 days
THEN surface it in Follow-Up
```

Start with a handful of excellent built-in automations. A user-configurable rules engine can come later.

---

# Phase 8 - CAD Lite and Operations Integration

## Ownership boundary

**SalesShop owns commercial context:**

- Company
- Contacts
- Opportunity / project
- Commercial scope
- Quote
- Pricing
- Award status

**CAD Lite owns technical drawing context:**

- Layouts
- Geometry
- Pieces
- Sinks
- Cutouts
- Edges
- Slab layout
- Technical takeoff

The applications should remain separate products connected through stable IDs and explicit APIs/contracts.

## Shared project identity

A SalesShop project should be able to link to one or more CAD Lite projects via `ExternalLink` / integration records.

Potential workflow:

```text
SalesShop Project
    ↓ Create / Open CAD
CAD Lite Project
    ↓ technical takeoff
SalesShop Quote / Scope validation
```

Potential return data from CAD Lite:

- Layout count
- Piece count
- Countertop square footage
- Splash footage
- Sink count
- Cutout count
- Edge / miter quantities
- Slab estimates
- Drawing status
- Drawing revision
- Generated PDFs

## Scope variance checking

This is a major long-term opportunity.

Example:

```text
Quote Rev 4
8,300 SF quoted

CAD Lite Rev 7
8,421 SF drawn

Warning: 121 SF variance
```

Similar comparisons could detect sink-count, cutout-count, material, and scope differences.

## Longer operational lifecycle

Potential future chain:

```text
SalesShop
   ↓
CAD Lite
   ↓
FabShop / Production
```

The same project identity should follow the job through its lifecycle without merging the applications into one codebase.

---

# Phase 9 - Management and Analytics

Potential management capabilities:

- Pipeline by stage
- Forecast views
- Quote volume
- Win/loss rate
- Average deal size
- Sales-cycle length
- Aging opportunities
- Overdue follow-ups
- Activity by account / salesperson
- Revenue by customer
- Awards by period
- Lost reasons
- Dormant accounts
- Repeat customer behavior
- Account relationship facts
- Margin / pricing analysis where appropriate

Prefer transparent facts over opaque pseudo-scientific scoring.

---

# Phase 10 - Platform Maturity

Needed before SalesShop becomes a mission-critical company system or external product:

- Role-based permissions
- User deactivation
- Admin controls
- Audit history
- Monitoring and error reporting
- Backup / restore procedures
- Data retention
- Data export
- Integration token security
- API versioning
- Webhook reliability / retries
- Rate limiting
- Security logging
- Disaster recovery
- Deployment / rollback discipline

Potential roles:

```text
Salesperson
Manager
Estimator
Project Manager
Admin
Executive
```

Different roles may see progressively different levels of complexity while using the same underlying product.

---

# Phase 11 - Intelligence Layer

AI becomes most valuable after the CRM has good relationships, Activities, files, and integrations.

Potential workflows:

### Account / project recap

> What happened with BAR Construction this month?

SalesShop can summarize:

- emails
- Notebook entries
- quotes
- meetings
- Slack activity
- project updates

### Follow-up assistance

> What do I need to follow up on today?

### Meeting preparation

> Prepare me for my meeting with D.R. Horton.

### Natural-language retrieval

> Find the project where someone asked about a white quartz alternate in Spartanburg last winter.

### Suggested next actions

Use context to suggest tasks, reminders, follow-ups, or missing information without taking control away from the salesperson.

---

# Important Mature-CRM Capabilities We Are Still Missing

As of the current prototype stage, the largest missing pillars are:

1. Real backend and shared users
2. Unified Activity model
3. Reliable tasks / reminders / follow-up system
4. Strong Company / Contact / Project relationships
5. Integration framework
6. Professional quote model
7. Files / document relationships
8. Strong global / semantic search
9. Authentication and permissions
10. Workflow automation
11. Reporting and forecasting
12. Audit / reliability / security infrastructure

These are not all immediate priorities. They are the major capabilities needed to mature from prototype to trusted CRM.

---

# Capabilities We Do Not Need to Chase Soon

SalesShop should resist becoming an everything-suite.

Not near-term priorities:

- Full marketing automation platform
- Mass email campaign suite
- Customer support / ticketing system
- Website CMS
- Social media management
- Call center platform
- HR system
- ERP replacement
- Accounting replacement

SalesShop should integrate with specialist systems where appropriate instead of rebuilding them.

---

# Development Eras

## Era 1 - Make It Delightful

**Current era.**

Focus:

- Notebook
- paper interactions
- capture
- account/project Board
- quote experiments
- interaction design

## Era 2 - Make It Real

Focus:

```text
Architecture foundation
    ↓
Backend
    ↓
Users / permissions
    ↓
CRM core
    ↓
Activity timeline
    ↓
Search
```

This is the most important structural era.

## Era 3 - Make It Connected

Focus:

```text
Email
Calendar
Files
Slack / Teams
CAD Lite
Estimator
Accounting / production connections
```

This is where SalesShop should begin saving substantial administrative effort.

## Era 4 - Make It Intelligent

Focus:

```text
Automations
Dashboards
Forecasting
Semantic search
Meeting preparation
AI summaries
Proactive follow-up
```

---

# Near-Term Sequencing Recommendation

Continue interaction/product exploration only long enough to clarify the core model, then intentionally perform Phase 1 before the prototype grows much further.

Recommended sequence:

```text
Current product exploration
        ↓
Phase 1 architecture foundation
        ↓
Resume feature development where useful
        ↓
Phase 2 backend + multi-user foundation
        ↓
CRM core / Activity / Tasks
        ↓
Integrations and quoting maturity
```

At the current development velocity, Phase 1 should remain a short architectural investment rather than a long migration project.

---

# Long-Term Technical Principle

SalesShop should become the **commercial system of record**, not the owner of every piece of specialist data.

Examples:

| Information | Primary owner |
| --- | --- |
| Company | SalesShop |
| Contact | SalesShop |
| Sales opportunity / project | SalesShop |
| Quote / pricing | SalesShop |
| Award status | SalesShop |
| Activities / relationship history | SalesShop |
| Drawing geometry | CAD Lite |
| Pieces / sinks / cutouts | CAD Lite |
| Slab layout | CAD Lite |
| Technical takeoff | CAD Lite |
| Email source data | Gmail / Outlook |
| Documents | Drive / SharePoint / other file system |
| Accounting ledger | Accounting platform |

SalesShop should link these systems together around a coherent project/account identity.

---

# North-Star Outcome

A mature SalesShop should let a salesperson open a Company or Project and immediately understand:

- who the people are
- what has happened
- what is being quoted
- what the latest scope is
- what files and drawings exist
- what communication has occurred
- what needs to happen next
- whether technical scope still matches commercial scope
- where the opportunity stands

without requiring the salesperson to manually recreate every interaction in a CRM.

**The system should quietly build shared organizational memory while the team works.**
