/* Final Notebook navigation / Binder persistence guard.
   Returning through the main Notebook tab must restore the workspace exactly as the user left it:
   open pages, visible spread, Single/Double mode, active page, tabs, and paper layers. */

function notebookNavigationSnapshot() {
  state.settings ||= {};
  const raw=Array.isArray(state.settings.notebookBinderOpenPages)
    ? state.settings.notebookBinderOpenPages.map(ref=>({key:ref?.key,pageId:ref?.pageId})).filter(ref=>ref.key&&ref.pageId)
    : [];
  let roster=raw;
  if (!roster.length) {
    try {
      roster=(notebookFinalBinderRoster?.()||[]).map(ref=>({key:ref.key,pageId:ref.pageId})).filter(ref=>ref.key&&ref.pageId);
    } catch {}
  }
  let date=currentNotebookDate;
  let pageId=currentNotebookPageId;
  try {
    const working=notebookWorkingPageState?.();
    const workingOpen=working?.key&&working?.pageId && (!roster.length || roster.some(ref=>ref.key===working.key&&ref.pageId===working.pageId));
    if (currentView!=='notebook' && workingOpen) {
      date=working.key;
      pageId=working.pageId;
    }
  } catch {}
  return {
    roster,
    spread:Array.isArray(state.settings.notebookBinderSpread)?[...state.settings.notebookBinderSpread]:[],
    mode:state.settings.notebookBinderDisplayMode==='double'?'double':'single',
    activeSide:state.settings.notebookBinderActiveSide||'left',
    date,
    pageId
  };
}

function restoreNotebookNavigationSnapshot(snapshot,{persist=false}={}) {
  if (!snapshot) return;
  state.settings ||= {};
  if (snapshot.roster?.length) state.settings.notebookBinderOpenPages=snapshot.roster.map(ref=>({key:ref.key,pageId:ref.pageId}));
  state.settings.notebookBinderDisplayMode=snapshot.mode==='double'?'double':'single';
  state.settings.notebookBinderSpread=Array.isArray(snapshot.spread)?[...snapshot.spread]:[];
  state.settings.notebookBinderActiveSide=snapshot.activeSide||'left';
  if (snapshot.date) currentNotebookDate=snapshot.date;
  if (snapshot.pageId) currentNotebookPageId=snapshot.pageId;
  if (persist) save();
}

function notebookNavigationRemoveSwap(root=$('#notebookDock')) {
  if (!root) return;
  $$([
    '.notebook-peer-swap',
    '.notebook-reference-swap',
    '.notebook-binder-grid-button.notebook-peer-swap',
    '[data-notebook-swap]',
    '[data-peer-swap]'
  ].join(','),root).forEach(node=>node.remove());
}

function notebookNavigationRestoreChrome(root=$('#notebookDock')) {
  if (!root) return;
  notebookNavigationRemoveSwap(root);
  notebookFinalEnsureSpreadControl?.(root);
  notebookBinderModeQcPolish?.(root);
  notebookFixInstallTopTabs?.(root);
  notebookTabQcRelabelTopTabs?.(root);
  notebookTabQcArrangeTopTabs?.(root);
  notebookTabQcBuildUnderlays?.(root);
  notebookNavigationRemoveSwap(root);
}

/* The original showView('notebook') intentionally reset currentNotebookDate to today. That made
   sense before resumable pages/Binder state existed, but it now tears down the working spread.
   Notebook navigation is therefore a pure workspace-navigation action: no page identity changes. */
if (typeof showView==='function' && !window.__salesShopMainNotebookPreservesBinder) {
  window.__salesShopMainNotebookPreservesBinder=true;
  const _navigationShowView=showView;
  showView=function(name) {
    if (name!=='notebook') return _navigationShowView(name);
    const snapshot=notebookNavigationSnapshot();

    currentView='notebook';
    document.body.dataset.view='notebook';
    const workspace=$('#workspaceBody');
    workspace?.classList.add('notebook-focus');
    $$('.view').forEach(view=>view.classList.remove('active'));
    $$('.top-tab').forEach(button=>button.classList.toggle('active',button.dataset.view==='notebook'));

    restoreNotebookNavigationSnapshot(snapshot);
    renderAll();

    /* Some compatibility layers still write legacy page state during render. The snapshot is the
       user's actual Binder state, so restore it immediately and once again after layout settles. */
    restoreNotebookNavigationSnapshot(snapshot,{persist:true});
    notebookNavigationRestoreChrome($('#notebookDock'));
    requestAnimationFrame(()=>{
      restoreNotebookNavigationSnapshot(snapshot,{persist:true});
      notebookNavigationRestoreChrome($('#notebookDock'));
    });
  };
}

/* Page-local actions are rebuilt on most notebook renders, so remove Swap after the complete stack. */
const _notebookNavigationFinalRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _notebookNavigationFinalRender(root);
  if (!root) return;
  notebookNavigationRestoreChrome(root);
  requestAnimationFrame(()=>notebookNavigationRestoreChrome(root));
};

/* Guard against a late legacy render recreating Swap without requiring another full render. */
if (!window.__salesShopRemoveSwapObserver) {
  window.__salesShopRemoveSwapObserver=true;
  const dock=$('#notebookDock');
  if (dock && typeof MutationObserver!=='undefined') {
    let queued=false;
    const observer=new MutationObserver(mutations=>{
      if (queued) return;
      const relevant=mutations.some(mutation=>[...mutation.addedNodes].some(node=>
        node?.nodeType===1 && (node.matches?.('.notebook-peer-swap,.notebook-reference-swap,[data-notebook-swap],[data-peer-swap]') || node.querySelector?.('.notebook-peer-swap,.notebook-reference-swap,[data-notebook-swap],[data-peer-swap]'))
      ));
      if (!relevant) return;
      queued=true;
      requestAnimationFrame(()=>{ queued=false;notebookNavigationRemoveSwap(dock); });
    });
    observer.observe(dock,{childList:true,subtree:true});
  }
}

requestAnimationFrame(()=>notebookNavigationRestoreChrome($('#notebookDock')));
