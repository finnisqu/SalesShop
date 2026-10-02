/* Clean notebook page metadata + paper color support.
   No Reference, peer-page, split-view, paper-stack, or drag-layout behavior lives here. */

const NOTEBOOK_PAGE_PAPER_COLORS_CLEAN = new Set(['warm','blue','neutral']);

function notebookPageMetadataKey(key=currentNotebookDate,pageId=currentNotebookPageId) {
  return `${key || dateKey()}::${pageId || ensureNotebookPage(key || dateKey())}`;
}
function notebookLockedPages() {
  state.settings ||= {};
  state.settings.notebookLockedPages ||= {};
  return state.settings.notebookLockedPages;
}
function notebookFavoritePages() {
  state.settings ||= {};
  state.settings.notebookFavoritePages ||= {};
  return state.settings.notebookFavoritePages;
}
function notebookPageLocked(key=currentNotebookDate,pageId=currentNotebookPageId) {
  return !!notebookLockedPages()[notebookPageMetadataKey(key,pageId)];
}
function notebookPageFavorite(key=currentNotebookDate,pageId=currentNotebookPageId) {
  return !!notebookFavoritePages()[notebookPageMetadataKey(key,pageId)];
}
function setNotebookPageLocked(key,pageId,locked) {
  const storageKey=notebookPageMetadataKey(key,pageId);
  const map=notebookLockedPages();
  if (locked) map[storageKey]={lockedAt:typeof nowISO==='function'?nowISO():new Date().toISOString()};
  else delete map[storageKey];
  save();
}
function setNotebookPageFavorite(key,pageId,favorite) {
  const storageKey=notebookPageMetadataKey(key,pageId);
  const map=notebookFavoritePages();
  if (favorite) map[storageKey]={favoritedAt:typeof nowISO==='function'?nowISO():new Date().toISOString()};
  else delete map[storageKey];
  save();
}

/* Historical pages are editable by default. Only an explicit History lock protects one. */
if (typeof isCurrentNotebookPageEditable==='function') {
  isCurrentNotebookPageEditable=function() {
    return !notebookPageLocked(currentNotebookDate,currentNotebookPageId);
  };
}
if (typeof installHistoryEditControl==='function') {
  installHistoryEditControl=function(root){ $('[data-history-edit]',root)?.remove(); };
}

function notebookMetaIcon(type,active=false) {
  if (type==='favorite') return active
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2.7 2.1 4.3 4.8.7-3.5 3.4.8 4.8-4.2-2.3-4.2 2.3.8-4.8-3.5-3.4 4.8-.7Z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2.7 2.1 4.3 4.8.7-3.5 3.4.8 4.8-4.2-2.3-4.2 2.3.8-4.8-3.5-3.4 4.8-.7Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/></svg>';
  return active
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="8.2" width="11" height="8" rx="1.6" fill="currentColor" opacity=".88"/><path d="M7 8.2V6.1a3 3 0 0 1 6 0v2.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="8.2" width="11" height="8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.35"/><path d="M7 8.2V6.1a3 3 0 0 1 6 0v2.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
}
function binderIconSvg(kind) {
  if (kind==='style') return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.8c3.9 0 6.7 2.2 6.7 5.1 0 2.1-1.5 3-3.1 3h-1.2c-.8 0-1.2.6-.9 1.3.5 1.2-.2 2.7-1.7 3.5-1 .5-2.3.7-3.5.3-3-.9-4.9-3.3-4.9-6.1 0-3.9 3.8-7.1 8.6-7.1Z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6" cy="7" r="1" fill="currentColor"/><circle cx="9.3" cy="5.7" r="1" fill="currentColor"/><circle cx="12.8" cy="6.5" r="1" fill="currentColor"/></svg>';
  if (kind==='close') return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/></svg>';
  return '';
}

