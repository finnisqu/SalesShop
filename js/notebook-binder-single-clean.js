/* Clean single-page Binder final layer.
   Goal: Binder owns which pages are open; presentation owns only paper width/position.
   This layer deliberately retires the legacy Reference/peer/spread renderer until Double is rebuilt.
   - up to 6 open pages persist as a draggable top tab row
   - exactly one real notebook page is visible/interactive
   - hidden open pages remain visible as tabs + physical paper layers
   - opening/closing/switching never mutates unrelated open pages
   - Notebook top-tab navigation returns to this exact working Binder state
   - no Swap, Reference, Single/Double, facing-page, side-rail, or spread controls
*/

const NOTEBOOK_SINGLE_BINDER_MAX = 6;

function singleBinderId(ref) {
  return ref?.key && ref?.pageId ? `${ref.key}::${ref.pageId}` : '';
}
function singleBinderRef(ref) {
  if (!ref?.key || !ref?.pageId) return null;
  return {key:ref.key,pageId:ref.pageId,id:singleBinderId(ref)};
}
function singleBinderRefFromId(id) {
  const text=String(id||'');
  const at=text.indexOf('::');
  if (at<0) return null;
  return singleBinderRef({key:text.slice(0,at),pageId:text.slice(at+2)});
}
function singleBinderCurrentRef() {
  return singleBinderRef({key:currentNotebookDate,pageId:currentNotebookPageId});
}
function singleBinderPageColor(ref) {
  if (!ref) return 'warm';
  if (typeof ensureNotebookPagePaperColorFinal==='function') {
    const fallback=typeof notebookDefaultPagePaperColor==='function' ? notebookDefaultPagePaperColor() : 'warm';
    const ensured=ensureNotebookPagePaperColorFinal(ref.key,ref.pageId,fallback);
    if (ensured?.changed) save();
  }
  return typeof notebookPagePaperColorFinal==='function'
    ? notebookPagePaperColorFinal(ref.key,ref.pageId,'warm')
    : 'warm';
}
function singleBinderPaperCss(color) {
  const dark=document.documentElement.dataset.theme==='dark';
  if (color==='blue') return dark?'#222b30':'#f1f8fb';
  if (color==='neutral') return dark?'#25282a':'#f7f7f3';
  return dark?'#29271f':'#fff9df';
}

function singleBinderOpenPages({persist=false}={}) {
  state.settings ||= {};
  const current=singleBinderCurrentRef();
  let raw=Array.isArray(state.settings.notebookBinderOpenPages)
    ? state.settings.notebookBinderOpenPages
    : [];
  let pages=raw.map(singleBinderRef).filter(Boolean);

  /* One-time migration from the previous spread/reference model. After a real Binder roster exists,
     legacy pointers are never consulted again, so closed pages cannot resurrect. */
  if (!pages.length) {
    const oldOrder=Array.isArray(state.settings.notebookOpenPageOrder) ? state.settings.notebookOpenPageOrder : [];
    pages=oldOrder.map(item=>typeof item==='string'?singleBinderRefFromId(item):singleBinderRef(item)).filter(Boolean);
    const legacy=singleBinderRef(state.settings.notebookReferencePage);
    if (legacy && !pages.some(page=>page.id===legacy.id)) pages.push(legacy);
  }
  if (current && !pages.some(page=>page.id===current.id)) pages.unshift(current);

  const seen=new Set();
  pages=pages.filter(page=>page?.id && !seen.has(page.id) && seen.add(page.id)).slice(0,NOTEBOOK_SINGLE_BINDER_MAX);
  if (!pages.length && current) pages=[current];
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  if (persist) save();
  return pages;
}

