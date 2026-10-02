/* Presentation geometry stabilization for the clean single-page Binder.
   Presentation mode changes resize the paper without necessarily resizing the browser.
   Keep tabs, hidden paper layers, Medium toolbar, and Grid extent locked to the live sheet rect. */

let notebookPresentationGeometryRaf=0;
let notebookPresentationGeometryTimer=0;
let notebookPresentationPageObserver=null;
let notebookPresentationObservedPage=null;
let notebookPresentationLastWidth=0;
let notebookPresentationLastLeft=0;

function notebookPresentationMode(shell) {
  if (!shell) return 'full';
  if (shell.classList.contains('notebook-width-medium')) return 'medium';
  if (shell.classList.contains('notebook-width-full')) return 'full';
  return state.settings?.notebookWidthMode || 'full';
}

function syncNotebookPresentationGeometry(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  const page=$('.notebook-page',shell);
  if (!shell || !page) return;

  const shellRect=shell.getBoundingClientRect();
  const pageRect=page.getBoundingClientRect();
  if (!pageRect.width || !pageRect.height) return;

  const width=Math.round(pageRect.width);
  const left=Math.round(pageRect.left-shellRect.left);
  notebookPresentationLastWidth=width;
  notebookPresentationLastLeft=left;

  /* Browser-style tabs follow the actual paper, not the viewport or their previous measurement. */
  const tabs=$('.notebook-binder-tabs-clean',shell);
  if (tabs) {
    tabs.style.width=`${width}px`;
    tabs.style.marginLeft=`${Math.max(0,left)}px`;
    tabs.style.marginRight='0';
  }

  /* Medium presentation keeps its notebook toolbar visually married to the centered sheet. */
  const toolbar=$('.notebook-toolbar',shell);
  if (toolbar) {
    if (notebookPresentationMode(shell)==='medium') {
      toolbar.style.width=`${width}px`;
      toolbar.style.maxWidth=`${width}px`;
      toolbar.style.marginLeft=`${Math.max(0,left)}px`;
      toolbar.style.marginRight='0';
    } else {
      toolbar.style.removeProperty('width');
      toolbar.style.removeProperty('max-width');
      toolbar.style.removeProperty('margin-left');
      toolbar.style.removeProperty('margin-right');
    }
  }

  /* Hidden sheets contain pixel geometry by design. Throw away stale Full/Medium dimensions and
     rebuild from the paper we can actually see right now. */
  $('.notebook-binder-layers-clean',shell)?.remove();
  singleBinderInstallLayers?.(root);
  singleBinderGridExtent?.(root);
}

function scheduleNotebookPresentationGeometry(root=$('#notebookDock')) {
  cancelAnimationFrame(notebookPresentationGeometryRaf);
  clearTimeout(notebookPresentationGeometryTimer);
  notebookPresentationGeometryRaf=requestAnimationFrame(()=>{
    notebookPresentationGeometryRaf=requestAnimationFrame(()=>syncNotebookPresentationGeometry(root));
  });
  /* A second pass catches CSS width transitions / late layout work without leaving stale layers. */
  notebookPresentationGeometryTimer=setTimeout(()=>syncNotebookPresentationGeometry(root),180);
}

function observeNotebookPresentationPage(root=$('#notebookDock')) {
  const page=$('.notebook-page',root);
  if (!page || typeof ResizeObserver==='undefined') return;
  if (page===notebookPresentationObservedPage) return;

  notebookPresentationPageObserver?.disconnect();
  notebookPresentationObservedPage=page;
  notebookPresentationLastWidth=0;
  notebookPresentationLastLeft=0;
  notebookPresentationPageObserver=new ResizeObserver(entries=>{
    const entry=entries[entries.length-1];
    const rect=entry?.target?.getBoundingClientRect?.();
    if (!rect) return;
    const width=Math.round(rect.width);
    const shell=entry.target.closest('.notebook-shell');
    const shellRect=shell?.getBoundingClientRect?.();
    const left=shellRect ? Math.round(rect.left-shellRect.left) : 0;
    if (width===notebookPresentationLastWidth && left===notebookPresentationLastLeft) return;
    scheduleNotebookPresentationGeometry(root);
  });
  notebookPresentationPageObserver.observe(page);
}

/* Width/presentation controls change CSS classes immediately but do not emit window.resize. */
document.addEventListener('click',event=>{
  if (!event.target?.closest?.('#notebookDock [data-notebook-width],#notebookDock .notebook-position-control')) return;
  scheduleNotebookPresentationGeometry($('#notebookDock'));
},true);

window.addEventListener('resize',()=>scheduleNotebookPresentationGeometry($('#notebookDock')),{passive:true});
document.addEventListener('fullscreenchange',()=>scheduleNotebookPresentationGeometry($('#notebookDock')));

/* Reattach the ResizeObserver whenever the active Binder page is rerendered. */
const _presentationGeometryRenderNotebookSurface=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _presentationGeometryRenderNotebookSurface(root);
  if (!root) return;
  observeNotebookPresentationPage(root);
  scheduleNotebookPresentationGeometry(root);
};

observeNotebookPresentationPage($('#notebookDock'));
scheduleNotebookPresentationGeometry($('#notebookDock'));
