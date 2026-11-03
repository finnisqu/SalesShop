# Activities + Calendar — release acceptance

This feature branch is **not verified** until its TypeScript, Vitest, Vite and phone/browser checks pass.

## Run
`npm ci`, `npm run test:calendar`, `npm run test`, `npm run build`. Keep automatic GitHub checks disabled unless explicitly requested.

## Manual workflows
- Log a Call from Home and from Person/Company/Deal previews. Check inferred associations and mismatched-company warnings.
- Simulate offline, localStorage quota failure, refresh, retry and sign-out while an Activity save is pending. Never indicate saved when durable queuing failed.
- Correct and void an Activity. Verify the original ID and correction audit, synchronized Notes and Calendar date, and no stale-write regressions from another salesperson.
- Log an interaction linked to a private Quote without edit access: Supabase must reject.
- Check shared Activity timeline on Person, Company and Deal pages; one record is displayed under all associated entities.
- Create a follow-up Task from Activity and navigate both directions.
- Switch Calendar month/agenda, filter event types, create a dated Task and bid deadline; check signed/declined/revised Quote follow-ups.
- Verify Home Upcoming only displays user-scoped work; no unnecessary Activity metrics.
- Test 320px and 390px phones, landscape, keyboard, safe-area, grabber-only swipe dismissal, Escape, reduced motion, and screen reader labels.
- Regress Quotes, Board, Notebook, Connections, Tasks, and Cloudflare deployment.

## Release status
Database permission and bid-date migrations have been applied. Application code is on the development branch; browser, TypeScript and test execution remain pending.
