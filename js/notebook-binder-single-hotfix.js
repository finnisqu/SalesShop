/* Single-page Binder quarantine hotfix.
   The clean Binder is now the sole owner of open-page tabs/layers/actions.
   Legacy split/reference builders are disabled, and tab switching carries an immutable
   roster snapshot through render so older wrappers cannot collapse open pages to one. */

function singleBinderHotfixRoster() {
  const source=Array.isArray(state.settings?.notebookBinderOpenPages)
    ? state.settings.notebookBinderOpenPages
    : (typeof singleBinderOpenPages==='function' ? singleBinderOpenPages() : []);
  const seen=new Set();
  return source.map(ref=>typeof singleBinderRef==='function'?singleBinderRef(ref):ref)
    .filter(ref=>ref?.key&&ref?.pageId)
    .filter(ref=>{
      const id=ref.id || `${ref.key}::${ref.pageId}`;
      if (seen.has(id)) return false;
      seen.add(id);return true;
    })
    .slice(0,6)
    .map(ref=>({key:ref.key,pageId:ref.pageId,id:ref.id||`${ref.key}::${ref.pageId}`}));
}

function singleBinderHotfixRestoreRoster(roster,{persist=false}={}) {
  if (!Array.isArray(roster)||!roster.length) return;
  state.settings ||= {};
  state.settings.notebookBinderOpenPages=roster.map(({key,pageId})=>({key,pageId}));
  state.settings.notebookOpenPageOrder=roster.map(ref=>ref.id||`${ref.key}::${ref.pageId}`);
  state.settings.notebookBinderDisplayMode='single';
  const active=typeof singleBinderCurrentRef==='function' ? singleBinderCurrentRef() : null;
  state.settings.notebookBinderSpread=active?[active.id]:[];
  state.settings.notebookBinderActiveSide='left';
  delete state.settings.notebookReferencePage;
  delete state.settings.notebookPaperFront;
  delete state.settings.notebookPaperLayout;
  if (persist) save();
}

function singleBinderHotfixRemoveLegacy(root=$('#notebookDock')) {
  if (!root) return;
  $$([
    '.notebook-binder-top-tabs',
    '.notebook-binder-side-rail',
    '.notebook-binder-tabs',
    '.notebook-binder-tabs-final',
    '.notebook-binder-paper-layers',
    '.notebook-binder-page-layers',
    '.notebook-paper-active-tab',
    '.notebook-paper-peek',
    '.notebook-reference-page',
    '.notebook-reference-scroller',
    '.notebook-peer-local-actions',
    '.notebook-binder-page-actions',
    '.notebook-reference-actions',
    '.notebook-split-page-actions',
    '.notebook-spread-toggle',
    '[data-notebook-spread-toggle]',
    '.notebook-peer-swap',
    '.notebook-reference-swap',
    '[data-notebook-swap]',
    '[data-peer-swap]'
  ].join(','),root).forEach(node=>node.remove());

  const cleanTabs=$$('.notebook-binder-tabs-clean',root);
  cleanTabs.slice(1).forEach(node=>node.remove());
  const cleanLayers=$$('.notebook-binder-layers-clean',root);
  cleanLayers.slice(1).forEach(node=>node.remove());
  const cleanActions=$$('.notebook-single-page-actions',root);
  cleanActions.slice(1).forEach(node=>node.remove());
}

/* Disable the known legacy builders that may run in delayed RAF callbacks. */
if (typeof notebookFixInstallTopTabs==='function') notebookFixInstallTopTabs=function(root=$('#notebookDock')){ singleBinderHotfixRemoveLegacy(root); };
if (typeof notebookFixInstallPaperLayers==='function') notebookFixInstallPaperLayers=function(root=$('#notebookDock')){ singleBinderHotfixRemoveLegacy(root); };
if (typeof binderFluidBuildPaperLayers==='function') binderFluidBuildPaperLayers=function(root=$('#notebookDock')){ singleBinderHotfixRemoveLegacy(root); };
if (typeof binderFluidRefreshTabs==='function') binderFluidRefreshTabs=function(root=$('#notebookDock')){ singleBinderHotfixRemoveLegacy(root); };
if (typeof installNotebookBinderDualRails==='function') installNotebookBinderDualRails=function(root=$('#notebookDock')){ singleBinderHotfixRemoveLegacy(root); };
if (typeof installNotebookBinderTabsFinal==='function') installNotebookBinderTabsFinal=function(root=$('#notebookDock')){ singleBinderHotfixRemoveLegacy(root); };

