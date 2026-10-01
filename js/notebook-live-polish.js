/* Final notebook interaction guards loaded after notebook-live.js. */

const _salesShopLockedNotebookClickShouldWrite = notebookClickShouldWrite;
notebookClickShouldWrite = function(target) {
  if (!isCurrentNotebookPageEditable()) return false;
  return _salesShopLockedNotebookClickShouldWrite(target);
};

const _salesShopLockedOpenGridEditor = openGridEditor;
openGridEditor = function(root,canvas,placement,existingEntry=null) {
  if (!isCurrentNotebookPageEditable()) return;
  return _salesShopLockedOpenGridEditor(root,canvas,placement,existingEntry);
};