function singleBinderNormalizeLegacyState({persist=false}={}) {
  state.settings ||= {};
  const pages=singleBinderOpenPages();
  const active=singleBinderCurrentRef() || pages[0] || null;
  delete state.settings.notebookReferencePage;
  delete state.settings.notebookPaperFront;
  delete state.settings.notebookPaperLayout;
  state.settings.notebookBinderDisplayMode='single';
  state.settings.notebookBinderActiveSide='left';
  state.settings.notebookBinderSpread=active?[active.id]:[];
  state.settings.notebookOpenPageOrder=pages.map(page=>page.id);
  if (persist) save();
  return {pages,active};
}

/* Replace generalized Binder globals with the simple one-page invariant. */
notebookBinderOpenPages=function(){ return singleBinderOpenPages(); };
notebookBinderActiveRef=function(){ return singleBinderCurrentRef(); };
notebookBinderPageById=function(id){ return singleBinderOpenPages().find(page=>page.id===id)||null; };
notebookBinderSpread=function(){ const active=singleBinderCurrentRef(); return active?[active.id]:[]; };
notebookBinderFacingRef=function(){ return null; };
notebookBinderDisplayMode=function(){ return 'single'; };
syncNotebookBinderLegacyState=function({persist=false}={}){ return singleBinderNormalizeLegacyState({persist}); };
setNotebookBinderDisplayMode=function(){ singleBinderNormalizeLegacyState({persist:true}); };
swapNotebookBinderSpread=function(){};
swapNotebookPeerLocations=function(){};
swapNotebookReferencePage=function(){};
clearNotebookReferencePage=function(){};
installNotebookBinderDualRails=function(root=$('#notebookDock')) {
  if (!root) return;
  $$('.notebook-binder-side-rail,.notebook-binder-tabs,.notebook-binder-tabs-final',root).forEach(node=>node.remove());
};
installNotebookBinderTabsFinal=function(){};

function singleBinderActivate(ref,{record=true}={}) {
  ref=singleBinderRef(ref);
  if (!ref) return;
  const pages=singleBinderOpenPages();
  if (!pages.some(page=>page.id===ref.id)) return;
  const active=singleBinderCurrentRef();
  if (active?.id===ref.id) return;

  notebookPageState()[ref.key]=ref.pageId;
  if (typeof setNotebookWorkingPage==='function') setNotebookWorkingPage(ref.key,ref.pageId,{record,kind:'binder-tab'});
  currentNotebookDate=ref.key;
  currentNotebookPageId=ref.pageId;
  singleBinderNormalizeLegacyState();
  save();
  renderAll();
}
binderSetActivePage=function(ref,{record=true}={}){ singleBinderActivate(ref,{record}); };
activateNotebookPeerPage=function(ref,{record=true}={}){ singleBinderActivate(ref,{record}); };
notebookBinderOpenPageOnSide=function(ref,side,{record=true}={}){ singleBinderActivate(ref,{record}); };

openNotebookPageInBinder=function(key,pageId) {
  const ref=singleBinderRef({key,pageId});
  if (!ref) return;
  let pages=singleBinderOpenPages();
  const existing=pages.find(page=>page.id===ref.id);
  if (!existing) {
    if (pages.length>=NOTEBOOK_SINGLE_BINDER_MAX) return toast?.(`Binder can hold up to ${NOTEBOOK_SINGLE_BINDER_MAX} open pages.`);
    pages.push(ref);
    state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  }
  closeModal?.();
  if (singleBinderCurrentRef()?.id===ref.id) {
    singleBinderNormalizeLegacyState({persist:true});
    renderAll();
    return;
  }
  singleBinderActivate(ref,{record:true});
};
setNotebookReferencePage=function(key,pageId){ openNotebookPageInBinder(key,pageId); };

function closeNotebookBinderPage(ref) {
  ref=singleBinderRef(ref);
  if (!ref) return;
  let pages=singleBinderOpenPages();
  if (pages.length<=1 || !pages.some(page=>page.id===ref.id)) return;
  const active=singleBinderCurrentRef();
  const index=pages.findIndex(page=>page.id===ref.id);
  pages=pages.filter(page=>page.id!==ref.id);
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));

  if (active?.id===ref.id) {
    const next=pages[Math.min(index,pages.length-1)] || pages[index-1] || pages[0];
    notebookPageState()[next.key]=next.pageId;
    if (typeof setNotebookWorkingPage==='function') setNotebookWorkingPage(next.key,next.pageId,{record:true,kind:'binder-close'});
    currentNotebookDate=next.key;
    currentNotebookPageId=next.pageId;
  }
  singleBinderNormalizeLegacyState({persist:true});
  renderAll();
}
closeNotebookPeerPage=closeNotebookBinderPage;

