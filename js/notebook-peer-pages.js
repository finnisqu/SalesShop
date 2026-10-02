/* Peer notebook pages.
   Two open sheets are physical peers: either can become the full interactive page without changing
   its left/right location. Swap changes only location. Closing either sheet leaves the other as the
   sole working page. Persistent binder tabs replace the experimental drag tabs. */

function notebookPeerId(key,pageId) {
  return `${key || ''}::${pageId || ''}`;
}

function notebookPeerRef(key,pageId) {
  return key && pageId ? {key,pageId,id:notebookPeerId(key,pageId)} : null;
}

function notebookPeerCurrentRef() {
  return notebookPeerRef(currentNotebookDate,currentNotebookPageId);
}

function notebookPeerOtherRef() {
  const ref=state.settings?.notebookReferencePage;
  return ref?.key && ref?.pageId ? notebookPeerRef(ref.key,ref.pageId) : null;
}

function notebookPeerOrderMap() {
  state.settings ||= {};
  state.settings.notebookOpenPageOrder ||= [];
  return state.settings.notebookOpenPageOrder;
}

function ensureNotebookPeerOrder({persist=false}={}) {
  const current=notebookPeerCurrentRef();
  const other=notebookPeerOtherRef();
  const wanted=[current?.id,other?.id].filter(Boolean);
  let order=notebookPeerOrderMap().filter(id=>wanted.includes(id));
  wanted.forEach(id=>{ if (!order.includes(id)) order.push(id); });
  if (!order.length && current) order=[current.id];
  const changed=JSON.stringify(order)!==JSON.stringify(state.settings.notebookOpenPageOrder||[]);
  state.settings.notebookOpenPageOrder=order;
  if (changed && persist) save();
  return order;
}

function notebookPeerRefById(id) {
  const current=notebookPeerCurrentRef();
  const other=notebookPeerOtherRef();
  return [current,other].find(ref=>ref?.id===id) || null;
}

function notebookPeerPageTitle(ref) {
  if (!ref) return 'Page';
  const header=typeof notebookPageHeader==='function' ? String(notebookPageHeader(ref.key,ref.pageId)||'').trim() : '';
  if (header) return header;
  return fmtDate?.(ref.key,{month:'short',day:'numeric'}) || ref.key;
}

function notebookPeerPageColor(ref,fallback='warm') {
  return typeof notebookPagePaperColorFinal==='function'
    ? notebookPagePaperColorFinal(ref.key,ref.pageId,fallback)
    : fallback;
}

function activateNotebookPeerPage(ref,{record=true}={}) {
  if (!ref?.key || !ref?.pageId) return;
  const current=notebookPeerCurrentRef();
  if (current?.id===ref.id) return;
  const other=notebookPeerOtherRef();
  if (!other || other.id!==ref.id || !current) return;

  /* Preserve physical order while exchanging which page receives the full notebook renderer. */
  state.settings ||= {};
  state.settings.notebookReferencePage={key:current.key,pageId:current.pageId};
  notebookPageState()[ref.key]=ref.pageId;
  setNotebookWorkingPage?.(ref.key,ref.pageId,{record,kind:'page-tab'});
  currentNotebookDate=ref.key;
  currentNotebookPageId=ref.pageId;
  ensureNotebookPeerOrder();
  save();
  renderAll();
}

function swapNotebookPeerLocations() {
  const current=notebookPeerCurrentRef();
  const other=notebookPeerOtherRef();
  if (!current || !other) return;
  const order=ensureNotebookPeerOrder();
  state.settings.notebookOpenPageOrder=[...order].reverse();
  save();
  renderAll();
}

/* Existing Swap buttons now mean only physical left/right location. */
swapNotebookReferencePage=function() {
  swapNotebookPeerLocations();
};

function closeNotebookPeerPage(ref) {
  if (!ref) return;
  const current=notebookPeerCurrentRef();
  const other=notebookPeerOtherRef();
  if (!other) return;

  if (ref.id===other.id) {
    delete state.settings.notebookReferencePage;
    state.settings.notebookOpenPageOrder=current?[current.id]:[];
    save();
    renderAll();
    return;
  }

  if (current && ref.id===current.id) {
    /* Closing the active sheet promotes the surviving peer to the sole working page. */
    delete state.settings.notebookReferencePage;
    notebookPageState()[other.key]=other.pageId;
    setNotebookWorkingPage?.(other.key,other.pageId,{record:true,kind:'peer-close'});
    currentNotebookDate=other.key;
    currentNotebookPageId=other.pageId;
    state.settings.notebookOpenPageOrder=[other.id];
    save();
    renderAll();
  }
}

