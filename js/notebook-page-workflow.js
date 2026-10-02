/* Notebook page workflow: editable-by-default pages, explicit Lock/Favorite metadata,
   configurable non-current paper tint, and draggable paper tabs for Stack <-> Split. */

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
  if (locked) map[storageKey]={lockedAt:nowISO?.() || new Date().toISOString()};
  else delete map[storageKey];
  save();
}

function setNotebookPageFavorite(key,pageId,favorite) {
  const storageKey=notebookPageMetadataKey(key,pageId);
  const map=notebookFavoritePages();
  if (favorite) map[storageKey]={favoritedAt:nowISO?.() || new Date().toISOString()};
  else delete map[storageKey];
  save();
}

function toggleNotebookPageLock(key=currentNotebookDate,pageId=currentNotebookPageId) {
  if (!key || !pageId) return;
  const next=!notebookPageLocked(key,pageId);
  setNotebookPageLocked(key,pageId,next);
  renderAll();
  toast(next?'Page locked':'Page unlocked');
}

function toggleNotebookPageFavorite(key=currentNotebookDate,pageId=currentNotebookPageId) {
  if (!key || !pageId) return;
  const next=!notebookPageFavorite(key,pageId);
  setNotebookPageFavorite(key,pageId,next);
  renderAll();
  toast(next?'Page added to Favorites':'Page removed from Favorites');
}

/* Historical pages are ordinary notebook pages again. Only an explicit page lock makes one
   read-only. The old unlock-history set remains harmless but no longer defines editability. */
if (typeof isCurrentNotebookPageEditable==='function' && !window.__salesShopEditableByDefaultPages) {
  window.__salesShopEditableByDefaultPages=true;
  isCurrentNotebookPageEditable=function() {
    return !notebookPageLocked(currentNotebookDate,currentNotebookPageId);
  };
}

/* Remove the older edit/unlock-history button. Lock is now explicit page metadata everywhere. */
if (typeof installHistoryEditControl==='function') {
  installHistoryEditControl=function(root) {
    $('[data-history-edit]',root)?.remove();
  };
}

function notebookMetaIcon(type,active=false) {
  if (type==='favorite') return active
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2.7 2.1 4.3 4.8.7-3.5 3.4.8 4.8-4.2-2.3-4.2 2.3.8-4.8-3.5-3.4 4.8-.7Z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2.7 2.1 4.3 4.8.7-3.5 3.4.8 4.8-4.2-2.3-4.2 2.3.8-4.8-3.5-3.4 4.8-.7Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/></svg>';
  return active
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="8.2" width="11" height="8" rx="1.6" fill="currentColor" opacity=".88"/><path d="M7 8.2V6.1a3 3 0 0 1 6 0v2.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="8.2" width="11" height="8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.35"/><path d="M7 8.2V6.1a3 3 0 0 1 6 0v2.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
}

function installNotebookPageMetadataControls(root=$('#notebookDock')) {
  if (!root) return;
  const actions=$('.notebook-toolbar-actions',root);
  if (!actions || !currentNotebookDate || !currentNotebookPageId) return;
  $('[data-history-edit]',actions)?.remove();

  let favorite=$('[data-notebook-page-favorite]',actions);
  if (!favorite) {
    favorite=document.createElement('button');
    favorite.type='button';
    favorite.className='notebook-toolbar-button notebook-page-meta-button';
    favorite.dataset.notebookPageFavorite='';
    actions.insertBefore(favorite,actions.firstChild);
  }
  const isFavorite=notebookPageFavorite();
  favorite.classList.toggle('active',isFavorite);
  favorite.title=isFavorite?'Remove page from Favorites':'Favorite this page';
  favorite.setAttribute('aria-label',favorite.title);
  favorite.setAttribute('aria-pressed',String(isFavorite));
  favorite.innerHTML=notebookMetaIcon('favorite',isFavorite);
  favorite.onclick=event=>{ event.preventDefault();event.stopPropagation();toggleNotebookPageFavorite(); };

  let lock=$('[data-notebook-page-lock]',actions);
  if (!lock) {
    lock=document.createElement('button');
    lock.type='button';
    lock.className='notebook-toolbar-button notebook-page-meta-button';
    lock.dataset.notebookPageLock='';
    actions.insertBefore(lock,favorite.nextSibling);
  }
  const isLocked=notebookPageLocked();
  lock.classList.toggle('active',isLocked);
  lock.title=isLocked?'Unlock this page':'Lock this page';
  lock.setAttribute('aria-label',lock.title);
  lock.setAttribute('aria-pressed',String(isLocked));
  lock.innerHTML=notebookMetaIcon('lock',isLocked);
  lock.onclick=event=>{ event.preventDefault();event.stopPropagation();toggleNotebookPageLock(); };
}