/* Tab activation is transactional: roster before render === roster after render. */
if (typeof singleBinderActivate==='function') {
  singleBinderActivate=function(ref,{record=true}={}) {
    ref=typeof singleBinderRef==='function'?singleBinderRef(ref):ref;
    if (!ref?.key||!ref?.pageId) return;
    const roster=singleBinderHotfixRoster();
    const id=ref.id||`${ref.key}::${ref.pageId}`;
    if (!roster.some(page=>page.id===id)) return;
    const active=typeof singleBinderCurrentRef==='function'?singleBinderCurrentRef():null;
    if (active?.id===id) return;

    notebookPageState()[ref.key]=ref.pageId;
    if (typeof setNotebookWorkingPage==='function') setNotebookWorkingPage(ref.key,ref.pageId,{record,kind:'binder-tab'});
    currentNotebookDate=ref.key;
    currentNotebookPageId=ref.pageId;
    singleBinderHotfixRestoreRoster(roster);
    save();
    renderAll();

    /* Legacy render wrappers may have written spread state while rendering. Put the Binder roster
       back immediately, then again after layout callbacks finish. */
    singleBinderHotfixRestoreRoster(roster,{persist:true});
    singleBinderHotfixRemoveLegacy($('#notebookDock'));
    singleBinderPolish?.($('#notebookDock'));
    requestAnimationFrame(()=>{
      singleBinderHotfixRestoreRoster(roster,{persist:true});
      singleBinderHotfixRemoveLegacy($('#notebookDock'));
      singleBinderPolish?.($('#notebookDock'));
    });
  };
  binderSetActivePage=function(ref,{record=true}={}){ singleBinderActivate(ref,{record}); };
  activateNotebookPeerPage=function(ref,{record=true}={}){ singleBinderActivate(ref,{record}); };
  notebookBinderOpenPageOnSide=function(ref,side,{record=true}={}){ singleBinderActivate(ref,{record}); };
}

/* Opening from History also preserves every already-open tab. */
openNotebookPageInBinder=function(key,pageId) {
  const ref=typeof singleBinderRef==='function'?singleBinderRef({key,pageId}):{key,pageId,id:`${key}::${pageId}`};
  if (!ref?.key||!ref?.pageId) return;
  let roster=singleBinderHotfixRoster();
  const id=ref.id||`${ref.key}::${ref.pageId}`;
  if (!roster.some(page=>page.id===id)) {
    if (roster.length>=6) return toast?.('Binder can hold up to 6 open pages.');
    roster=[...roster,{key:ref.key,pageId:ref.pageId,id}];
  }
  singleBinderHotfixRestoreRoster(roster,{persist:true});
  closeModal?.();
  if (singleBinderCurrentRef?.()?.id===id) {
    renderAll();
    singleBinderHotfixRestoreRoster(roster,{persist:true});
    singleBinderPolish?.($('#notebookDock'));
    return;
  }
  singleBinderActivate(ref,{record:true});
};
setNotebookReferencePage=function(key,pageId){ openNotebookPageInBinder(key,pageId); };

/* If an old RAF manages to recreate retired UI, remove only the retired nodes; do not rebuild state. */
if (!window.__salesShopSingleBinderLegacyObserver) {
  window.__salesShopSingleBinderLegacyObserver=true;
  const dock=$('#notebookDock');
  if (dock && typeof MutationObserver!=='undefined') {
    let queued=false;
    const observer=new MutationObserver(mutations=>{
      if (queued) return;
      const legacySelector='.notebook-binder-top-tabs,.notebook-binder-side-rail,.notebook-binder-paper-layers,.notebook-binder-page-layers,.notebook-reference-page,.notebook-reference-scroller,.notebook-peer-local-actions,.notebook-binder-page-actions,.notebook-reference-actions,.notebook-split-page-actions,.notebook-spread-toggle,[data-notebook-spread-toggle]';
      const relevant=mutations.some(m=>[...m.addedNodes].some(node=>node?.nodeType===1&&(node.matches?.(legacySelector)||node.querySelector?.(legacySelector))));
      if (!relevant) return;
      queued=true;
      requestAnimationFrame(()=>{ queued=false;singleBinderHotfixRemoveLegacy(dock); });
    });
    observer.observe(dock,{childList:true,subtree:true});
  }
}

singleBinderHotfixRestoreRoster(singleBinderHotfixRoster(),{persist:true});
requestAnimationFrame(()=>{
  singleBinderHotfixRemoveLegacy($('#notebookDock'));
  singleBinderPolish?.($('#notebookDock'));
});