function singleBinderHeader(ref) {
  if (!ref) return '';
  const header=typeof notebookPageHeader==='function' ? String(notebookPageHeader(ref.key,ref.pageId)||'').trim() : '';
  return header;
}
function singleBinderDateLabel(ref) {
  try { return fmtDate(ref.key,{month:'short',day:'numeric'}); } catch { return ref.key; }
}
function singleBinderTabLabels(pages) {
  const dateCounts=new Map();
  pages.forEach(page=>{
    if (!singleBinderHeader(page)) dateCounts.set(page.key,(dateCounts.get(page.key)||0)+1);
  });
  const dateSeen=new Map();
  const map=new Map();
  pages.forEach(page=>{
    const header=singleBinderHeader(page);
    if (header) { map.set(page.id,header);return; }
    const compact=singleBinderDateLabel(page);
    if ((dateCounts.get(page.key)||0)<=1) { map.set(page.id,compact);return; }
    const n=(dateSeen.get(page.key)||0)+1;
    dateSeen.set(page.key,n);
    map.set(page.id,`${compact} · ${n}`);
  });
  return map;
}

function singleBinderReorder(sourceId,targetId) {
  if (!sourceId || !targetId || sourceId===targetId) return;
  const pages=singleBinderOpenPages();
  const from=pages.findIndex(page=>page.id===sourceId);
  const to=pages.findIndex(page=>page.id===targetId);
  if (from<0 || to<0) return;
  const [moved]=pages.splice(from,1);
  pages.splice(to,0,moved);
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  state.settings.notebookOpenPageOrder=pages.map(page=>page.id);
  save();
  renderAll();
}

function singleBinderInstallTabs(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  $$('.notebook-binder-top-tabs,.notebook-binder-tabs-clean,.notebook-binder-side-rail,.notebook-binder-tabs,.notebook-binder-tabs-final',shell).forEach(node=>node.remove());
  const pages=singleBinderOpenPages();
  shell.dataset.binderOpenCount=String(pages.length);
  if (pages.length<=1) return;

  const active=singleBinderCurrentRef();
  const labels=singleBinderTabLabels(pages);
  const tabs=document.createElement('nav');
  tabs.className='notebook-binder-tabs-clean';
  tabs.setAttribute('aria-label','Open notebook pages');

  pages.forEach(ref=>{
    const button=document.createElement('button');
    button.type='button';
    button.draggable=true;
    button.className=`notebook-binder-tab-clean${active?.id===ref.id?' active':''}${notebookPageFavorite?.(ref.key,ref.pageId)?' favorite':''}`;
    button.dataset.binderPage=ref.id;
    button.dataset.paperColor=singleBinderPageColor(ref);
    const label=labels.get(ref.id)||singleBinderDateLabel(ref);
    button.title=active?.id===ref.id ? `${label} · open` : `Open ${label}`;
    button.innerHTML=`<span>${escapeHtml(label)}</span>`;
    button.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      if (active?.id!==ref.id) singleBinderActivate(ref,{record:true});
    };
    button.addEventListener('dragstart',event=>{
      button.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain',ref.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed='move';
    });
    button.addEventListener('dragend',()=>button.classList.remove('is-dragging'));
    button.addEventListener('dragover',event=>{
      event.preventDefault();
      button.classList.add('drag-over');
      if (event.dataTransfer) event.dataTransfer.dropEffect='move';
    });
    button.addEventListener('dragleave',()=>button.classList.remove('drag-over'));
    button.addEventListener('drop',event=>{
      event.preventDefault();
      button.classList.remove('drag-over');
      singleBinderReorder(event.dataTransfer?.getData('text/plain'),ref.id);
    });
    tabs.appendChild(button);
  });

  const toolbar=$('.notebook-toolbar',shell);
  if (toolbar) toolbar.insertAdjacentElement('afterend',tabs);
  else shell.prepend(tabs);
  requestAnimationFrame(()=>singleBinderAlignTabs(root));
}