function notebookFavoritePageRefs() {
  if (typeof notebookAllPageRefs!=='function') return [];
  const meta=notebookFavoritePages();
  return notebookAllPageRefs().filter(page=>meta[notebookPageMetadataKey(page.key,page.pageId)]).map(page=>({
    ...page,
    preview:notebookPagePreviewForHistory?.(page.key,page.pageId) || 'Notebook page',
    locked:notebookPageLocked(page.key,page.pageId),
    favoritedAt:meta[notebookPageMetadataKey(page.key,page.pageId)]?.favoritedAt || ''
  })).sort((a,b)=>String(b.favoritedAt||'').localeCompare(String(a.favoritedAt||'')));
}

function notebookFavoriteShelfHtml() {
  const pages=notebookFavoritePageRefs();
  if (!pages.length) return '';
  return `<div class="notebook-history-favorites" data-history-favorites>
    <div class="notebook-history-favorites-label">Favorites</div>
    <div class="notebook-history-favorites-list">
      ${pages.map(page=>`<button type="button" class="notebook-history-favorite-chip" data-history-favorite-open-date="${page.key}" data-history-favorite-open-page="${page.pageId}" title="Open favorite page">
        <span class="notebook-history-favorite-star">★</span>
        <span class="notebook-history-favorite-copy"><strong>${escapeHtml(page.preview)}</strong><small>${escapeHtml(notebookHistoryDateLabel?.(page.key)||page.key)}${page.locked?' · Locked':''}</small></span>
      </button>`).join('')}
    </div>
  </div>`;
}

function installNotebookHistoryPageMetadata(root=$('#modalRoot')) {
  if (!root) return;
  const shell=$('.notebook-history-calendar-shell',root);
  if (shell) {
    $('[data-history-favorites]',shell)?.remove();
    const html=notebookFavoriteShelfHtml();
    if (html) {
      const holder=document.createElement('div');
      holder.innerHTML=html;
      const favorites=holder.firstElementChild;
      const toolbar=$('.notebook-history-calendar-toolbar',shell);
      toolbar?.insertAdjacentElement('afterend',favorites);
      $$('[data-history-favorite-open-page]',favorites).forEach(button=>button.onclick=()=>{
        currentNotebookDate=button.dataset.historyFavoriteOpenDate;
        currentNotebookPageId=button.dataset.historyFavoriteOpenPage;
        closeModal();
        renderAll();
      });
    }
  }

  $$('.notebook-history-calendar-page',root).forEach(row=>{
    const open=$('[data-history-calendar-open-page]',row);
    const actions=$('.notebook-history-calendar-page-actions',row);
    if (!open || !actions) return;
    const key=open.dataset.historyCalendarOpenDate;
    const pageId=open.dataset.historyCalendarOpenPage;

    let favorite=$('[data-history-page-favorite]',actions);
    if (!favorite) {
      favorite=document.createElement('button');
      favorite.type='button';
      favorite.className='notebook-history-page-meta-action';
      favorite.dataset.historyPageFavorite='';
      actions.prepend(favorite);
    }
    const fav=notebookPageFavorite(key,pageId);
    favorite.classList.toggle('active',fav);
    favorite.title=fav?'Remove from Favorites':'Favorite page';
    favorite.setAttribute('aria-label',favorite.title);
    favorite.innerHTML=notebookMetaIcon('favorite',fav);
    favorite.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      setNotebookPageFavorite(key,pageId,!fav);
      refreshNotebookHistoryCalendar?.();
    };

    let lock=$('[data-history-page-lock]',actions);
    if (!lock) {
      lock=document.createElement('button');
      lock.type='button';
      lock.className='notebook-history-page-meta-action';
      lock.dataset.historyPageLock='';
      favorite.insertAdjacentElement('afterend',lock);
    }
    const locked=notebookPageLocked(key,pageId);
    lock.classList.toggle('active',locked);
    lock.title=locked?'Unlock page':'Lock page';
    lock.setAttribute('aria-label',lock.title);
    lock.innerHTML=notebookMetaIcon('lock',locked);
    lock.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      setNotebookPageLocked(key,pageId,!locked);
      refreshNotebookHistoryCalendar?.();
    };
  });
}

if (typeof bindNotebookHistoryCalendar==='function' && !window.__salesShopHistoryPageMetadata) {
  window.__salesShopHistoryPageMetadata=true;
  const _pageMetadataHistoryBind=bindNotebookHistoryCalendar;
  bindNotebookHistoryCalendar=function() {
    const result=_pageMetadataHistoryBind();
    installNotebookHistoryPageMetadata($('#modalRoot'));
    return result;
  };
}

