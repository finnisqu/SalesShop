# Quick Quote durability, archived navigation, and build regression

November 1, 2026.

## Root causes addressed
1. Earlier Quotes Beta progressive-disclosure patch left a JSX prop unterminated in `src/components/QuotesMobileBeta.tsx` (`disabled={!editable`); TypeScript terminated the Cloudflare production build before deploying any following commits.
2. The quote store saves locally immediately, while `startCloudSync` waits 500ms before syncing; cloud startup previously unconditionally overwrote local quotes with normalized server data, losing changes never delivered/accepted. This batch writes a scoped durable *pending marker* at save time, merges only that user's still-editable drafts on reload, and retries the upload. It leaves frozen, archived and other users' quotes canonical on the server.
3. Default selection and stale deep links could reopen an archived quote. Both the normalized loader and local store now prefer a non-archived quote; old archived deep-link routes return to Quotes.
4. The old save label only said "Saved on device". The document header now differentiates pending, saving, saved to cloud, and failure; failure retains the local draft and offers a manual retry.
5. An empty real cloud quote library no longer creates a local sample quote automatically.

## Acceptance / release checks
- Verify Cloudflare Workers build is Ready for a commit containing all fixes; the earlier single-syntax fix build was still failing, so request compiler output if needed.
- Create "Persistence test" Quick Quote, rename, add line & measured Area, refresh immediately, check it still exists and matches; await "Saved to cloud", reload again and check.
- Simulate offline or a denied write: "Cloud save failed" is visible, draft survives reload, and a later retry persists it. No auth bypass, RLS modifications, or migrations.
- Archive the active quote then reload; active selection should be another unarchived quote, or library if none.
- With a stale archived quote deep-link, boot into Quotes instead of auto-opening it. Don't mutate or delete that historical quote.
- Confirm existing other-user and issued quotes remain unchanged, any frozen quote still requires revision to edit, and customer approval/issue/share continue to work.
- Verify local-only mode and developer sandbox are unchanged.

Tests for helper logic are committed but not executed in this GitHub-only session. Existing Cloudflare production build is a compiler check, not proof of DB/RLS behavior. Existing vanished drafts might not be recoverable once overwritten; avoid clearing browser storage while investigating.
