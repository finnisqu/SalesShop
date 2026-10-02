/* Binder fluidity QC.
   - "Reference" is now simply another open Binder page.
   - Open pages stay visible as tabs even when only one sheet is on the desk.
   - Single-sheet Binder gets subtle paper layers behind the live page.
   - Favorite tabs are distinct and tab labels prefer page titles, then compact dates.
   - Grid pointer/focus interactions preserve the user's horizontal viewport.
   - Grid ruling expands with the elastic spatial canvas. */

function binderFluidTabTitle(ref) {
  if (!ref?.key || !ref?.pageId) return 'Page';
  const header=typeof notebookPageHeader==='function' ? String(notebookPageHeader(ref.key,ref.pageId)||'').trim() : '';
  if (header) return header;
  try { return fmtDate(ref.key,{month:'short',day:'numeric'}); } catch { return ref.key; }
}

/* Favorite pages keep their own title but receive a persistent tab treatment. */
if (typeof notebookBinderRailTab==='function' && !window.__salesShopBinderFluidTabLabels) {
  window.__salesShopBinderFluidTabLabels=true;
  const _fluidBinderRailTab=notebookBinderRailTab;
  notebookBinderRailTab=function(ref,index,side,spread,active) {
    const button=_fluidBinderRailTab(ref,index,side,spread,active);
    if (!button) return button;
    const label=binderFluidTabTitle(ref);
    const title=$('.notebook-binder-side-tab-label',button);
    if (title) title.textContent=label;
    const favorite=!!notebookPageFavorite?.(ref.key,ref.pageId);
    button.classList.toggle('favorite-page-tab',favorite);
    button.title=`${label} — open on ${side}`;
    button.setAttribute('aria-label',button.title);
    return button;
  };
}

function binderFluidRemoveWorkingBadge(root=$('#notebookDock')) {
  if (!root) return;
  $$('.notebook-paper-head span,.notebook-paper-head div,.notebook-reference-head span,.notebook-reference-head div',root).forEach(node=>{
    if (node.childElementCount) return;
    const text=String(node.textContent||'').trim();
    if (/^current\s*[·•-]?\s*worked\s+today$/i.test(text) || /^current\s*[·•-]?\s*worked/i.test(text)) node.remove();
  });
}

function binderFluidRewordHistoryOpen(root=$('#modalRoot')) {
  if (!root) return;
  $$('[data-history-reference-page]',root).forEach(button=>{
    const key=button.dataset.historyReferenceDate || button.dataset.historyCalendarOpenDate || '';
    const pageId=button.dataset.historyReferencePage || button.dataset.historyCalendarOpenPage || '';
    button.textContent='Open';
    button.disabled=false;
    button.title='Open this page in the Binder';
    button.setAttribute('aria-label',button.title);
    button.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      if (key && pageId && typeof openNotebookPageInBinder==='function') openNotebookPageInBinder(key,pageId);
      else if (key && pageId && typeof setNotebookReferencePage==='function') setNotebookReferencePage(key,pageId);
    };
  });

  /* Remove obsolete Reference wording from any residual history action labels/tooltips. */
  $$('button,[title],[aria-label]',root).forEach(node=>{
    const text=String(node.textContent||'').trim();
    if (/^(reference|referenced)$/i.test(text) && !node.matches('[data-history-calendar-page-open]')) node.textContent='Open';
    if (node.title && /reference/i.test(node.title)) node.title=node.title.replace(/Reference/gi,'page').replace(/reference/gi,'page');
    const aria=node.getAttribute?.('aria-label');
    if (aria && /reference/i.test(aria)) node.setAttribute('aria-label',aria.replace(/Reference/gi,'page').replace(/reference/gi,'page'));
  });
}

if (typeof bindNotebookHistoryCalendar==='function' && !window.__salesShopBinderFluidHistoryLabels) {
  window.__salesShopBinderFluidHistoryLabels=true;
  const _fluidHistoryBind=bindNotebookHistoryCalendar;
  bindNotebookHistoryCalendar=function() {
    const result=_fluidHistoryBind();
    binderFluidRewordHistoryOpen($('#modalRoot'));
    return result;
  };
}

function binderFluidPaperColorValue(color) {
  const dark=document.documentElement.dataset.theme==='dark';
  if (color==='blue') return dark?'#222b30':'#f1f8fb';
  if (color==='neutral') return dark?'#25282a':'#f7f7f3';
  return dark?'#29271f':'#fff9df';
}

