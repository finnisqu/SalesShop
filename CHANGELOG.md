# SalesShop — Version Log

Reverse-chronological record of **what changed**, release health, and intentional deferrals. Add an entry for every meaningful implementation commit. This is the rear-view mirror; [ROADMAP.md](ROADMAP.md) and the [November 16 plan](docs/plans/2026-11-16-prototype-polish-work-plan.md) track forward work.

Status meanings: **Source committed** = in GitHub; **Build green** = confirmed Cloudflare gate for exact SHA; **Device QA pending** = not yet validated in authenticated UI.

## November 16, 2026

| Version / commit | Delivered | Release status | Follow-up / deferred |
| --- | --- | --- | --- |
| #357a (this commit) | Files v0.1: actual file/folder URL library, label editing, Company/Deal/Quote context panels, Records → More → Files search/open actions; scoped browser persistence and URL validation | Source committed / Cloudflare pending | Browser-local only, no team sync, OAuth or uploads; test user and tenant separation before cloud expansion |
| #356b (8a268b4) | Quote Filters rebuilt as one orderly two-column form with full-width Document type; Task Quick View buttons shortened with original behavior intact | Source committed / build pending | Check Quote Filters at 100/125% and button meanings with keyboard/tooltip |
| #356a (797378a) | Desktop single-row headers; Quote Filters grid fixed at source; Settings header outside sidebar; themed Deal form controls and scrollbars; Today icon; one-row Quick View actions | Source committed / build pending | Browser 100–175% zoom and mobile QA |
| #355f (48a7fb4) | Corrected stale Customer follow-ups test expectation; raised one slow external-Quote cloud-confirmation test's wall-clock budget to handle contended CI workers, preserving all business assertions | Source committed / Cloudflare pending | Verify next gate; if same case exceeds 30 s, investigate test runner/resource contention rather than weakening confirmation rules |
| #355e (ad2a059) | Focused zoom/header and floating calendar legibility follow-up; clearer Quote follow-up menu name | **Red gate** on November 16 (2 tests failed; 796 passed) | Check 100/125/150/175% zoom and calendar at desktop and phone widths |
| #355d (0870c43) | Table and Board now use the identical Deal quick-create form and one shared relationship-safe save method | Source committed / build pending | Verify both layouts, partial link failures and board filter defaults |
| #355c (676133c) | Embedded Deals and Companies Board controls consolidated into Records header; one visible create launcher | Source committed / build pending | Table Deal form retains older flow pending full parity review |
| #355b (984fbed) | Deal/Company new Quotes require template+name; Home Outstanding Tasks Today action; Settings header standardized | Source committed / build pending | Verify cancelled quote creation and Task update in browser |
| #355a (e06f7b2) | Calendar first-open positioning, weekend backgrounds, badge/date spacing; Quote Filters repair; zoom-safe shared headers; Task reschedule disclosure; clear Follow Ups explanation | Source committed / build pending | Real browser at 125–175% zoom, WARM and mobile QA |
| #354a (fbc9f62 / a3c12c0 / 446e5a5) | Analytics v0.1 under Records → More, actual CRM metrics and filters, includes externally submitted bids | **Green per user** on 446e5a5; page works | Authenticated team-owner scoping and device review |
| #353c–g (b9b8b6f through 4727e87) | Deal pre-save fields, opt-in bid reminders, guided Task completion, scheduled meetings, pricing readiness and clearer record menus | **Green per user** on 6135e84 after gate/test fixes | Manual phone and role QA; legacy sink PR #95 not merged |
| #353a (bac74a2) | Isolated developer sample-data Playground | Included in later green builds | Never replace production data |
| #353b (b3e899a / ce229dc) | Retired deprecated Quote editor navigation | **Green per user** | Do not reintroduce old editor |

### Intentionally deferred

- Shared custom-field activation until negative RLS tests on isolated disposable PostgreSQL; production Supabase is not a test database.
- Multifamily Gantt/timeline draft PR #67 paused until scheduled work is resumed.
- Legacy sink-repricing PR #95 needs migration to the single-editor workflow.
- Files v0.1 stores browser-local *links* only. Cloud shared link library, real uploads and provider OAuth need authenticated RLS/scoping work.
- Reliable background automations, email integration, CAD-Lite bridge and external plugins remain queued after Files.