function singleBinderAlignTabs(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  const tabs=$('.notebook-binder-tabs-clean',shell);
  const page=$('.notebook-page',shell);
  if (!shell || !tabs || !page) return;
  const shellRect=shell.getBoundingClientRect();
  const rect=page.getBoundingClientRect();
  if (!rect.width) return;
  tabs.style.width=`${Math.round(rect.width)}px`;
  tabs.style.marginLeft=`${Math.max(0,Math.round(rect.left-shellRect.left))}px`;
}

function singleBinderInstallLayers(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  $('.notebook-binder-paper-layers',shell)?.remove();
  $('.notebook-binder-page-layers',shell)?.remove();
  $('.notebook-binder-layers-clean',shell)?.remove();
  const pages=singleBinderOpenPages();
  const active=singleBinderCurrentRef();
  const hidden=pages.filter(page=>page.id!==active?.id).slice(0,5);
  const page=$('.notebook-page',shell);
  if (!page || !hidden.length) return;

  const shellRect=shell.getBoundingClientRect();
  const rect=page.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const labels=singleBinderTabLabels(pages);
  const layers=document.createElement('div');
  layers.className='notebook-binder-layers-clean';

  /* Render deepest first. The first hidden tab sits immediately under the live sheet. */
  hidden.slice().reverse().forEach((ref,reverseIndex)=>{
    const depth=hidden.length-reverseIndex;
    const layer=document.createElement('button');
    layer.type='button';
    layer.className='notebook-binder-layer-clean';
    layer.dataset.paperColor=singleBinderPageColor(ref);
    layer.style.setProperty('--layer-paper',singleBinderPaperCss(layer.dataset.paperColor));
    layer.style.left=`${Math.round(rect.left-shellRect.left-depth*5)}px`;
    layer.style.top=`${Math.round(rect.top-shellRect.top+depth*2)}px`;
    layer.style.width=`${Math.round(rect.width)}px`;
    layer.style.height=`${Math.round(rect.height)}px`;
    layer.style.zIndex=String(Math.max(1,7-depth));
    layer.title=`Open ${labels.get(ref.id)||singleBinderDateLabel(ref)}`;
    layer.setAttribute('aria-label',layer.title);
    layer.onclick=event=>{event.preventDefault();event.stopPropagation();singleBinderActivate(ref,{record:true});};
    layers.appendChild(layer);
  });
  shell.appendChild(layers);
}

function singleBinderStyleControl(ref) {
  const wrap=document.createElement('div');
  wrap.className='notebook-single-style-control';
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='notebook-single-page-action notebook-single-style-trigger';
  trigger.title='Page color';
  trigger.setAttribute('aria-label','Page color');
  trigger.innerHTML=typeof binderIconSvg==='function' ? binderIconSvg('style') : '◌';
  const menu=document.createElement('div');
  menu.className='notebook-single-style-menu';
  const active=singleBinderPageColor(ref);
  [['warm','Warm'],['blue','Blue'],['neutral','Neutral']].forEach(([color,label])=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=active===color?'active':'';
    button.dataset.color=color;
    button.innerHTML=`<i class="swatch-${color}"></i><span>${label}</span>`;
    button.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      setNotebookPagePaperColorFinal?.(ref.key,ref.pageId,color);
    };
    menu.appendChild(button);
  });
  trigger.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    wrap.classList.toggle('open');
  };
  wrap.append(trigger,menu);
  return wrap;
}

