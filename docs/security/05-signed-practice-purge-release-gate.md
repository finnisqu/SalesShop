# Signed practice quote purge — release gate

Status: **migration staged in source, not applied to production.**

Migration: `supabase/migrations/20261104171500_guarded_archived_practice_quote_purge.sql`.

## Scope

- User-selected, archived test quotes only; no automatic bulk cleanup or automatic test classification.
- Requires database Owner/Admin membership, Quotes and CRM edit rights, quote ownership or legacy unassigned ownership, and exact quote-number confirmation.
- Signed records require `PURGE SIGNED <quote number>`. An explicit practice-only checkbox is also required in SalesShop.
- Removes quote-generated CRM activity, signed test signature records, then the quote; dependent revisions/share tokens/lines/sections cascade inside one transaction.
- Doesn't delete the linked Company, Person, Deal or personal Tasks.
- Blocks unresolved child Change Orders and independent manual CRM activity.

## Before production deployment

1. Test with an **isolated, disposable Supabase organization**, including a signed test quote, unsigned sent quote, share link, automatic Deal stage history, manual activity, linked Task, and child Change Order.
2. Verify the function is denied to ordinary members, viewers, other tenants, and Owner/Admin users for another salesperson's quote. A role-preview UI must not expose the action.
3. Verify **nothing** is deleted on a rejected confirmation, real signature mismatch, blocked dependency, SQL failure, or incomplete deletion. Confirm a successful purge removes signatures and revokes old customer share links.
4. Run client CI, database role/RLS QC and interactive desktop/mobile acceptance at 100% zoom. Check activity-list scrolling at standard and reduced window heights.
5. Capture the last known-good production deployment, database recovery strategy, and exact counts; deploy migration with a planned rollback window.
6. Only then enable signed-practice purge on the real app. Never run the purge on real customer contracts; the user must select each test quote explicitly.

## Rollback

Before any purge, rollback the capability by revoking execute on the function from `authenticated`; optionally drop the function with `DROP FUNCTION IF EXISTS public.purge_archived_practice_quote(uuid,text,text)`. This prevents new purges but **cannot restore previously deleted test records**. Database recovery, if needed, must be managed through a preplanned verified backup strategy.

There is intentionally no automatic deployment of the migration and no production-data mutation in this change.
