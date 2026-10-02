/* Final clean Binder tabs + integration polish.
   This layer owns the close affordance, keeps the canonical roster healthy, and wires History
   back through Binder navigation without reintroducing any split/reference behavior. */

let binderCleanLastPolishPage=null;
let binderCleanLastPolishAt=0;

function binderCleanRefExists(ref) {
  if (!ref?.key || !ref?.pageId) return false;
  if (typeof notebookPageOrderForDate!=='function') return true;
  try {
    return notebookPageOrderForDate(ref.key).includes(ref.pageId);
  } catch {
    return true;
  }
}

function binderCleanCurrentRef() {
  if (typeof canonicalBinderCurrent==='function') return canonicalBinderCurrent();
  if (typeof singleBinderCurrentRef==='function') return singleBinderCurrentRef();
  return currentNotebookDate && currentNotebookPageId
    ? {key:currentNotebookDate,pageId:currentNotebookPageId,id:`${currentNotebookDate}::${currentNotebookPageId}`}
    : null;
}

function binderCleanWritePages(pages,{persist=false}={}) {
  if (typeof canonicalBinderWrite==='function') return canonicalBinderWrite(pages,{persist});
  state.settings ||= {};
  state.settings.notebookBinderOpenPages=(pages||[]).map(({key,pageId})=>({key,pageId}));
  if (persist) save();
  return pages||[];
}

function binderCleanOpenPages({persistRepair=true}={}) {
  let pages=typeof canonicalBinderRoster==='function'
    ? canonicalBinderRoster()
    : (typeof notebookBinderOpenPages==='function' ? notebookBinderOpenPages() : singleBinderOpenPages());

  const before=(pages||[]).map(page=>page?.id||`${page?.key||''}::${page?.pageId||''}`).join('|');
  pages=(pages||[]).filter(binderCleanRefExists);
  const current=binderCleanCurrentRef();

  /* A legacy navigation path may already have made an unrostered page current. Repair that old
     inconsistent state by keeping the page the user can see and releasing one background slot. */
  if (current && binderCleanRefExists(current) && !pages.some(page=>page.id===current.id)) {
    const max=typeof NOTEBOOK_BINDER_ROSTER_MAX!=='undefined' ? NOTEBOOK_BINDER_ROSTER_MAX : 6;
    if (pages.length>=max) pages=pages.slice(0,max-1);
    pages.push(current);
  }

  const after=pages.map(page=>page?.id||`${page?.key||''}::${page?.pageId||''}`).join('|');
  if (after!==before) pages=binderCleanWritePages(pages,{persist:persistRepair});
  return pages;
}

function binderCleanEnsurePageSlot(key,pageId,{persist=true}={}) {
  if (!key || !pageId) return false;
  let pages=binderCleanOpenPages({persistRepair:true});
  const id=`${key}::${pageId}`;
  if (pages.some(page=>page.id===id)) return true;

  const max=typeof NOTEBOOK_BINDER_ROSTER_MAX!=='undefined' ? NOTEBOOK_BINDER_ROSTER_MAX : 6;
  if (pages.length>=max) {
    toast?.(`Binder already has ${max} open pages. Close a tab before opening another.`);
    return false;
  }

  const ref=typeof canonicalBinderRef==='function'
    ? canonicalBinderRef({key,pageId})
    : {key,pageId,id};
  if (!ref) return false;
  binderCleanWritePages([...pages,ref],{persist});
  return true;
}