function singleBinderInstallPageActions(root=$('#notebookDock')) {
  const page=$('.notebook-page',root);
  const head=$('.notebook-paper-head',page);
  const active=singleBinderCurrentRef();
  if (!page || !head || !active) return;

  $$('.notebook-peer-local-actions,.notebook-binder-page-actions,.notebook-reference-actions,.notebook-split-page-actions',head).forEach(node=>node.remove());
  $$('[data-notebook-page-favorite],[data-notebook-page-lock]',root).forEach(node=>node.remove());
  $('.notebook-single-page-actions',head)?.remove();

  const actions=document.createElement('div');
  actions.className='notebook-single-page-actions';
  const favorite=document.createElement('button');
  favorite.type='button';
  const fav=!!notebookPageFavorite?.(active.key,active.pageId);
  favorite.className=`notebook-single-page-action${fav?' active':''}`;
  favorite.title=fav?'Remove from Favorites':'Favorite page';
  favorite.setAttribute('aria-label',favorite.title);
  favorite.innerHTML=typeof notebookMetaIcon==='function' ? notebookMetaIcon('favorite',fav) : '★';
  favorite.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    setNotebookPageFavorite?.(active.key,active.pageId,!fav);
    renderAll();
  };
  actions.append(favorite,singleBinderStyleControl(active));

  const pages=singleBinderOpenPages();
  if (pages.length>1) {
    const close=document.createElement('button');
    close.type='button';
    close.className='notebook-single-page-action notebook-single-close';
    close.title='Close page from Binder';
    close.setAttribute('aria-label',close.title);
    close.innerHTML=typeof binderIconSvg==='function' ? binderIconSvg('close') : '×';
    close.onclick=event=>{event.preventDefault();event.stopPropagation();closeNotebookBinderPage(active);};
    actions.appendChild(close);
  }
  head.appendChild(actions);

  $('.notebook-single-lock-marker',head)?.remove();
  if (notebookPageLocked?.(active.key,active.pageId)) {
    const lock=document.createElement('span');
    lock.className='notebook-single-lock-marker';
    lock.title='Locked page';
    lock.setAttribute('aria-label','Locked page');
    lock.innerHTML=typeof notebookMetaIcon==='function' ? notebookMetaIcon('lock',true) : '▣';
    $('.notebook-date',head)?.insertAdjacentElement('beforebegin',lock);
  }
}

function singleBinderRemoveLegacyChrome(root=$('#notebookDock')) {
  if (!root) return;
  $$([
    '.notebook-binder-side-rail','.notebook-binder-tabs','.notebook-binder-tabs-final',
    '.notebook-paper-active-tab','.notebook-paper-peek','.notebook-spread-toggle',
    '[data-notebook-spread-toggle]','.notebook-peer-swap','.notebook-reference-swap',
    '[data-notebook-swap]','[data-peer-swap]'
  ].join(','),root).forEach(node=>node.remove());
  const shell=$('.notebook-shell',root);
  const pair=$('.notebook-page-pair',shell);
  if (pair) {
    const live=$(':scope > .notebook-page',pair);
    if (live) pair.replaceWith(live);
    else pair.remove();
  }
  $$('.notebook-reference-page,.notebook-reference-scroller',root).forEach(node=>node.remove());
  const control=$('[data-notebook-width-controls]',root);
  if (control) {
    control.classList.remove('position-click-collapsed');
    control.style.removeProperty('width');
    control.style.removeProperty('max-width');
  }
}

function singleBinderRemoveWorkingBadge(root=$('#notebookDock')) {
  if (!root) return;
  $$('.notebook-working-page-badge',root).forEach(node=>node.remove());
  $$('.notebook-paper-head span,.notebook-paper-head div',root).forEach(node=>{
    if (node.childElementCount) return;
    if (/^current\s*[·•-]?\s*worked/i.test(String(node.textContent||'').trim())) node.remove();
  });
}