/* Explicit locks also apply to the editable Reference rendering. */
if (typeof buildNotebookReferencePage==='function' && !window.__salesShopReferenceLockMetadata) {
  window.__salesShopReferenceLockMetadata=true;
  const _pageMetadataBuildReference=buildNotebookReferencePage;
  buildNotebookReferencePage=function(ref) {
    const page=_pageMetadataBuildReference(ref);
    const locked=notebookPageLocked(ref.key,ref.pageId);
    page.classList.toggle('notebook-reference-locked',locked);
    if (locked) {
      $$('[contenteditable]',page).forEach(element=>element.contentEditable='false');
      const label=$('.notebook-reference-label',page);
      if (label) label.textContent='Reference · Locked';
    }
    return page;
  };
}

/* Clean metadata if a truly blank page is deleted from History. */
if (typeof deleteBlankNotebookPage==='function' && !window.__salesShopPageMetadataDeleteCleanup) {
  window.__salesShopPageMetadataDeleteCleanup=true;
  const _pageMetadataDeleteBlank=deleteBlankNotebookPage;
  deleteBlankNotebookPage=function(key,pageId) {
    const storageKey=notebookPageMetadataKey(key,pageId);
    const wasBlank=notebookPageIsTrulyBlank?.(key,pageId);
    const result=_pageMetadataDeleteBlank(key,pageId);
    if (wasBlank) {
      delete notebookLockedPages()[storageKey];
      delete notebookFavoritePages()[storageKey];
      save();
    }
    return result;
  };
}

function notebookReferencePaperTint() {
  const value=state.settings?.notebookReferencePaperTint;
  return ['same','blue','neutral'].includes(value) ? value : 'blue';
}

function applyNotebookReferencePaperTint(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (shell) shell.dataset.referencePaperTint=notebookReferencePaperTint();
}

function installNotebookReferencePaperStyleMenu(root=$('#notebookDock')) {
  const menu=$('[data-notebook-view-menu]',root);
  if (!menu || $('[data-reference-paper-group]',menu)) return;
  const active=notebookReferencePaperTint();
  const group=document.createElement('div');
  group.className='notebook-style-group notebook-reference-paper-style-group';
  group.dataset.referencePaperGroup='';
  group.innerHTML=`
    <div class="notebook-style-group-label">Other sheet</div>
    <div class="notebook-style-choice-row">
      <button type="button" class="notebook-style-choice reference-paper-choice ${active==='same'?'active':''}" data-reference-paper-tint="same" title="Same paper color" aria-label="Same paper color"><span class="reference-paper-swatch swatch-same"></span></button>
      <button type="button" class="notebook-style-choice reference-paper-choice ${active==='blue'?'active':''}" data-reference-paper-tint="blue" title="Light blue reference paper" aria-label="Light blue reference paper"><span class="reference-paper-swatch swatch-blue"></span></button>
      <button type="button" class="notebook-style-choice reference-paper-choice ${active==='neutral'?'active':''}" data-reference-paper-tint="neutral" title="Neutral reference paper" aria-label="Neutral reference paper"><span class="reference-paper-swatch swatch-neutral"></span></button>
    </div>`;
  menu.appendChild(group);
  $$('[data-reference-paper-tint]',group).forEach(button=>button.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    state.settings ||= {};
    state.settings.notebookReferencePaperTint=button.dataset.referencePaperTint;
    save();
    renderAll();
  });
}

function notebookPaperLayoutPreference() {
  const value=state.settings?.notebookPaperLayout;
  return value==='split' || value==='stack' ? value : 'auto';
}

function resolvedNotebookPaperLayout(pair) {
  const pref=notebookPaperLayoutPreference();
  if (pref!=='auto') return pref;
  const shell=pair?.closest?.('.notebook-shell');
  return (shell?.getBoundingClientRect?.().width || pair?.getBoundingClientRect?.().width || 0) <= 980 ? 'stack' : 'split';
}

function applyNotebookPaperLayout(pair) {
  if (!pair) return;
  pair.dataset.paperLayout=notebookPaperLayoutPreference();
  pair.dataset.paperResolvedLayout=resolvedNotebookPaperLayout(pair);
}

let notebookPaperTabDrag=null;

function commitNotebookPaperLayout(mode,front=null) {
  state.settings ||= {};
  state.settings.notebookPaperLayout=mode==='split'?'split':'stack';
  if (front) state.settings.notebookPaperFront=front;
  save();
  renderAll();
}