/* Closing the old Reference control is simply closing that peer. */
clearNotebookReferencePage=function() {
  const ref=notebookPeerOtherRef();
  if (ref) closeNotebookPeerPage(ref);
};

/* Opening a second page establishes a stable physical order but doesn't change the active page. */
if (typeof setNotebookReferencePage==='function' && !window.__salesShopPeerReferenceOpen) {
  window.__salesShopPeerReferenceOpen=true;
  const _peerOpenReference=setNotebookReferencePage;
  setNotebookReferencePage=function(key,pageId) {
    const current=notebookPeerCurrentRef();
    const result=_peerOpenReference(key,pageId);
    const opened=notebookPeerRef(key,pageId);
    if (current && opened) {
      state.settings.notebookOpenPageOrder=[current.id,opened.id];
      save();
    }
    return result;
  };
}

function notebookPeerPaperSwatch(color) {
  return `<span class="notebook-peer-style-swatch swatch-${color}" aria-hidden="true"></span>`;
}

function notebookPeerStyleControl(ref) {
  const wrap=document.createElement('div');
  wrap.className='notebook-peer-style';
  const active=notebookPeerPageColor(ref,ref.id===notebookPeerCurrentRef()?.id?'warm':'blue');
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='notebook-peer-local-button notebook-peer-style-trigger';
  trigger.textContent='Style';
  trigger.title='Page color';
  trigger.setAttribute('aria-label','Page color');
  const menu=document.createElement('div');
  menu.className='notebook-peer-style-menu';
  [['warm','Warm'],['blue','Blue'],['neutral','Neutral']].forEach(([color,label])=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=`notebook-peer-style-choice${active===color?' active':''}`;
    button.innerHTML=`${notebookPeerPaperSwatch(color)}<span>${label}</span>`;
    button.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      setNotebookPagePaperColorFinal?.(ref.key,ref.pageId,color);
    };
    menu.appendChild(button);
  });
  trigger.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    const opening=!wrap.classList.contains('open');
    document.querySelectorAll('.notebook-peer-style.open').forEach(node=>node.classList.remove('open'));
    wrap.classList.toggle('open',opening);
  };
  wrap.append(trigger,menu);
  return wrap;
}

function notebookPeerIconButton(kind,ref) {
  const button=document.createElement('button');
  button.type='button';
  button.className=`notebook-peer-local-button notebook-peer-${kind}`;
  if (kind==='favorite') {
    const active=notebookPageFavorite?.(ref.key,ref.pageId);
    button.classList.toggle('active',!!active);
    button.title=active?'Remove from Favorites':'Favorite page';
    button.setAttribute('aria-label',button.title);
    button.innerHTML=notebookMetaIcon?.('favorite',active) || '★';
    button.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      setNotebookPageFavorite?.(ref.key,ref.pageId,!active);
      renderAll();
    };
  } else if (kind==='lock') {
    const active=notebookPageLocked?.(ref.key,ref.pageId);
    button.classList.toggle('active',!!active);
    button.title=active?'Unlock page':'Lock page';
    button.setAttribute('aria-label',button.title);
    button.innerHTML=notebookMetaIcon?.('lock',active) || '⌑';
    button.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      setNotebookPageLocked?.(ref.key,ref.pageId,!active);
      renderAll();
    };
  }
  return button;
}

function buildNotebookPeerLocalActions(ref,{closable=true}={}) {
  const actions=document.createElement('div');
  actions.className='notebook-peer-local-actions';
  actions.dataset.peerLocalActions=ref.id;
  actions.append(
    notebookPeerIconButton('favorite',ref),
    notebookPeerIconButton('lock',ref),
    notebookPeerStyleControl(ref)
  );
  if (notebookPeerOtherRef()) {
    const swap=document.createElement('button');
    swap.type='button';
    swap.className='notebook-peer-local-button notebook-peer-swap';
    swap.textContent='Swap';
    swap.title='Swap left/right page locations';
    swap.onclick=event=>{event.preventDefault();event.stopPropagation();swapNotebookPeerLocations();};
    actions.appendChild(swap);
  }
  if (closable && notebookPeerOtherRef()) {
    const close=document.createElement('button');
    close.type='button';
    close.className='notebook-peer-local-button notebook-peer-close';
    close.textContent='×';
    close.title='Close this page';
    close.setAttribute('aria-label','Close this page');
    close.onclick=event=>{event.preventDefault();event.stopPropagation();closeNotebookPeerPage(ref);};
    actions.appendChild(close);
  }
  return actions;
}

