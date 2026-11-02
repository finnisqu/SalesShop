# Notebook Chrome-style editable split workspace

Both left and right Notebook pages are editable. Each pane has its own TipTap rich-text editor, toolbar, drawing canvas and object layer. The panes are independently scrollable. A small Chrome-inspired **Split group** interface is displayed in the left Notebook sidebar, with page labels and focus indication, plus an options menu:
- Reverse views (swap left and right pages)
- Stack or show side by side
- Close left, close right, exit split keeping left
- Choose a second page using the sidebar picker or by right-clicking a page and selecting **Open page on right**.

The left page is the existing primary Notebook page; the right pane's page is stored in transient UI state. Both edit the same existing Notebook document store. Page content and drawings remain persisted through existing Notebook synchronization. Toolbar and rich-text commands target their respective pane. Keyboard object deletion/lasso deletion is gated by the focused pane to avoid deleting content in two pages at once. Ctrl-Z/Ctrl-Y in a split-pane rich-text editor uses that editor's local text history; non-text actions use Notebook's existing shared history (not yet per-page).

Folder tree remains as delivered in the previous batch. No Notebook schema or cloud migrations; split arrangement is not saved across reloads in this first version.

Manual acceptance:
1. Open A on left and B on right. Type on both and refresh; edits survive. Check undo while caret is in either page.
2. Draw and edit objects on both; Delete should affect only selected content in focused pane.
3. Swap, stack, close left, close right, select different right page, then return to single page.
4. Verify right-click on page tab can open left or right, and fold/unfold folder hierarchy still works.
5. Verify mobile layout is stacked and split panel remains navigable.
6. Test light/dark contrast and Notebook cloud persistence.

Source authored and committed; browser acceptance is not inferred from a successful build.