function bindNotebookPaperTabDrag(pair) {
  if (!pair || pair.dataset.paperTabDragBound) return;
  pair.dataset.paperTabDragBound='1';
  $$('[data-paper-peek]',pair).forEach(peek=>{
    peek.title=resolvedNotebookPaperLayout(pair)==='split'
      ? `Drag to layer ${peek.dataset.paperPeek==='current'?'Current':'Reference'} on top`
      : 'Drag this paper edge outward to split the pages';

    peek.addEventListener('click',event=>{
      if (Number(peek.dataset.suppressClickUntil||0)>Date.now()) {
        event.preventDefault();event.stopImmediatePropagation();
      }
    },true);

    peek.addEventListener('pointerdown',event=>{
      if (event.button!==0) return;
      const layout=resolvedNotebookPaperLayout(pair);
      notebookPaperTabDrag={
        pair,peek,pointerId:event.pointerId,startX:event.clientX,layout,
        role:peek.dataset.paperPeek,front:notebookPaperFront?.() || 'current',moved:false
      };
      peek.setPointerCapture?.(event.pointerId);
      pair.classList.add('paper-tab-dragging');
      event.preventDefault();
    });
  });

  const move=event=>{
    const drag=notebookPaperTabDrag;
    if (!drag || drag.pair!==pair || event.pointerId!==drag.pointerId) return;
    const dx=event.clientX-drag.startX;
    if (Math.abs(dx)>4) drag.moved=true;
    if (drag.layout==='stack') {
      const expected=drag.role==='reference' ? 1 : -1;
      const outward=Math.max(0,dx*expected);
      const offset=Math.min(150,30+outward*.7);
      pair.style.setProperty('--paper-drag-offset',`${offset}px`);
      pair.dataset.paperDragRole=drag.role;
    } else {
      const expected=drag.role==='current' ? 1 : -1;
      const inward=Math.max(0,dx*expected);
      pair.style.setProperty('--paper-layer-preview',String(Math.min(1,inward/100)));
      pair.dataset.paperDragRole=drag.role;
    }
    event.preventDefault();
  };

  const finish=event=>{
    const drag=notebookPaperTabDrag;
    if (!drag || drag.pair!==pair || (event.pointerId!=null && event.pointerId!==drag.pointerId)) return;
    notebookPaperTabDrag=null;
    pair.classList.remove('paper-tab-dragging');
    pair.style.removeProperty('--paper-drag-offset');
    pair.style.removeProperty('--paper-layer-preview');
    delete pair.dataset.paperDragRole;
    const dx=event.clientX-drag.startX;
    let changed=false;
    if (drag.layout==='stack') {
      const expected=drag.role==='reference' ? 1 : -1;
      if (dx*expected>82) { changed=true;commitNotebookPaperLayout('split'); }
    } else {
      const expected=drag.role==='current' ? 1 : -1;
      if (dx*expected>72) { changed=true;commitNotebookPaperLayout('stack',drag.role); }
    }
    if (changed || drag.moved) drag.peek.dataset.suppressClickUntil=String(Date.now()+320);
  };

  pair.addEventListener('pointermove',move,{passive:false});
  pair.addEventListener('pointerup',finish);
  pair.addEventListener('pointercancel',finish);
}

function installNotebookPaperWorkflow(root=$('#notebookDock')) {
  if (!root) return;
  installNotebookPageMetadataControls(root);
  installNotebookReferencePaperStyleMenu(root);
  applyNotebookReferencePaperTint(root);
  const pair=$('.notebook-page-pair',root);
  if (pair) {
    applyNotebookPaperLayout(pair);
    bindNotebookPaperTabDrag(pair);
  }
}

/* Locks/Favorites are intentional metadata. Keep them through ordinary content Undo/Redo rather than
   letting a text undo unexpectedly change protection/navigation state. */
if (typeof restoreNotebookHistorySnapshot==='function' && !window.__salesShopPageMetadataUndoGuard) {
  window.__salesShopPageMetadataUndoGuard=true;
  const _pageMetadataRestore=restoreNotebookHistorySnapshot;
  restoreNotebookHistorySnapshot=function(snapshot) {
    const locked={...notebookLockedPages()};
    const favorites={...notebookFavoritePages()};
    const result=_pageMetadataRestore(snapshot);
    state.settings ||= {};
    state.settings.notebookLockedPages=locked;
    state.settings.notebookFavoritePages=favorites;
    return result;
  };
}

const _pageWorkflowRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _pageWorkflowRenderNotebook(root);
  if (!root) return;
  installNotebookPaperWorkflow(root);
};
