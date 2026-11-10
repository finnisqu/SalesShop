# External quote parity and reliability sweep — 2026-11-10

## Read-only database checks
- Production Supabase reports 4 genuine external quote-sent Activities, 4 registry external entries, 0 native normalized quote entries and 0 duplicate registry keys.
- `sales_quote_registry` has `security_invoker=true`, denies SELECT to anonymous role and grants authenticated SELECT subject to RLS. This is a schema inspection, not a two-user policy simulation.
- Supabase security-advisor has pre-existing security-definer RPC notices; this batch does not modify policies or RPCs.

## Fixed
- Repeated in-memory Activity copies during retry/hydration could previously inflate Team quoted value, duplicate external entries in the primary Quotes library and CRM detail pages, and repeat Home/calendar data despite directory counters being deduplicated.
- One shared immutable Activity-ID deduplication rule now governs genuine external bid records across Quotes, CRM, Home, calendar source, badge and drilldown. Native quote history remains unchanged.
- Home Calendar's Quote Sent badge for an external bid opens the actual Activity details, not only the associated Deal.
- Added regression coverage for quote registry, history, badge counts, personal calendar and drilldown identity.

## Follow-up verification
Run `npm run test:quote-registry`, `npm run test:external-quotes`, `npm run test:calendar`, `npm run test`, and `npm run build` in an environment with a checkout. Manually check phone/desktop, backdated submissions, two-user/organization access, cloud disconnect/retry, Team filters and native quote workflow parity. Do not infer a browser QA pass from a Cloudflare build.

No Gantt, schema, production data, or CI configuration changes.