/* Persistent page color identity. */
function notebookPagePaperColorMapFinal() {
  state.settings ||= {};
  state.settings.notebookPagePaperColors ||= {};
  return state.settings.notebookPagePaperColors;
}
function notebookDefaultPagePaperColor() {
  const value=state.settings?.notebookDefaultPagePaperColor;
  return NOTEBOOK_PAGE_PAPER_COLORS_CLEAN.has(value)?value:'warm';
}
function setNotebookDefaultPagePaperColor(color) {
  if (!NOTEBOOK_PAGE_PAPER_COLORS_CLEAN.has(color)) return;
  state.settings ||= {};
  state.settings.notebookDefaultPagePaperColor=color;
  save();
  renderAll();
}
function notebookPagePaperColorFinal(key,pageId,fallback=null) {
  const storageKey=notebookPageMetadataKey(key,pageId);
  const value=notebookPagePaperColorMapFinal()[storageKey];
  return NOTEBOOK_PAGE_PAPER_COLORS_CLEAN.has(value) ? value : (NOTEBOOK_PAGE_PAPER_COLORS_CLEAN.has(fallback)?fallback:notebookDefaultPagePaperColor());
}
function ensureNotebookPagePaperColorFinal(key,pageId,fallback=null) {
  if (!key || !pageId) return {color:notebookDefaultPagePaperColor(),changed:false};
  const map=notebookPagePaperColorMapFinal();
  const storageKey=notebookPageMetadataKey(key,pageId);
  if (!NOTEBOOK_PAGE_PAPER_COLORS_CLEAN.has(map[storageKey])) {
    map[storageKey]=NOTEBOOK_PAGE_PAPER_COLORS_CLEAN.has(fallback)?fallback:notebookDefaultPagePaperColor();
    return {color:map[storageKey],changed:true};
  }
  return {color:map[storageKey],changed:false};
}
function setNotebookPagePaperColorFinal(key,pageId,color) {
  if (!key || !pageId || !NOTEBOOK_PAGE_PAPER_COLORS_CLEAN.has(color)) return;
  notebookPagePaperColorMapFinal()[notebookPageMetadataKey(key,pageId)]=color;
  save();
  renderAll();
}
function applyOpenNotebookPaperColorsFinal(root=$('#notebookDock')) {
  if (!root || !currentNotebookDate || !currentNotebookPageId) return;
  const ensured=ensureNotebookPagePaperColorFinal(currentNotebookDate,currentNotebookPageId);
  if (ensured.changed) save();
  const page=$('.notebook-page',root);
  if (page) page.dataset.pagePaperColor=ensured.color;
}

function notebookCleanInstallDefaultColorStyle(root=$('#notebookDock')) {
  const menu=$('[data-notebook-view-menu]',root);
  if (!menu) return;
  $('[data-clean-default-paper-color]',menu)?.remove();
  const active=notebookDefaultPagePaperColor();
  const group=document.createElement('div');
  group.className='notebook-style-group notebook-clean-default-paper-color';
  group.dataset.cleanDefaultPaperColor='';
  group.innerHTML=`<div class="notebook-style-group-label">New pages</div><div class="notebook-style-choice-row"></div>`;
  const row=$('.notebook-style-choice-row',group);
  [['warm','Warm'],['blue','Blue'],['neutral','Neutral']].forEach(([color,label])=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=`notebook-style-choice page-paper-choice ${active===color?'active':''}`;
    button.title=`${label} paper for new pages`;
    button.setAttribute('aria-label',button.title);
    button.innerHTML=`<span class="page-paper-swatch swatch-${color}"></span>`;
    button.onclick=event=>{event.preventDefault();event.stopPropagation();setNotebookDefaultPagePaperColor(color);};
    row.appendChild(button);
  });
  menu.appendChild(group);
}

