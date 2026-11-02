# Quotes Beta — Personal reusable Area layouts (2026-11-02)

## Scope
The user requested reusable Area templates as the next Quotes workflow improvement. This first step is **personal, browser-local, opt-in**, not a company-shared or cloud-synced template catalog.

### Behavior
- In an editable non-General Area, **Save layout** opens a confirmation dialog with an editable name and a clear explanation of what will and will not be copied.
- It preserves the Area's named pieces, explicitly entered lengths/widths/counts, splash flags/height, edge profiles, and default edge/splash settings.
- It **does not copy** customer, Deal, CRM, material selection, supplier buying cost, sink models/charges, selling price, tax, add-ons, issued evidence, approval, revision history, or rate/cost snapshots. Applying a saved layout creates one new Area with new IDs and no billable lines. No price is inferred.
- **My saved layouts** appears above the built-in Gallery. Each saved layout is deliberately marked **stored in this browser, not synced or shared**. There is explicit remove confirmation.
- Storage uses a strict allowlisted, versioned payload, count/size validation, and a key scoped to cloud organization ID **and user ID**. Missing cloud scope returns no personal layouts. On workspace/account switch the previous list is hidden synchronously, then the new list is loaded. Local mode is device-local.
- Maximum 30 layouts and 60 pieces per layout. Browser-storage failure does not create a false successful save.
- For full priced exact replicas, use **Duplicate Area** or **Start from previous quote** instead of this deliberately unpriced layout feature.

### Tests authored
- `quoteSavedAreaLayouts.test.ts`: preservation of geometry, excluding private/pricing fields, distinct IDs, hostile localStorage payloads, account/organization scoping, storage failure and template limits.
- `quotes-beta-saved-area-layout.pw.ts`: save and restore a named, measured Area layout in the local demo.

### Release acceptance outstanding
1. Run `npm run build`, TypeScript typecheck, Vitest, and the mobile/desktop Playwright journeys at the exact deployed commit.
2. Create a quote with prices, sinks, material snapshots and private costs; save the Area layout. Inspect browser local storage: no such fields or identifying customer data should appear. Reuse: price should remain unentered; the original remains unchanged.
3. Save and reuse across two draft quotes in the same signed-in organization/browser. Repeat after switching accounts/organizations on the same browser: the other account's list must not show or be editable. Confirm lack of synchronization on another device is clearly explained.
4. Validate 30-layout limit, 60-piece limit, corrupt storage, blocked/quota-exceeded storage, removal confirmation and undo of a just-added Area.
5. Verify dialog keyboard navigation, Escape, mobile scrolling, light/dark themes, and Cloudflare loaded bundle SHA.
6. Conduct authenticated Classic↔Beta, quote issuing/sharing/revision and Supabase RLS acceptance per earlier parity checklists. These were not run in this session.

### Future company-shared templates
A company-wide preset catalog should be a separate reviewed feature, with an owner/admin publish permission, explicit catalog/rate snapshot policy, user-visible revision metadata, tenant RLS and a tested migration/rollback path. No new Supabase schema or RLS code is included here.
