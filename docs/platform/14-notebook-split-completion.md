# Notebook split workspace — persistence and independent non-text undo (Batch 3)

- Split group right-hand page and chosen orientation are saved only on the current device, scoped to account/org in cloud mode and local in local mode. Left page remains stored using existing Notebook active-page persistence. Invalid/deleted or same-as-left page references are discarded at restore.
- Each pane can use its existing independent TipTap text history. Toolbar and keyboard shortcuts for drawing/object edits in split mode use page-specific stacks, leaving the other page untouched. Single-page mode retains global Notebook undo/redo. Switching from page-scoped undo clears older global snapshots so they cannot roll back unrelated pages.
- Both pane toolbars accept keyboard shortcuts only for their active pane. Contenteditable editors retain their own undo keyboard handling.
- Split orientation can also be changed in the main workspace bar when the Notebook sidebar controls are hidden on mobile/tablet.
- No database migrations or Notebook document format changes.
- QA: restore layout after reload in two account scopes, remove/reopen right-hand page, reverse/stack, and undo separate page drawings/objects. Verify cloud persistence and TipTap text undo, 375/768/1280px and light/dark themes. Browser/build tests remain separate.