function installBinderTabsWithClose(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  $$('.notebook-binder-top-tabs,.notebook-binder-tabs-clean,.notebook-binder-side-rail,.notebook-binder-tabs,.notebook-binder-tabs-final',shell).forEach(node=>node.remove());

  const pages=binderCleanOpenPages({persistRepair:true});
  shell.dataset.binderOpenCount=String(pages.length);
  if (pages.length<=1) return;

  const active=typeof notebookBinderActiveRef==='function' ? notebookBinderActiveRef() : binderCleanCurrentRef();
  const labels=singleBinderTabLabels(pages);
  const tabs=document.createElement('nav');
  tabs.className='notebook-binder-tabs-clean';
  tabs.setAttribute('aria-label','Open notebook pages');

  pages.forEach(ref=>{
    const tab=document.createElement('div');
    tab.className=`notebook-binder-tab-clean${active?.id===ref.id?' active':''}${notebookPageFavorite?.(ref.key,ref.pageId)?' favorite':''}`;
    tab.dataset.binderPage=ref.id;
    tab.dataset.paperColor=singleBinderPageColor(ref);
    tab.draggable=true;

    const label=labels.get(ref.id)||singleBinderDateLabel(ref);
    const open=document.createElement('button');
    open.type='button';
    open.className='notebook-binder-tab-open';
    open.title=active?.id===ref.id ? `${label} · open` : `Open ${label}`;
    if (active?.id===ref.id) open.setAttribute('aria-current','page');
    open.innerHTML=`<span class="notebook-binder-tab-label">${escapeHtml(label)}</span>`;
    open.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      if (active?.id!==ref.id) singleBinderActivate(ref,{record:true});
    };

    const close=document.createElement('button');
    close.type='button';
    close.className='notebook-binder-tab-close';
    close.draggable=false;
    close.title=`Close ${label}`;
    close.setAttribute('aria-label',close.title);
    close.innerHTML='<span aria-hidden="true">×</span>';
    close.onpointerdown=event=>{ event.preventDefault();event.stopPropagation(); };
    close.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      closeNotebookBinderPage(ref);
    };

    tab.append(open,close);

    tab.addEventListener('dragstart',event=>{
      if (event.target?.closest?.('.notebook-binder-tab-close')) {
        event.preventDefault();
        return;
      }
      tab.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain',ref.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed='move';
    });
    tab.addEventListener('dragend',()=>tab.classList.remove('is-dragging'));
    tab.addEventListener('dragover',event=>{
      event.preventDefault();
      tab.classList.add('drag-over');
      if (event.dataTransfer) event.dataTransfer.dropEffect='move';
    });
    tab.addEventListener('dragleave',()=>tab.classList.remove('drag-over'));
    tab.addEventListener('drop',event=>{
      event.preventDefault();
      tab.classList.remove('drag-over');
      singleBinderReorder(event.dataTransfer?.getData('text/plain'),ref.id);
    });
    tabs.appendChild(tab);
  });

  const toolbar=$('.notebook-toolbar',shell);
  if (toolbar) toolbar.insertAdjacentElement('afterend',tabs);
  else shell.prepend(tabs);
  requestAnimationFrame(()=>{
    singleBinderAlignTabs(root);
    if (typeof scheduleNotebookPresentationGeometry==='function') scheduleNotebookPresentationGeometry(root,{force:true});
  });
}

singleBinderInstallTabs=installBinderTabsWithClose;

/* Multiple defensive render wrappers call singleBinderPolish back-to-back. Preserve that safety but
   skip duplicate work against the exact same rendered page in the same frame. */
if (typeof singleBinderPolish==='function' && !window.__salesShopBinderPolishCoalesced) {
  window.__salesShopBinderPolishCoalesced=true;
  const _binderCleanPolish=singleBinderPolish;
  singleBinderPolish=function(root=$('#notebookDock')) {
    const page=$('.notebook-page',root);
    const now=performance.now();
    if (page && page===binderCleanLastPolishPage && now-binderCleanLastPolishAt<36) return;
    binderCleanLastPolishPage=page;
    binderCleanLastPolishAt=now;
    const result=_binderCleanPolish(root);
    if (typeof scheduleNotebookPresentationGeometry==='function') scheduleNotebookPresentationGeometry(root);
    return result;
  };
}

/* Paper-color menu behaves like the other compact palettes: explicit popup semantics and reliable
   dismissal on outside click or Escape. */
if (typeof singleBinderInstallPageActions==='function' && !window.__salesShopBinderPageActionPolish) {
  window.__salesShopBinderPageActionPolish=true;
  const _binderCleanInstallPageActions=singleBinderInstallPageActions;
  singleBinderInstallPageActions=function(root=$('#notebookDock')) {
    const result=_binderCleanInstallPageActions(root);
    $$('.notebook-single-style-control',root).forEach(wrap=>{
      const trigger=$('.notebook-single-style-trigger',wrap);
      const menu=$('.notebook-single-style-menu',wrap);
      if (!trigger || !menu) return;
      menu.setAttribute('role','menu');
      trigger.setAttribute('aria-haspopup','menu');
      trigger.setAttribute('aria-expanded',String(wrap.classList.contains('open')));
      if (!wrap.dataset.cleanStyleObserver) {
        wrap.dataset.cleanStyleObserver='1';
        new MutationObserver(()=>trigger.setAttribute('aria-expanded',String(wrap.classList.contains('open'))))
          .observe(wrap,{attributes:true,attributeFilter:['class']});
      }
    });
    return result;
  };
}

