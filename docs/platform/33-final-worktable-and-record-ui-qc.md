# Batch 332f — Final Worktable and Record UI consistency

## Scope and implemented changes

1. **Linked-record relationship rows.** `src/record-page-refinement.css` now scopes a two-column `minmax(0,1fr) auto` grid to `.ss-record-associated-row` inside the Records entity list. The record-opening button keeps the available width; the `RecordUnlinkButton` remains compact. The same override covers the Unlink action inside Company record Person cards, and it wins over the older generic “every record button is width:100%” rule. Hover states remain theme-token based, without altering relationship permissions.
2. **Header controls.** Record More's desktop 37px trigger is aligned with the existing 42px Edit Page/Activity/header buttons. The existing mobile 44px override remains, and mobile Details / Records / Related section-jump buttons now also use 44px minimum height.
3. **Reduced-motion accessibility.** `RecordPageLayout` uses `recordJumpScrollBehavior(reducedMotion)`: ordinary navigation remains smooth; users with OS `prefers-reduced-motion:reduce` receive an immediate jump. Keyboard focus still moves to the selected labeled content region.
4. **WARM, LIGHT and DARK visual contracts.** A new test reads the actual theme palettes and shared table CSS, checks that headers use the shared tint/border mix and ink color, verifies accessible contrast (current calculated ratios LIGHT ≈ 9.23:1, WARM ≈ 8.73:1, DARK ≈ 7.10:1), and verifies rounding, horizontal overflow and mobile spacing. This is a token calculation, not a screenshot comparison.
5. **Previously skipped layout regressions now gated.** `src/components/RecordPageLayout.test.tsx` is explicitly registered in `test:quick-quote`, with its breadcrumb expectation updated to the actual “Records” back label. `src/services/worktableRecordVisual332.test.ts` is also registered. `src/components/RecordChrome332.test.tsx` covers the link-row and action sizing changes.

## Visual QC checklist for the first green deployment

- **Desktop WARM (priority):** Quotes, Tasks, Connections/Records and Catalog all retain darkened table headers, rounded top corners, consistent row heights, clean horizontal borders and no header cells visibly protruding at the corners.
- **Desktop DARK / LIGHT:** Header text, menu labels and selected rows have readable contrast; no beige hard-coded Catalog cells appear in DARK. All controls use palette tokens.
- **Mobile (320/390/820px, plus landscape):** Filter, Actions, Columns and Record More popovers stay within the screen even after keyboard open/rotate; button hit areas are 44px; Catalog pagination wraps without clipping; horizontal table swipes remain functional.
- **Record pages:** Company, Person and Deal show identical Edit Page/More/Activity header rhythm. Linked Quote/Deal/Person/Task rows have a clear primary navigation target plus compact Unlink action; linked records and Activities are not deleted when unlinking.
- **Interaction:** Escape closes inline property edits without dismissing the Record page; the focus returns to the property pencil after Save/Cancel. Details/Records/Related buttons focus the correct region and respect reduced motion.
- **Safety:** Protected bid Tasks cannot be manually unlinked, issued/signed Quotes cannot be reassigned through quick Unlink, and direct Deal–Person link changes still use existing cloud permission/error handling.

## Verification boundary

The user confirmed **#332e** green. Batch **#332f** commits are pushed but not yet validated by a new Cloudflare run or a real browser/device. Automated source/unit tests provide regression contracts, not visual screenshots, authenticated production mutation checks or UI observation. Do not change working application logic solely to satisfy a brittle source check.

## Next functional focus

Once #332f passes its build gate, return to Catalog variant management and consistent material, sink, rate and OTHER editing/selection. Deal timeline/Gantt remains deferred per request.