function binderFluidBuildPaperLayers(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  $('.notebook-binder-paper-layers',shell)?.remove();
  const pages=notebookBinderOpenPages?.() || [];
  const spread=notebookBinderSpread?.() || [];
  if (pages.length<=1 || spread.length!==1) return;
  const page=$('.notebook-page',shell);
  if (!page) return;
  const hidden=pages.filter(ref=>!spread.includes(ref.id)).slice(0,3);
  if (!hidden.length) return;

  const shellRect=shell.getBoundingClientRect();
  const rect=page.getBoundingClientRect();
  const layers=document.createElement('div');
  layers.className='notebook-binder-paper-layers';
  layers.setAttribute('aria-hidden','true');
  hidden.slice().reverse().forEach((ref,reverseIndex)=>{
    const originalIndex=hidden.length-reverseIndex;
    const layer=document.createElement('i');
    layer.className='notebook-binder-paper-layer';
    const color=notebookPagePaperColorFinal?.(ref.key,ref.pageId) || 'warm';
    layer.dataset.paperColor=color;
    layer.style.setProperty('--layer-paper',binderFluidPaperColorValue(color));
    layer.style.left=`${Math.round(rect.left-shellRect.left-originalIndex*4)}px`;
    layer.style.top=`${Math.round(rect.top-shellRect.top+originalIndex*3)}px`;
    layer.style.width=`${Math.round(rect.width)}px`;
    layer.style.height=`${Math.round(rect.height)}px`;
    layers.appendChild(layer);
  });
  shell.appendChild(layers);
}

/* Keep all open-page tabs present after every final Binder render, including one-visible-sheet mode. */
function binderFluidRefreshTabs(root=$('#notebookDock')) {
  if (!root) return;
  const pages=notebookBinderOpenPages?.() || [];
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  shell.dataset.binderOpenCount=String(pages.length);
  if (pages.length>1) {
    installNotebookBinderDualRails?.(root);
    requestAnimationFrame(()=>positionNotebookBinderRails?.(root));
  }
  binderFluidBuildPaperLayers(root);
}

/* A pointer click in Grid should not cause the scroll container to auto-center the focused square. */
let binderFluidGridPointerScroll=null;
function binderFluidRestoreGridPointerScroll() {
  const state=binderFluidGridPointerScroll;
  if (!state || performance.now()-state.at>260) return;
  if (!state.page?.isConnected) return;
  state.page.scrollLeft=state.left;
}
document.addEventListener('pointerdown',event=>{
  const target=event.target?.closest?.('#notebookDock .notebook-page.paper-grid .grid-notebook-canvas,#notebookDock .notebook-page.paper-grid .spatial-object-table,#notebookDock .notebook-page.paper-grid .grid-note');
  const page=target?.closest?.('.notebook-page.paper-grid');
  if (!target || !page || event.button!==0) return;
  binderFluidGridPointerScroll={page,left:page.scrollLeft,at:performance.now()};
  requestAnimationFrame(binderFluidRestoreGridPointerScroll);
  setTimeout(binderFluidRestoreGridPointerScroll,0);
},true);
document.addEventListener('focusin',event=>{
  if (!binderFluidGridPointerScroll || performance.now()-binderFluidGridPointerScroll.at>260) return;
  if (!event.target?.closest?.('#notebookDock .notebook-page.paper-grid')) return;
  requestAnimationFrame(binderFluidRestoreGridPointerScroll);
},true);
document.addEventListener('pointerup',()=>{
  requestAnimationFrame(()=>{
    binderFluidRestoreGridPointerScroll();
    binderFluidSyncGridExtent($('#notebookDock'));
  });
},true);

function binderFluidSyncGridExtent(root=$('#notebookDock')) {
  if (!root) return;
  $$('.notebook-page.paper-grid',root).forEach(page=>{
    const body=$('.notebook-page-body',page);
    const canvas=$('.grid-notebook-canvas',page);
    if (!body || !canvas) return;
    let right=Math.max(canvas.scrollWidth,canvas.offsetWidth,page.clientWidth);
    let bottom=Math.max(canvas.scrollHeight,canvas.offsetHeight,page.clientHeight);
    const canvasRect=canvas.getBoundingClientRect();
    $$('.grid-note,.grid-editor-wrap,.notebook-spatial-object,.spatial-object-table',canvas).forEach(node=>{
      const rect=node.getBoundingClientRect();
      right=Math.max(right,rect.right-canvasRect.left+56);
      bottom=Math.max(bottom,rect.bottom-canvasRect.top+56);
    });
    const width=Math.ceil(Math.max(page.clientWidth,right));
    const height=Math.ceil(Math.max(page.clientHeight,bottom));
    canvas.style.minWidth=`${width}px`;
    body.style.minWidth=`${width}px`;
    body.style.minHeight=`${height}px`;
  });
}

function binderFluidPolish(root=$('#notebookDock')) {
  if (!root) return;
  binderFluidRemoveWorkingBadge(root);
  binderFluidRefreshTabs(root);
  binderFluidSyncGridExtent(root);
  binderFluidRewordHistoryOpen($('#modalRoot'));
}

const _binderFluidRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _binderFluidRenderNotebook(root);
  if (!root) return;
  binderFluidPolish(root);
  requestAnimationFrame(()=>binderFluidPolish(root));
};

if (!window.__salesShopBinderFluidResize) {
  window.__salesShopBinderFluidResize=true;
  let raf=0;
  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>binderFluidPolish($('#notebookDock')));
  };
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('fullscreenchange',schedule);
}

requestAnimationFrame(()=>binderFluidPolish($('#notebookDock')));