function notebookCleanFavoritePageRefs() {
  if (typeof notebookAllPageRefs!=='function') return [];
  const meta=notebookFavoritePages();
  return notebookAllPageRefs().filter(page=>meta[notebookPageMetadataKey(page.key,page.pageId)]).map(page=>({
    ...page,
    preview:notebookPagePreviewForHistory?.(page.key,page.pageId) || 'Notebook page',
    locked:notebookPageLocked(page.key,page.pageId),
    favoritedAt:meta[notebookPageMetadataKey(page.key,page.pageId)]?.favoritedAt || ''
  })).sort((a,b)=>String(b.favoritedAt||'').localeCompare(String(a.favoritedAt||'')));
}
function notebookCleanFavoriteShelf(root=$('#modalRoot')) {
  const shell=$('.notebook-history-calendar-shell',root);
  if (!shell) return;
  $('[data-history-favorites]',shell)?.remove();
  const pages=notebookCleanFavoritePageRefs();
  if (!pages.length) return;
  const shelf=document.createElement('div');
  shelf.className='notebook-history-favorites';
  shelf.dataset.historyFavorites='';
  shelf.innerHTML=`<div class="notebook-history-favorites-label">Favorites</div><div class="notebook-history-favorites-list"></div>`;
  const list=$('.notebook-history-favorites-list',shelf);
  pages.forEach(page=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='notebook-history-favorite-chip';
    button.innerHTML=`<span class="notebook-history-favorite-star">★</span><span class="notebook-history-favorite-copy"><strong>${escapeHtml(page.preview)}</strong><small>${escapeHtml(notebookHistoryDateLabel?.(page.key)||page.key)}${page.locked?' · Locked':''}</small></span>`;
    button.onclick=()=>{
      if (typeof openNotebookPageInBinder==='function') openNotebookPageInBinder(page.key,page.pageId);
      else { currentNotebookDate=page.key;currentNotebookPageId=page.pageId;closeModal?.();renderAll(); }
    };
    list.appendChild(button);
  });
  const grid=$('.notebook-history-calendar-grid',shell);
  if (grid) grid.insertAdjacentElement('afterend',shelf);
  else shell.appendChild(shelf);
}
function installNotebookHistoryPageMetadata(root=$('#modalRoot')) {
  if (!root) return;
  notebookCleanFavoriteShelf(root);
  $$('.notebook-history-calendar-page',root).forEach(row=>{
    const open=$('[data-history-calendar-open-page]',row);
    const actions=$('.notebook-history-calendar-page-actions',row);
    if (!open || !actions) return;
    const key=open.dataset.historyCalendarOpenDate;
    const pageId=open.dataset.historyCalendarOpenPage;
    $$('[data-history-page-favorite],[data-history-page-lock]',actions).forEach(node=>node.remove());
    const favorite=document.createElement('button');
    favorite.type='button';favorite.className='notebook-history-page-meta-action';favorite.dataset.historyPageFavorite='';
    const fav=notebookPageFavorite(key,pageId);
    favorite.classList.toggle('active',fav);favorite.title=fav?'Remove from Favorites':'Favorite page';favorite.setAttribute('aria-label',favorite.title);favorite.innerHTML=notebookMetaIcon('favorite',fav);
    favorite.onclick=event=>{event.preventDefault();event.stopPropagation();setNotebookPageFavorite(key,pageId,!fav);refreshNotebookHistoryCalendar?.();};
    const lock=document.createElement('button');
    lock.type='button';lock.className='notebook-history-page-meta-action';lock.dataset.historyPageLock='';
    const locked=notebookPageLocked(key,pageId);
    lock.classList.toggle('active',locked);lock.title=locked?'Unlock page':'Lock page';lock.setAttribute('aria-label',lock.title);lock.innerHTML=notebookMetaIcon('lock',locked);
    lock.onclick=event=>{event.preventDefault();event.stopPropagation();setNotebookPageLocked(key,pageId,!locked);refreshNotebookHistoryCalendar?.();};
    actions.prepend(lock);actions.prepend(favorite);
  });
}
if (typeof bindNotebookHistoryCalendar==='function') {
  const _cleanMetadataHistoryBind=bindNotebookHistoryCalendar;
  bindNotebookHistoryCalendar=function(){ const result=_cleanMetadataHistoryBind();installNotebookHistoryPageMetadata($('#modalRoot'));return result; };
}

/* Remove metadata if a blank page is truly deleted. */
if (typeof deleteBlankNotebookPage==='function') {
  const _cleanDeleteBlank=deleteBlankNotebookPage;
  deleteBlankNotebookPage=function(key,pageId) {
    const storageKey=notebookPageMetadataKey(key,pageId);
    const blank=notebookPageIsTrulyBlank?.(key,pageId);
    const result=_cleanDeleteBlank(key,pageId);
    if (blank) {
      delete notebookLockedPages()[storageKey];
      delete notebookFavoritePages()[storageKey];
      delete notebookPagePaperColorMapFinal()[storageKey];
      save();
    }
    return result;
  };
}

const _cleanMetadataRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _cleanMetadataRenderNotebook(root);
  if (!root) return;
  applyOpenNotebookPaperColorsFinal(root);
  notebookCleanInstallDefaultColorStyle(root);
};