function installNotebookPeerLocalActions(root=$('#notebookDock')) {
  const current=notebookPeerCurrentRef();
  const other=notebookPeerOtherRef();
  if (!root || !current) return;

  /* Page metadata is local paper chrome now, not global application chrome. */
  $$('[data-notebook-page-favorite],[data-notebook-page-lock]',root).forEach(node=>node.remove());

  const currentHead=$('.notebook-page-pair > .notebook-page .notebook-paper-head',root) || $('.notebook-page .notebook-paper-head',root);
  if (currentHead) {
    $('[data-peer-local-actions]',currentHead)?.remove();
    currentHead.appendChild(buildNotebookPeerLocalActions(current,{closable:!!other}));
  }

  const referencePage=$('.notebook-reference-page',root);
  const referenceHead=$('.notebook-reference-head',referencePage);
  if (other && referenceHead) {
    $('.notebook-reference-actions',referenceHead)?.remove();
    $('[data-peer-local-actions]',referenceHead)?.remove();
    referenceHead.appendChild(buildNotebookPeerLocalActions(other,{closable:true}));
  }
}

function notebookPeerApplyOrder(root=$('#notebookDock')) {
  const pair=$('.notebook-page-pair',root);
  if (!pair) return;
  const current=notebookPeerCurrentRef();
  const other=notebookPeerOtherRef();
  if (!current || !other) return;
  const order=ensureNotebookPeerOrder({persist:false});
  const currentPage=$(':scope > .notebook-page',pair);
  const otherPage=$(':scope > .notebook-reference-page',pair);
  if (!currentPage || !otherPage) return;
  const currentSide=order.indexOf(current.id)===0?'left':'right';
  const otherSide=currentSide==='left'?'right':'left';
  currentPage.dataset.peerPageId=current.id;
  currentPage.dataset.peerSide=currentSide;
  currentPage.dataset.peerActive='true';
  otherPage.dataset.peerPageId=other.id;
  otherPage.dataset.peerSide=otherSide;
  otherPage.dataset.peerActive='false';
  pair.dataset.peerActiveSide=currentSide;
}

function installNotebookBinderTabs(root=$('#notebookDock')) {
  const pair=$('.notebook-page-pair',root);
  if (!pair) return;
  $('.notebook-binder-tabs',pair)?.remove();
  const order=ensureNotebookPeerOrder({persist:false});
  if (!order.length) return;
  const active=notebookPeerCurrentRef();
  const tabs=document.createElement('div');
  tabs.className='notebook-binder-tabs';
  order.forEach((id,index)=>{
    const ref=notebookPeerRefById(id);
    if (!ref) return;
    const button=document.createElement('button');
    button.type='button';
    button.className=`notebook-binder-tab${active?.id===id?' active':''}`;
    button.dataset.binderPage=id;
    button.dataset.paperColor=notebookPeerPageColor(ref,index===0?'warm':'blue');
    button.title=notebookPeerPageTitle(ref);
    button.innerHTML=`<span class="notebook-binder-tab-title">${escapeHtml(notebookPeerPageTitle(ref))}</span>`;
    button.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      activateNotebookPeerPage(ref);
    };
    tabs.appendChild(button);
  });
  pair.appendChild(tabs);
}

/* Retire the experimental one-at-a-time drag tab. Binder tabs are persistent and page-based. */
if (typeof rebuildNotebookActivePaperTabFinal==='function') {
  rebuildNotebookActivePaperTabFinal=function(pair) {
    $$('.notebook-paper-peek,.notebook-paper-active-tab',pair).forEach(node=>node.remove());
  };
}
if (typeof bindNotebookPaperActivationFinal==='function') {
  bindNotebookPaperActivationFinal=function() {};
}
if (typeof bindNotebookActivePaperTabDragFinal==='function') {
  bindNotebookActivePaperTabDragFinal=function() {};
}

/* The global toolbar remains global. Split-specific page controls live inside their sheets. */
if (typeof installNotebookSplitToolbar==='function') {
  installNotebookSplitToolbar=function(root=$('#notebookDock')) {
    restoreNotebookSplitToolbar?.(root);
  };
}

/* Add stable IDs to the lightweight peer renderer so clicking it can promote the page into the full
   interaction renderer without losing which object/entry the user intended to touch. */
