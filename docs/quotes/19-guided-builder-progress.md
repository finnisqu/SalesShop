# Quotes Beta — guided, non-linear progress bar (November 2026)

**Active branch:** main, Cloudflare Workers automatic deployment. This batch adds navigation and derived status only. It does not change quote storage, quote pricing, customer previews, permissions, signatures, or Supabase.

## Experience
- Four clickable milestones: **Project details / Areas / Materials & pricing / Review**. They stay visible above the workspace during quote and Area editing.
- Four separate segment fills indicate *milestones reached*, not a required wizard, submission checklist or completeness percentage. Project details and Areas can stay "Optional" for flat-fee work.
- The Areas milestone reveals fast links to every existing Area and an explicit Add Area action; desktop left navigation and undo remain intact.
- Pricing routes to the first actionable Area-specific blocker or material review finding, otherwise Materials for the current/first Area. A quote with no Areas returns to the Build view for manual General work.
- Review opens the existing audit/issue overlay. **It does not issue, create a share link, or send an email.**
- Status is derived from the existing quote audit and actual quote fields: no new flags, hidden saved checklist, or new backend migration.
- Pricing Schedules remain on their established editor and Review workflow; this progress bar is for Quick Quotes.

## Acceptance checks
1. Create a Quick Quote with no customer, Areas or prices. Project details and Areas must be optional, pricing must say "Add priced work", and Review must be "Not reviewed."
2. Add a General fixed charge without Areas. Materials & pricing should be "Ready to review"; no forced countertops, sink, or catalog material selection.
3. Create Kitchen and Bath; click Areas in the bar, then select each by name. Existing desktop rail and mobile quote Back navigation must still work.
4. Add an unpriced charge. The bar must show the correct blocker count; clicking pricing must open the relevant Area, not change the price.
5. Review, preview, and return without issuing; do not show Review as complete. Issue only through the existing explicit approved flow.
6. Test phone portrait/landscape, desktop, dark theme, long names, and archived/read-only quotes before treating the deployment as browser-accepted.

**Authoring status:** source reviewed; automated Node/TypeScript/Vitest/browser checks have not run in this GitHub-only development session. Verify Cloudflare build Ready and perform smoke QC after deployment.
