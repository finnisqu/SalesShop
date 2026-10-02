/* Persistent notebook page color identity.
   A page receives one paper color and keeps it regardless of active/facing renderer, Binder slot,
   Swap, or Current/Reference compatibility state. New pages inherit a configurable default once. */

function notebookDefaultPagePaperColor() {
  state.settings ||= {};
  const value=state.settings.notebookDefaultPagePaperColor;
  return (typeof NOTEBOOK_PAGE_PAPER_COLORS!=='undefined' && NOTEBOOK_PAGE_PAPER_COLORS.has(value)) ? value : 'warm';
}

function notebookPageColorStorageKey(key,pageId) {
  return typeof notebookPageMetadataKey==='function' ? notebookPageMetadataKey(key,pageId) : `${key}::${pageId}`;
}

/* No caller is allowed to choose a color from a transient role anymore. If the page has never had
   a color, assign the New Page Default to the page identity immediately. */
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

/* All page-color helpers, including Binder tabs, now read the page property only. */
if (typeof notebookPeerPageColor==='function') {
  notebookPeerPageColor=function(ref) {
    return ref?.key && ref?.pageId ? notebookPagePaperColorFinal(ref.key,ref.pageId) : notebookDefaultPagePaperColor();
  };
}
notebookPaperRoleColorFinal=function(role) {
  if (role==='reference') {
    const ref=typeof notebookReferencePageState==='function' ? notebookReferencePageState() : state.settings?.notebookReferencePage;
    return ref?.key && ref?.pageId ? notebookPagePaperColorFinal(ref.key,ref.pageId) : notebookDefaultPagePaperColor();
  }
  return notebookPagePaperColorFinal(currentNotebookDate,currentNotebookPageId);
};

function notebookKnownPageRefsForColor() {
  const refs=[];
  const add=(key,pageId)=>{
    if (!key || !pageId) return;
    const id=`${key}::${pageId}`;
    if (!refs.some(ref=>ref.id===id)) refs.push({key,pageId,id});
  };

  /* Page-order registry is authoritative where available. */
  try {
    ensureNotebookPageOrderRegistry?.({persist:false});
    const orderMap=notebookPageOrderMap?.() || {};
    Object.keys(orderMap).forEach(key=>(notebookPageOrderForDate?.(key)||[]).forEach(pageId=>add(key,pageId)));
  } catch {}

  /* Also cover legacy pages that only exist on notebook entries. */
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

/* Keep the existing per-page choices, but add a separate default. Changing this default never
   recolors pages that already have a stored color. */
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

/* Stamp a fresh page immediately after creation instead of allowing its first Binder role to decide
   what it looks like. The extra render only happens when this is genuinely a brand-new identity. */
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
  applyOpenNotebookPaperColorsFinal?.(root);
  installNotebookPaperColorStyleFinal?.(root);

  /* Binder tabs are page-colored too. Refresh their dataset from the page property in case an old
     role-based fallback was used to draw them earlier in this same render chain. */
  $$('.notebook-binder-tab[data-binder-page]',root).forEach(tab=>{
    const ref=typeof notebookBinderPageById==='function' ? notebookBinderPageById(tab.dataset.binderPage) : null;
    if (ref) tab.dataset.paperColor=notebookPagePaperColorFinal(ref.key,ref.pageId);
  });
};

stampNotebookPageColorsOnce();
