# SalesShop Prototype

A browser-only prototype exploring a sales tool built around two primary user-facing surfaces:

1. **Notebook** — a frictionless working memory where partial records are valid.
2. **Quotes** — a fast, unrestricted quote builder where a single rough line or a detailed itemization are equally valid.

The CRM/database layer grows from breadcrumbs rather than forcing structured entry first.

## Run it

No build step is required.

### Easiest
Open `index.html` in a modern browser.

### Better for microphone/browser permissions
Run a tiny local web server from this folder:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Prototype features

### Notebook
- Daily pages with timestamps
- Freeform entries
- Browser speech-to-text when Web Speech Recognition is available
- Select notebook text and **Promote** it into:
  - Contact
  - Company
  - Touchpoint
  - Reminder
  - Project / quote card
  - Project update
- Link selected text to an existing work item without changing the note

### Universal search / capture
The top command bar does both jobs:
- Search across projects, quotes, notebook entries, contacts, companies, touchpoints, and reminders
- Press Enter on arbitrary text to drop it directly into today’s notebook

`Ctrl/Cmd + K` focuses the command bar.

### Board
- Work-item cards rather than spreadsheet rows
- Minimal cards are valid
- Drag cards through simple stages
- Add a card by typing only its name
- Double-click a card to enrich it later

### Quotes
- Start with one line or many
- Quantity/rate are optional
- Direct amount entry is allowed
- Add/remove lines freely
- Letterhead-style preview
- Print / Save PDF using the browser print dialog
- Revision snapshots and revision history

### Breadcrumb memory
A deliberately secondary `Memory` screen exposes the structured records that accumulate underneath the experience.

## Data model direction

The current browser prototype persists to `localStorage`. It intentionally keeps objects separate underneath:

- `workItems` — the neutral thing being quoted; UI vocabulary can later vary by division
- `quotes`
- `contacts`
- `companies`
- `touchpoints`
- `reminders`
- `projectUpdates`
- `notebook`

This gives us relational structure without requiring the salesperson to interact with a relational database.

## Product rules being tested

- Partial information is valid information.
- Capture should never require classification first.
- The visible layer should feel like cards, a notebook, and a blank page.
- The spreadsheet/database can exist underneath and remain accessible.
- Search should work from remembered ideas, not only exact database fields.
- Promotion is optional: `write -> link -> promote`.
- Quote detail is a choice, not a requirement.

## Suggested next steps after interaction testing

- Improve the quote editor based on actual use
- Decide whether daily pages, continuous notebook, or both should be default
- Add stronger semantic search
- Add durable backend storage + authentication
- Replace browser-only voice recognition with recorded voice notes + transcription API
- Add editable letterhead/company templates
- Add richer quote sections, alternates, allowances, tax, and customer-facing detail controls
- Add share links / email delivery
- Add per-division board vocabulary and stages
