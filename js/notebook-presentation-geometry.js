/* Presentation geometry stabilization for the clean single-page Binder.
   Presentation mode changes resize the paper without necessarily resizing the browser.
   Keep tabs, hidden paper layers, Medium toolbar, Float bounds, and Grid extent locked
   to the live sheet rect without letting old pixel geometry accumulate. */

let notebookPresentationGeometryRaf=0;
let notebookPresentationGeometryTimer=0;
let notebookPresentationPageObserver=null;
let notebookPresentationObservedPage=null;
let notebookPresentationLastWidth=0;
let notebookPresentationLastHeight=0;
let notebookPresentationLastLeft=0;
let notebookPresentationLastTop=0;
let notebookPresentationLastMode='';
let notebookPresentationExtentRaf=0;

function notebookPresentationMode(shell) {
  if (typeof notebookWidthMode==='function') return notebookWidthMode();
  if (!shell) return 'full';
  if (shell.classList.contains('notebook-width-float')) return 'float';
  if (shell.classList.contains('notebook-width-medium')) return 'medium';
  return 'full';
}

function clearNotebookDockFloatGeometry(root=$('#notebookDock')) {
  const dock=root?.closest?.('#notebookDock') || (root?.id==='notebookDock'?root:$('#notebookDock'));
  if (!dock || notebookPresentationMode($('.notebook-shell',dock))==='float') return;
  ['left','top','right','bottom','width','height'].forEach(prop=>dock.style.removeProperty(prop));
}

function clampNotebookFloatingDock(root=$('#notebookDock')) {
  const dock=root?.closest?.('#notebookDock') || (root?.id==='notebookDock'?root:$('#notebookDock'));
  const shell=$('.notebook-shell',dock);
  if (!dock || !shell || notebookPresentationMode(shell)!=='float') return;

  const rect=dock.getBoundingClientRect();
  const maxWidth=Math.max(280,window.innerWidth-8);
  const maxHeight=Math.max(230,window.innerHeight-58);
  let width=Math.min(rect.width||370,maxWidth);
  let height=Math.min(rect.height||430,maxHeight);
  let left=Math.min(Math.max(4,rect.left),Math.max(4,window.innerWidth-width-4));
  let top=Math.min(Math.max(54,rect.top),Math.max(54,window.innerHeight-height-4));

  if (Math.abs(width-rect.width)>.5) dock.style.width=`${Math.round(width)}px`;
  if (Math.abs(height-rect.height)>.5) dock.style.height=`${Math.round(height)}px`;
  dock.style.left=`${Math.round(left)}px`;
  dock.style.top=`${Math.round(top)}px`;
  dock.style.right='auto';
  dock.style.bottom='auto';
}

function resetNotebookGridExtent(root=$('#notebookDock')) {
  if (!root) return;
  $$('.notebook-page.paper-grid',root).forEach(page=>{
    const body=$('.notebook-page-body',page);
    const canvas=$('.grid-notebook-canvas',page);
    if (!body || !canvas) return;
    canvas.style.removeProperty('min-width');
    body.style.removeProperty('min-width');
    body.style.removeProperty('min-height');
  });
}

/* Both clean spatial layers historically measured scrollWidth after writing min-width back to the
   same elements. That made Grid geometry monotonic: Full could grow it, Medium could never shrink it.
   Always measure from a clean baseline, let the elastic canvas recompute, then measure once more. */
const _presentationBinderGridExtent=typeof singleBinderGridExtent==='function' ? singleBinderGridExtent : null;
singleBinderGridExtent=function(root=$('#notebookDock')) {
  if (!root) return;
  resetNotebookGridExtent(root);
  sizeGridCanvasToContent?.(root);
  _presentationBinderGridExtent?.(root);

  cancelAnimationFrame(notebookPresentationExtentRaf);
  notebookPresentationExtentRaf=requestAnimationFrame(()=>{
    resetNotebookGridExtent(root);
    sizeGridCanvasToContent?.(root);
    requestAnimationFrame(()=>{
      resetNotebookGridExtent(root);
      _presentationBinderGridExtent?.(root);
    });
  });
};

if (typeof notebookCleanSyncGridExtent==='function') {
  notebookCleanSyncGridExtent=function(root=$('#notebookDock')) {
    singleBinderGridExtent(root);
  };
}

function notebookPresentationGeometrySignature(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  const page=$('.notebook-page',shell);
  if (!shell || !page) return null;
  const shellRect=shell.getBoundingClientRect();
  const pageRect=page.getBoundingClientRect();
  if (!pageRect.width || !pageRect.height) return null;
  return {
    shell,
    page,
    mode:notebookPresentationMode(shell),
    width:Math.round(pageRect.width),
    height:Math.round(pageRect.height),
    left:Math.round(pageRect.left-shellRect.left),
    top:Math.round(pageRect.top-shellRect.top)
  };
}