if (!window.__salesShopBinderStyleDismiss) {
  window.__salesShopBinderStyleDismiss=true;
  document.addEventListener('click',event=>{
    $$('#notebookDock .notebook-single-style-control.open').forEach(wrap=>{
      if (!wrap.contains(event.target)) wrap.classList.remove('open');
    });
  });
  document.addEventListener('keydown',event=>{
    if (event.key!=='Escape') return;
    $$('#notebookDock .notebook-single-style-control.open').forEach(wrap=>{
      wrap.classList.remove('open');
      $('.notebook-single-style-trigger',wrap)?.focus?.({preventScroll:true});
    });
  });
}

/* Current Calendar History rows used to set currentNotebookDate/currentNotebookPageId directly.
   Route every "Open" action through Binder so tabs and page identity can never disagree. */
function binderCleanWireHistoryOpen(root=$('#modalRoot')) {
  if (!root) return;
  $$('[data-history-calendar-open-page]',root).forEach(button=>{
    const key=button.dataset.historyCalendarOpenDate;
    const pageId=button.dataset.historyCalendarOpenPage;
    button.title='Open this page in the Binder';
    button.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      if (key && pageId) openNotebookPageInBinder(key,pageId);
    };
  });
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
      if (key && pageId) openNotebookPageInBinder(key,pageId);
    };
  });
}

if (typeof bindNotebookHistoryCalendar==='function' && !window.__salesShopBinderHistoryOpenClean) {
  window.__salesShopBinderHistoryOpenClean=true;
  const _binderCleanHistoryBind=bindNotebookHistoryCalendar;
  bindNotebookHistoryCalendar=function() {
    const result=_binderCleanHistoryBind();
    binderCleanWireHistoryOpen($('#modalRoot'));
    return result;
  };
}

/* Resume/Today change the live pointer. Reserve a Binder slot first so a full six-tab Binder never
   produces a seventh invisible "current" page. */
if (typeof resumeNotebookPage==='function' && !window.__salesShopBinderResumeGuard) {
  window.__salesShopBinderResumeGuard=true;
  const _binderCleanResume=resumeNotebookPage;
  resumeNotebookPage=function(key,pageId,options={}) {
    if (!binderCleanEnsurePageSlot(key,pageId,{persist:true})) return;
    return _binderCleanResume(key,pageId,options);
  };
}
if (typeof returnNotebookToToday==='function' && !window.__salesShopBinderTodayGuard) {
  window.__salesShopBinderTodayGuard=true;
  const _binderCleanToday=returnNotebookToToday;
  returnNotebookToToday=function() {
    const today=dateKey();
    const pageId=notebookPageState()[today] || ensureNotebookPage(today);
    if (!binderCleanEnsurePageSlot(today,pageId,{persist:true})) return;
    return _binderCleanToday();
  };
}

/* New Page creates a new Binder identity too. Honor the same six-page ceiling rather than creating
   a page the tab strip cannot represent. */
if (typeof startFreshNotebookPage==='function' && !window.__salesShopBinderFreshPageGuard) {
  window.__salesShopBinderFreshPageGuard=true;
  const _binderCleanFreshPage=startFreshNotebookPage;
  startFreshNotebookPage=function(root) {
    const pages=binderCleanOpenPages({persistRepair:true});
    const max=typeof NOTEBOOK_BINDER_ROSTER_MAX!=='undefined' ? NOTEBOOK_BINDER_ROSTER_MAX : 6;
    if (pages.length>=max) {
      toast?.(`Binder already has ${max} open pages. Close a tab before creating a new page.`);
      return;
    }
    const result=_binderCleanFreshPage(root);
    if (currentNotebookDate && currentNotebookPageId) {
      binderCleanEnsurePageSlot(currentNotebookDate,currentNotebookPageId,{persist:true});
    }
    return result;
  };
}

requestAnimationFrame(()=>{
  binderCleanOpenPages({persistRepair:true});
  singleBinderPolish?.($('#notebookDock'));
  binderCleanWireHistoryOpen($('#modalRoot'));
});
