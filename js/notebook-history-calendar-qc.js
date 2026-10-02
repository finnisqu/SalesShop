/* State hardening for resumable notebook pages. */

if (typeof notebookWorkingPageState==='function' && !window.__salesShopWorkingPageValidation) {
  window.__salesShopWorkingPageValidation=true;
  const _workingPageStateRaw=notebookWorkingPageState;
  notebookWorkingPageState=function() {
    const saved=state.settings?.notebookWorkingPage;
    if (saved?.key && saved?.pageId) {
      const order=typeof notebookPageOrderForDate==='function' ? notebookPageOrderForDate(saved.key) : [];
      if (!order.length || order.includes(saved.pageId)) return saved;
      delete state.settings.notebookWorkingPage;
    }
    return _workingPageStateRaw();
  };
}

/* Working-page identity and activity belong to notebook history state so Undo/Redo cannot restore
   page content while leaving Current aimed at a page from the discarded state. */
if (typeof notebookHistorySnapshot==='function' && !window.__salesShopWorkingPageUndo) {
  window.__salesShopWorkingPageUndo=true;
  const _workingPageSnapshot=notebookHistorySnapshot;
  notebookHistorySnapshot=function() {
    const parsed=JSON.parse(_workingPageSnapshot());
    parsed.notebookWorkingPage=state.settings?.notebookWorkingPage || null;
    parsed.notebookPageActivityByPage=state.settings?.notebookPageActivityByPage || {};
    return JSON.stringify(parsed);
  };

  const _workingPageRestore=restoreNotebookHistorySnapshot;
  restoreNotebookHistorySnapshot=function(snapshot) {
    try {
      const parsed=JSON.parse(snapshot);
      state.settings ||= {};
      if (parsed.notebookWorkingPage) state.settings.notebookWorkingPage=parsed.notebookWorkingPage;
      else delete state.settings.notebookWorkingPage;
      state.settings.notebookPageActivityByPage=parsed.notebookPageActivityByPage || {};
    } catch {}
    return _workingPageRestore(snapshot);
  };
}
