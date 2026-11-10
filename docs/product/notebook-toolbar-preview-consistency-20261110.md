# Notebook toolbar + shared quick-preview consistency — Nov 10, 2026

## Completed
- Notebook phone toolbar: inline undo/redo, selection, drawing tools, add and Page Options remain; rich-text (Bold, Italic, H2, list, quote) and Pencil/Finger drawing input now live in an **Aa** popover rather than occupying the whole row. Desktop toolbar still uses its existing full controls.
- Mobile Aa popover: has touch-sized controls, state highlighting, preserves focus for Tiptap formatting and is scrollable above small viewports or the iPhone keyboard. Clicking outside, Escape, or Close dismisses it using the existing toolbar menu behavior.
- Notebook page navigator: favorite markers and creation dates distinguish identically named / untitled pages while preserving the same underlying page selection.
- Task and Activity previews now share PreviewPanelHeading, PreviewPanelClose, and PreviewPanelActions with Person/Company/Deal record previews. The shared styling standardizes label/title size, close target, bottom actions, focus and safe-area spacing across desktop and mobile.
- Existing bid-submission task guards, checked subtasks, activity edit permissions and record links are unchanged.
- No Supabase schema, user records, quote pricing or CI settings changed.

## Manual mobile QC
1. Notebook iPhone: verify one toolbar row; tap **Aa**, format a word Bold/Italic, create a bullet list, change H2. Ensure selection persists with iOS keyboard and Aa menu doesn't clip offscreen.
2. Use Pencil/Finger controls from Aa and draw, then switch to selector. Confirm Drawing Tools, Insert and Page Options remain functional.
3. Create two Untitled pages; page picker distinguishes them by date (same-day pages still have distinct IDs, but identical date labels may require a future inline renaming flow).
4. Open Task quick preview from Home Agenda and Tasks; verify identical header/close location to an Activity preview and no second grip. Complete an ordinary Task, and confirm bid-guarded Task still requires actual quote submission.
5. From Home Recents and Company Relationship History open Activity details; check edit and readonly modes, long titles, linked-record actions, Cancel/Save/Close and safe-area padding.
6. On mobile & desktop test Light / Dark / Warm themes, scroll with the iPhone keyboard open, backdrop tap, Escape and focus restoration.
7. Check Cloudflare TypeScript/Quick Quote tests/Vite build before claiming deployed, then visually spot check the signed-in app.

## Remaining future enhancements
- A consolidated record-preview action hierarchy for Delete/More actions across ALL record types would be a distinct behavior change and needs a separate review.
- Full end-to-end browser QA remains outside the repository-only session.
