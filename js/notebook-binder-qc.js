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

/* ---- Persistent page paper colors ---------------------------------------
   Paper color is page metadata. It never follows Current/Reference, active/facing, or left/right.
   New pages inherit a configurable default once, then keep that color until explicitly changed. */
function notebookDefaultPagePaperColor() {
  state.settings ||= {};
  const value=state.settings.notebookDefaultPagePaperColor;
  return (typeof NOTEBOOK_PAGE_PAPER_COLORS!=='undefined' && NOTEBOOK_PAGE_PAPER_COLORS.has(value)) ? value : 'warm';
}

function notebookPageColorStorageKey(key,pageId) {
  return typeof notebookPageMetadataKey==='function' ? notebookPageMetadataKey(key,pageId) : `${key}::${pageId}`;
}

/* Ignore role-specific fallback arguments from older layers. An uncolored page receives the one
   configured default and stores it on the page identity immediately. */
notebookPagePaperColorFinal=function(key,pageId) {
  if (!key || !pageId) return notebookDefaultPagePaperColor();
  const map=notebookPagePaperColorMapFinal();
  const storageKey=notebookPageColorStorageKey(key,pageId);
  const existing=map[storageKey];
  if (NOTEBOOK_PAGE_PAPER_COLORS.has(existing)) return existing;
  const color=notebookDefaultPagePaperColor();
  map[storageKey]=color;
  return color;
};

ensureNotebookPagePaperColorFinal=function(key,pageId) {
  if (!key || !pageId) return {color:notebookDefaultPagePaperColor(),changed:false};
  const map=notebookPagePaperColorMapFinal();
  const storageKey=notebookPageColorStorageKey(key,pageId);
  if (NOTEBOOK_PAGE_PAPER_COLORS.has(map[storageKey])) return {color:map[storageKey],changed:false};
  const color=notebookDefaultPagePaperColor();
  map[storageKey]=color;
  return {color,changed:true};
};

/* Binder tabs and physical-paper compatibility helpers also read page metadata only. */
notebookPeerPageColor=function(ref) {
  return ref?.key && ref?.pageId ? notebookPagePaperColorFinal(ref.key,ref.pageId) : notebookDefaultPagePaperColor();
};
notebookPaperRoleColorFinal=function(role) {
  if (role==='reference') {
    const ref=typeof notebookReferencePageState==='function' ? notebookReferencePageState() : state.settings?.notebookReferencePage;
    return ref?.key && ref?.pageId ? notebookPagePaperColorFinal(ref.key,ref.pageId) : notebookDefaultPagePaperColor();
  }
  return notebookPagePaperColorFinal(currentNotebookDate,currentNotebookPageId);
};

function notebookKnownPageRefsForColor() {
  const refs=[];
  const seen=new Set();
  const add=(key,pageId)=>{
    if (!key || !pageId) return;
    const id=`${key}::${pageId}`;
    if (seen.has(id)) return;
    seen.add(id);
    refs.push({key,pageId,id});
  };

  try {
    ensureNotebookPageOrderRegistry?.({persist:false});
    const orderMap=notebookPageOrderMap?.() || {};
    Object.keys(orderMap).forEach(key=>(notebookPageOrderForDate?.(key)||[]).forEach(pageId=>add(key,pageId)));
  } catch {}

  Object.entries(state.notebook||{}).forEach(([key,entries])=>{
    (entries||[]).forEach(entry=>add(key,entry?.pageId));
  });
  add(currentNotebookDate,currentNotebookPageId);
  (state.settings?.notebookBinderOpenPages||[]).forEach(ref=>add(ref?.key,ref?.pageId));
  add(state.settings?.notebookReferencePage?.key,state.settings?.notebookReferencePage?.pageId);
  return refs;
}

function stampNotebookPageColorsOnce() {
  let changed=false;
  notebookKnownPageRefsForColor().forEach(ref=>{
    const result=ensureNotebookPagePaperColorFinal(ref.key,ref.pageId);
    changed ||= !!result?.changed;
  });
  if (changed) save();
}

function setNotebookDefaultPagePaperColor(color) {
  if (!NOTEBOOK_PAGE_PAPER_COLORS.has(color)) return;
  state.settings ||= {};
  state.settings.notebookDefaultPagePaperColor=color;
  save();
  renderAll();
}

function notebookDefaultPaperColorGroup() {
  const active=notebookDefaultPagePaperColor();
  const group=document.createElement('div');
  group.className='notebook-style-group notebook-default-paper-color-group';
  group.dataset.defaultPaperColorGroup='';
  group.innerHTML=`
    <div class="notebook-style-group-label">New pages</div>
    <div class="notebook-style-choice-row">
      <button type="button" class="notebook-style-choice page-paper-choice ${active==='warm'?'active':''}" data-default-page-paper-color="warm" title="New pages use warm paper" aria-label="New pages use warm paper"><span class="page-paper-swatch swatch-warm"></span></button>
      <button type="button" class="notebook-style-choice page-paper-choice ${active==='blue'?'active':''}" data-default-page-paper-color="blue" title="New pages use light blue paper" aria-label="New pages use light blue paper"><span class="page-paper-swatch swatch-blue"></span></button>
      <button type="button" class="notebook-style-choice page-paper-choice ${active==='neutral'?'active':''}" data-default-page-paper-color="neutral" title="New pages use neutral paper" aria-label="New pages use neutral paper"><span class="page-paper-swatch swatch-neutral"></span></button>
    </div>`;
  $$('[data-default-page-paper-color]',group).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    setNotebookDefaultPagePaperColor(button.dataset.defaultPagePaperColor);
  });
  return group;
}

/* Existing Style choices continue to modify the actual page. A separate New pages row changes only
   the default used by pages created in the future; it never recolors already-stamped pages. */
if (typeof installNotebookPaperColorStyleFinal==='function') {
  const _persistentColorInstallStyle=installNotebookPaperColorStyleFinal;
  installNotebookPaperColorStyleFinal=function(root=$('#notebookDock')) {
    _persistentColorInstallStyle(root);
    const menu=$('[data-notebook-view-menu]',root);
    if (!menu) return;
    $('[data-default-paper-color-group]',menu)?.remove();
    menu.appendChild(notebookDefaultPaperColorGroup());
  };
}

/* Stamp a fresh page immediately so its first Binder position cannot influence its color. */
if (typeof startFreshNotebookPage==='function' && !window.__salesShopPersistentNewPageColor) {
  window.__salesShopPersistentNewPageColor=true;
  const _persistentColorFreshPage=startFreshNotebookPage;
  startFreshNotebookPage=function(root) {
    const result=_persistentColorFreshPage(root);
    const stamped=ensureNotebookPagePaperColorFinal(currentNotebookDate,currentNotebookPageId);
    if (stamped?.changed) {
      save();
      renderAll();
    }
    return result;
  };
}

const _persistentColorRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  stampNotebookPageColorsOnce();
  _persistentColorRenderNotebook(root);
  if (!root) return;

  /* Reapply after every legacy/peer/Binder layer has finished. */
  applyOpenNotebookPaperColorsFinal?.(root);
  installNotebookPaperColorStyleFinal?.(root);
  $$('.notebook-binder-tab[data-binder-page]',root).forEach(tab=>{
    const ref=notebookBinderPageById?.(tab.dataset.binderPage);
    if (ref) tab.dataset.paperColor=notebookPagePaperColorFinal(ref.key,ref.pageId);
  });
};

stampNotebookPageColorsOnce();
