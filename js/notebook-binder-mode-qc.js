/* Final Binder display-mode + Grid-origin QC.
   Keeps the Binder visible in Single mode, makes Single/Double a persistent presentation toggle,
   and keeps the spatial lattice and interaction coordinates on one live rhythm/origin. */

/* In Single mode every open page belongs to the left bank. Double mode keeps the 3 + 3 split. */
if (typeof notebookTabQcLeftCount === 'function' && !window.__salesShopBinderSingleBankOverride) {
  window.__salesShopBinderSingleBankOverride = true;
  const _binderModeLeftCount = notebookTabQcLeftCount;
  notebookTabQcLeftCount = function(pages) {
    const list = pages || [];
    const mode = typeof notebookBinderDisplayMode === 'function' ? notebookBinderDisplayMode() : state.settings?.notebookBinderDisplayMode;
    if (mode === 'single') return Math.min(6,list.length);
    return _binderModeLeftCount(list);
  };
}

/* The spatial notebook is now a full-sheet coordinate system. Old Grid code still asks for a
   historical left archive offset; returning zero keeps its click math aligned with the live canvas. */
if (typeof gridWorkspaceLeft === 'function') {
  gridWorkspaceLeft = function() { return 0; };
}

function notebookBinderModeQcPages() {
  try { return notebookBinderOpenPages?.() || []; }
  catch { return []; }
}

function notebookBinderModeQcEnsureTopTabs(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  const pages=notebookBinderModeQcPages();
  if (pages.length<=1) {
    $('.notebook-binder-top-tabs',shell)?.remove();
    return;
  }

  const existing=$('.notebook-binder-top-tabs',shell);
  const renderedIds=existing ? $$('.notebook-binder-top-tab',existing).map(button=>button.dataset.binderPage).filter(Boolean) : [];
  const expectedIds=pages.map(page=>page.id);
  const stale=!existing || renderedIds.length!==expectedIds.length || expectedIds.some(id=>!renderedIds.includes(id));
  if (stale && typeof notebookFixInstallTopTabs==='function') notebookFixInstallTopTabs(root);
}

function notebookBinderModeQcEnsureSpreadToggle(root=$('#notebookDock')) {
  const control=$('[data-notebook-width-controls]',root);
  if (!control) return;
  if (typeof notebookFixInstallSpreadToggle==='function') notebookFixInstallSpreadToggle(root);

  let button=$('[data-notebook-spread-toggle]',control);
  if (!button) {
    button=document.createElement('button');
    button.type='button';
    button.className='notebook-width-button notebook-spread-toggle';
    button.dataset.notebookSpreadToggle='';
    control.appendChild(button);
  }

  const pages=notebookBinderModeQcPages();
  const mode=typeof notebookBinderDisplayMode==='function' ? notebookBinderDisplayMode() : (state.settings?.notebookBinderDisplayMode==='double'?'double':'single');
  const width=typeof notebookWidthMode==='function' ? notebookWidthMode() : state.settings?.notebookWidthMode;
  button.dataset.spreadMode=mode;
  button.innerHTML=typeof notebookFixSpreadGlyph==='function'
    ? notebookFixSpreadGlyph(mode)
    : `<span class="notebook-spread-glyph ${mode}" aria-hidden="true"><i></i>${mode==='double'?'<i></i>':''}</span>`;
  button.title=mode==='double'?'Switch to single-page view':'Switch to two-page view';
  button.setAttribute('aria-label',button.title);
  button.disabled=pages.length<2 || width==='float' || width==='dock-left';
  button.style.order='99';
  button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    control.classList.remove('position-click-collapsed');
    if (typeof setNotebookBinderDisplayMode==='function') setNotebookBinderDisplayMode(mode==='double'?'single':'double');
  };
}

function notebookBinderModeQcPolish(root=$('#notebookDock')) {
  if (!root) return;
  notebookBinderModeQcEnsureTopTabs(root);
  const nav=$('.notebook-binder-top-tabs',root);
  if (nav) nav.dataset.displayMode=typeof notebookBinderDisplayMode==='function' ? notebookBinderDisplayMode() : 'single';
  notebookTabQcRemoveLegacySideNavigation?.(root);
  notebookTabQcRelabelTopTabs?.(root);
  notebookTabQcArrangeTopTabs?.(root);
  notebookTabQcBuildUnderlays?.(root);
  notebookBinderModeQcEnsureSpreadToggle(root);
  binderFluidSyncGridExtent?.(root);
}

const _notebookBinderModeQcRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _notebookBinderModeQcRender(root);
  if (!root) return;
  notebookBinderModeQcPolish(root);
  requestAnimationFrame(()=>notebookBinderModeQcPolish(root));
};

if (!window.__salesShopBinderModeQcEvents) {
  window.__salesShopBinderModeQcEvents=true;
  let raf=0;
  const refresh=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>notebookBinderModeQcPolish($('#notebookDock')));
  };
  window.addEventListener('resize',refresh,{passive:true});
  document.addEventListener('fullscreenchange',refresh);
  document.addEventListener('click',event=>{
    if (event.target?.closest?.('#notebookDock [data-notebook-width],#notebookDock [data-notebook-spread-toggle]')) setTimeout(refresh,0);
  },true);
}

requestAnimationFrame(()=>notebookBinderModeQcPolish($('#notebookDock')));