function syncNotebookPresentationGeometry(root=$('#notebookDock'),{force=false}={}) {
  const beforeShell=$('.notebook-shell',root);
  if (!beforeShell) return;

  const mode=notebookPresentationMode(beforeShell);
  if (mode==='float') clampNotebookFloatingDock(root);
  else clearNotebookDockFloatGeometry(root);

  const geometry=notebookPresentationGeometrySignature(root);
  if (!geometry) return;

  const changed=force ||
    geometry.page!==notebookPresentationObservedPage ||
    geometry.mode!==notebookPresentationLastMode ||
    geometry.width!==notebookPresentationLastWidth ||
    geometry.height!==notebookPresentationLastHeight ||
    geometry.left!==notebookPresentationLastLeft ||
    geometry.top!==notebookPresentationLastTop;

  notebookPresentationLastMode=geometry.mode;
  notebookPresentationLastWidth=geometry.width;
  notebookPresentationLastHeight=geometry.height;
  notebookPresentationLastLeft=geometry.left;
  notebookPresentationLastTop=geometry.top;

  const tabs=$('.notebook-binder-tabs-clean',geometry.shell);
  if (tabs) {
    tabs.style.width=`${geometry.width}px`;
    tabs.style.marginLeft=`${Math.max(0,geometry.left)}px`;
    tabs.style.marginRight='0';
  }

  const toolbar=$('.notebook-toolbar',geometry.shell);
  if (toolbar) {
    if (geometry.mode==='medium') {
      toolbar.style.width=`${geometry.width}px`;
      toolbar.style.maxWidth=`${geometry.width}px`;
    } else {
      toolbar.style.removeProperty('width');
      toolbar.style.removeProperty('max-width');
    }
    toolbar.style.removeProperty('margin-left');
    toolbar.style.removeProperty('margin-right');
  }

  if (changed) {
    $('.notebook-binder-layers-clean',geometry.shell)?.remove();
    singleBinderInstallLayers?.(root);
    singleBinderGridExtent(root);
  }
}

function scheduleNotebookPresentationGeometry(root=$('#notebookDock'),{force=false}={}) {
  cancelAnimationFrame(notebookPresentationGeometryRaf);
  clearTimeout(notebookPresentationGeometryTimer);
  notebookPresentationGeometryRaf=requestAnimationFrame(()=>{
    notebookPresentationGeometryRaf=requestAnimationFrame(()=>syncNotebookPresentationGeometry(root,{force}));
  });
  /* A second pass catches width transitions, Float resize, and late page-layout work. */
  notebookPresentationGeometryTimer=setTimeout(()=>syncNotebookPresentationGeometry(root,{force}),180);
}

function observeNotebookPresentationPage(root=$('#notebookDock')) {
  const page=$('.notebook-page',root);
  if (!page || typeof ResizeObserver==='undefined') return;
  if (page===notebookPresentationObservedPage) return;

  notebookPresentationPageObserver?.disconnect();
  notebookPresentationObservedPage=page;
  notebookPresentationLastWidth=0;
  notebookPresentationLastHeight=0;
  notebookPresentationLastLeft=0;
  notebookPresentationLastTop=0;
  notebookPresentationLastMode='';
  notebookPresentationPageObserver=new ResizeObserver(()=>{
    scheduleNotebookPresentationGeometry(root);
  });
  notebookPresentationPageObserver.observe(page);
}

/* Programmatic mode changes use the same cleanup path as toolbar clicks. This is especially
   important when leaving Float: fixed-position inline geometry must not leak into Medium/Full. */
if (typeof applyNotebookWidthMode==='function' && !window.__salesShopPresentationApplyWidth) {
  window.__salesShopPresentationApplyWidth=true;
  const _presentationApplyNotebookWidthMode=applyNotebookWidthMode;
  applyNotebookWidthMode=function(root) {
    const result=_presentationApplyNotebookWidthMode(root);
    const shell=$('.notebook-shell',root);
    if (notebookPresentationMode(shell)==='float') clampNotebookFloatingDock(root);
    else clearNotebookDockFloatGeometry(root);
    scheduleNotebookPresentationGeometry(root,{force:true});
    return result;
  };
}

/* Width/presentation controls change CSS classes immediately but do not emit window.resize. */
document.addEventListener('click',event=>{
  if (!event.target?.closest?.('#notebookDock [data-notebook-width],#notebookDock .notebook-position-control')) return;
  scheduleNotebookPresentationGeometry($('#notebookDock'),{force:true});
},true);

window.addEventListener('resize',()=>{
  clampNotebookFloatingDock($('#notebookDock'));
  scheduleNotebookPresentationGeometry($('#notebookDock'),{force:true});
},{passive:true});
document.addEventListener('fullscreenchange',()=>scheduleNotebookPresentationGeometry($('#notebookDock'),{force:true}));

/* Reattach the ResizeObserver whenever the active Binder page is rerendered. */
const _presentationGeometryRenderNotebookSurface=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _presentationGeometryRenderNotebookSurface(root);
  if (!root) return;
  observeNotebookPresentationPage(root);
  scheduleNotebookPresentationGeometry(root,{force:true});
};

clearNotebookDockFloatGeometry($('#notebookDock'));
observeNotebookPresentationPage($('#notebookDock'));
scheduleNotebookPresentationGeometry($('#notebookDock'),{force:true});
