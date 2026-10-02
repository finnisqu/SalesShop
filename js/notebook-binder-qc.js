/* Final Binder state guard: legacy Reference is migration input only, never a second source of truth. */
notebookBinderOpenPages=function() {
  state.settings ||= {};
  const current=binderNormalizeRef({key:currentNotebookDate,pageId:currentNotebookPageId});
  const hasBinderState=Array.isArray(state.settings.notebookBinderOpenPages);
  let pages=hasBinderState
    ? state.settings.notebookBinderOpenPages.map(binderNormalizeRef).filter(Boolean)
    : [];

  if (!hasBinderState) {
    const legacy=binderNormalizeRef(state.settings.notebookReferencePage);
    const oldOrder=Array.isArray(state.settings.notebookOpenPageOrder) ? state.settings.notebookOpenPageOrder : [];
    pages=oldOrder.map(binderRefFromId).filter(Boolean);
    if (current && !pages.some(page=>page.id===current.id)) pages.unshift(current);
    if (legacy && !pages.some(page=>page.id===legacy.id)) pages.push(legacy);
  }

  if (current && !pages.some(page=>page.id===current.id)) pages.unshift(current);
  const seen=new Set();
  pages=pages.filter(page=>page?.id && !seen.has(page.id) && seen.add(page.id)).slice(0,NOTEBOOK_BINDER_MAX_PAGES);
  if (!pages.length && current) pages=[current];
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  return pages;
};

requestAnimationFrame(()=>installNotebookBinderFinal?.($('#notebookDock')));
