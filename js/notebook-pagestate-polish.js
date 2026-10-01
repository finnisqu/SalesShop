/* Final page-state guard: New Page is the only page boundary and must not rehydrate
   the just-materialized live draft through an older wrapper. */

startFreshNotebookPage = function(root) {
  pageStateMaterializeDraft(root);
  currentNotebookDate = dateKey();
  state.notebook[currentNotebookDate] ||= [];
  const newPageId = uid('page');
  notebookPageState()[currentNotebookDate] = newPageId;
  currentNotebookPageId = newPageId;
  clearNotebookBufferedDraft(currentNotebookDate,newPageId);
  save();
  renderAll();
  setTimeout(()=>{
    const fresh = $('#notebookDock');
    const editor = $('[data-rich-draft-editor]',fresh) || $('[data-notebook-input]',fresh);
    editor?.focus?.();
  },0);
  toast('Fresh page');
};