function singleBinderRewordHistoryOpen(root=$('#modalRoot')) {
  if (!root) return;
  $$('[data-history-reference-page]',root).forEach(button=>{
    const key=button.dataset.historyReferenceDate || button.dataset.historyCalendarOpenDate || '';
    const pageId=button.dataset.historyReferencePage || button.dataset.historyCalendarOpenPage || '';
    button.textContent='Open';
    button.disabled=false;
    button.title='Open this page in the Binder';
    button.setAttribute('aria-label',button.title);
    button.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      if (key&&pageId) openNotebookPageInBinder(key,pageId);
    };
  });
}

function singleBinderGridExtent(root=$('#notebookDock')) {
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

function singleBinderPolish(root=$('#notebookDock')) {
  if (!root) return;
  singleBinderNormalizeLegacyState();
  singleBinderRemoveLegacyChrome(root);
  applyOpenNotebookPaperColorsFinal?.(root);
  singleBinderRemoveWorkingBadge(root);
  singleBinderInstallTabs(root);
  singleBinderInstallLayers(root);
  singleBinderInstallPageActions(root);
  singleBinderGridExtent(root);
  singleBinderRewordHistoryOpen($('#modalRoot'));
}

/* Keep the main Notebook navigation pure: it should not reset the page identity to today. */
if (typeof showView==='function') {
  const _singleBinderShowView=showView;
  showView=function(name) {
    if (name!=='notebook') return _singleBinderShowView(name);
    let pages=singleBinderOpenPages();
    let active=singleBinderCurrentRef();
    if (!active || !pages.some(page=>page.id===active.id)) {
      const working=typeof notebookWorkingPageState==='function' ? singleBinderRef(notebookWorkingPageState()) : null;
      active=working && pages.some(page=>page.id===working.id) ? working : pages[0] || working;
      if (active) {
        currentNotebookDate=active.key;
        currentNotebookPageId=active.pageId;
      }
    }
    currentView='notebook';
    document.body.dataset.view='notebook';
    $('#workspaceBody')?.classList.add('notebook-focus');
    $$('.view').forEach(view=>view.classList.remove('active'));
    $$('.top-tab').forEach(button=>button.classList.toggle('active',button.dataset.view==='notebook'));
    singleBinderNormalizeLegacyState();
    renderAll();
    singleBinderNormalizeLegacyState({persist:true});
    requestAnimationFrame(()=>singleBinderPolish($('#notebookDock')));
  };
}

/* History calendar is rebuilt independently of the notebook surface. Keep Open wording attached. */
if (typeof bindNotebookHistoryCalendar==='function') {
  const _singleBinderHistoryBind=bindNotebookHistoryCalendar;
  bindNotebookHistoryCalendar=function() {
    const result=_singleBinderHistoryBind();
    singleBinderRewordHistoryOpen($('#modalRoot'));
    return result;
  };
}

/* Sheets-style Shift-click range: original anchor stays active, the entire rectangle gets one wash. */
function singleBinderSelectionContext(td) {
  const wrap=td?.closest?.('.spatial-object-table');
  const table=wrap?$('.spatial-table',wrap):null;
  const object=wrap?spatialObjectById?.(wrap.dataset.spatialObjectId):null;
  return wrap&&table&&object?{wrap,table,object}:null;
}
function singleBinderRangeCells(table,bounds) {
  return $$('td',table).filter(td=>{
    const r=Number(td.dataset.spatialRow)||0,c=Number(td.dataset.spatialCol)||0;
    return r>=bounds.r1&&r<=bounds.r2&&c>=bounds.c1&&c<=bounds.c2;
  });
}
function singleBinderPaintRange(table,object) {
  const wrap=table?.closest?.('.spatial-object-table');
  wrap?.querySelector('.spreadsheet-range-outline-clean')?.remove();
  $$('td',table||document).forEach(td=>td.classList.remove('spreadsheet-range-cell-clean','spreadsheet-anchor-cell-clean'));
  const selection=typeof activeSpatialTableSelection!=='undefined'?activeSpatialTableSelection:null;
  if (!selection || selection.objectId!==object?.id) return;
  const bounds=spatialSelectionBoundsForTable?.(selection);
  if (!bounds) return;
  const cells=singleBinderRangeCells(table,bounds);
  cells.forEach(td=>td.classList.add('spreadsheet-range-cell-clean'));
  const anchor=table.querySelector(`td[data-spatial-row="${selection.start.r}"][data-spatial-col="${selection.start.c}"]`);
  anchor?.classList.add('spreadsheet-anchor-cell-clean');
  if (!wrap || cells.length<2) return;
  const rects=cells.map(cell=>cell.getBoundingClientRect());
  const wr=wrap.getBoundingClientRect();
  const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top));
  const right=Math.max(...rects.map(r=>r.right)),bottom=Math.max(...rects.map(r=>r.bottom));
  const outline=document.createElement('div');
  outline.className='spreadsheet-range-outline-clean';
  outline.style.left=`${left-wr.left}px`;
  outline.style.top=`${top-wr.top}px`;
  outline.style.width=`${right-left}px`;
  outline.style.height=`${bottom-top}px`;
  wrap.appendChild(outline);
}
if (!window.__salesShopSingleBinderShiftRange) {
  window.__salesShopSingleBinderShiftRange=true;
  document.addEventListener('pointerdown',event=>{
    if (!event.shiftKey || event.button!==0) return;
    const td=event.target?.closest?.('.spatial-object-table td');
    if (!td || td.classList.contains('spreadsheet-cell-editing')) return;
    const ctx=singleBinderSelectionContext(td);
    const previous=typeof activeSpatialTableSelection!=='undefined'?activeSpatialTableSelection:null;
    if (!ctx || !previous || previous.objectId!==ctx.object.id) return;
    event.preventDefault();event.stopImmediatePropagation();
    window.getSelection()?.removeAllRanges();
    activeSpatialTableSelection={
      objectId:ctx.object.id,
      start:{...previous.start},
      end:{r:Number(td.dataset.spatialRow)||0,c:Number(td.dataset.spatialCol)||0}
    };
    selectedSpatialObjectId=ctx.object.id;
    ctx.wrap.classList.add('is-selected','format-open');
    paintSpatialTableSelection?.(ctx.table,ctx.object);
    requestAnimationFrame(()=>{
      singleBinderPaintRange(ctx.table,ctx.object);
      renderSpreadsheetFillHandle?.(ctx.wrap,ctx.object,ctx.table);
    });
  },true);
}
if (typeof paintSpatialTableSelection==='function' && !window.__salesShopSingleBinderRangePaint) {
  window.__salesShopSingleBinderRangePaint=true;
  const _singleBinderRangePaint=paintSpatialTableSelection;
  paintSpatialTableSelection=function(table,object) {
    const result=_singleBinderRangePaint(table,object);
    singleBinderPaintRange(table,object);
    return result;
  };
}

const _singleBinderRenderNotebookSurface=renderNotebookSurface;
renderNotebookSurface=function(root) {
  singleBinderNormalizeLegacyState();
  _singleBinderRenderNotebookSurface(root);
  if (!root) return;
  singleBinderPolish(root);
  $$('.spatial-object-table',root).forEach(wrap=>{
    const table=$('.spatial-table',wrap);
    const object=typeof spatialObjectById==='function'?spatialObjectById(wrap.dataset.spatialObjectId):null;
    if (table&&object) singleBinderPaintRange(table,object);
  });
  requestAnimationFrame(()=>singleBinderPolish(root));
};

if (!window.__salesShopSingleBinderResize) {
  window.__salesShopSingleBinderResize=true;
  let raf=0;
  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      singleBinderAlignTabs($('#notebookDock'));
      singleBinderInstallLayers($('#notebookDock'));
      singleBinderGridExtent($('#notebookDock'));
    });
  };
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('fullscreenchange',schedule);
}

singleBinderNormalizeLegacyState({persist:true});
requestAnimationFrame(()=>singleBinderPolish($('#notebookDock')));