if (typeof notebookReferenceObjectElement==='function' && !window.__salesShopPeerObjectIds) {
  window.__salesShopPeerObjectIds=true;
  const _peerReferenceObject=notebookReferenceObjectElement;
  notebookReferenceObjectElement=function(object,step) {
    const rendered=_peerReferenceObject(object,step);
    if (rendered?.wrap) rendered.wrap.dataset.referenceObjectId=object.id;
    return rendered;
  };
}
if (typeof notebookReferenceEntryElement==='function' && !window.__salesShopPeerEntryIds) {
  window.__salesShopPeerEntryIds=true;
  const _peerReferenceEntry=notebookReferenceEntryElement;
  notebookReferenceEntryElement=function(entry,step,fallbackRow) {
    const rendered=_peerReferenceEntry(entry,step,fallbackRow);
    if (rendered?.el) rendered.el.dataset.referenceEntryId=entry.id;
    return rendered;
  };
}

function replayNotebookPeerIntent(intent) {
  if (!intent) return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if (intent.type==='table') {
      const wrap=document.querySelector(`#notebookDock [data-spatial-object-id="${CSS.escape?.(intent.objectId)||intent.objectId}"]`);
      const cell=wrap?.querySelector(`td[data-spatial-row="${intent.r}"][data-spatial-col="${intent.c}"]`);
      if (cell) {
        try { cell.focus({preventScroll:true}); } catch { cell.focus(); }
        cell.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:intent.x,clientY:intent.y}));
      }
      return;
    }
    if (intent.type==='object') {
      const wrap=document.querySelector(`#notebookDock [data-spatial-object-id="${CSS.escape?.(intent.objectId)||intent.objectId}"]`);
      wrap?.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:intent.x,clientY:intent.y}));
      return;
    }
    if (intent.type==='entry') {
      const entry=document.querySelector(`#notebookDock [data-entry-id="${CSS.escape?.(intent.entryId)||intent.entryId}"]`);
      const target=entry?.querySelector?.('.grid-note-text,.entry-text,[contenteditable="true"]') || entry;
      target?.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:intent.x,clientY:intent.y}));
      return;
    }
    const target=document.elementFromPoint(intent.x,intent.y);
    if (target?.closest?.('#notebookDock .notebook-page')) {
      target.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:intent.x,clientY:intent.y}));
    }
  }));
}

function bindNotebookPeerActivation(root=$('#notebookDock')) {
  const page=$('.notebook-reference-page',root);
  const ref=notebookPeerOtherRef();
  if (!page || !ref || page.dataset.peerActivationBound==='1') return;
  page.dataset.peerActivationBound='1';
  page.addEventListener('pointerdown',event=>{
    if (event.button!==0 || event.target.closest('.notebook-peer-local-actions,.notebook-binder-tabs')) return;
    const td=event.target.closest('td[data-reference-row][data-reference-col]');
    const object=event.target.closest('[data-reference-object-id]');
    const entry=event.target.closest('[data-reference-entry-id]');
    const intent=td&&object ? {
      type:'table',objectId:object.dataset.referenceObjectId,
      r:Number(td.dataset.referenceRow)||0,c:Number(td.dataset.referenceCol)||0,x:event.clientX,y:event.clientY
    } : object ? {type:'object',objectId:object.dataset.referenceObjectId,x:event.clientX,y:event.clientY}
      : entry ? {type:'entry',entryId:entry.dataset.referenceEntryId,x:event.clientX,y:event.clientY}
      : {type:'page',x:event.clientX,y:event.clientY};
    event.preventDefault();
    event.stopImmediatePropagation();
    activateNotebookPeerPage(ref);
    replayNotebookPeerIntent(intent);
  },true);
}

function installNotebookPeerPages(root=$('#notebookDock')) {
  if (!root) return;
  restoreNotebookSplitToolbar?.(root);
  notebookPeerApplyOrder(root);
  installNotebookPeerLocalActions(root);
  installNotebookBinderTabs(root);
  bindNotebookPeerActivation(root);
  $$('.notebook-paper-active-tab,.notebook-paper-peek',root).forEach(node=>node.remove());
}

if (!window.__salesShopPeerDismiss) {
  window.__salesShopPeerDismiss=true;
  document.addEventListener('pointerdown',event=>{
    if (event.target?.closest?.('.notebook-peer-style')) return;
    document.querySelectorAll('.notebook-peer-style.open').forEach(node=>node.classList.remove('open'));
  },true);
}

const _peerPagesRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _peerPagesRenderNotebook(root);
  if (!root) return;
  installNotebookPeerPages(root);
};

requestAnimationFrame(()=>installNotebookPeerPages($('#notebookDock')));
