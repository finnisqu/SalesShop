/* Final Binder / Notebook physical model.
   - One open page = Notebook.
   - 2–4 open pages = Binder with a persistent left tab rail.
   - Binder shows a two-page spread; additional open pages remain one tab click away.
   - Either visible page can become the full interaction renderer while keeping its physical slot.
   - Page-local controls are a quiet 2x2 icon cluster: Favorite / Style / Swap / Close.
   - Lock is History-only; locked open pages show a marker beside the page title.
   - Shift+click extends a spreadsheet selection from its anchor cell. */

const NOTEBOOK_BINDER_MAX_PAGES=4;

function binderRefId(ref) {
  return ref?.key && ref?.pageId ? `${ref.key}::${ref.pageId}` : '';
}
function binderRefFromId(id) {
  const text=String(id||'');
  const split=text.indexOf('::');
  if (split<0) return null;
  const key=text.slice(0,split),pageId=text.slice(split+2);
  return key&&pageId ? {key,pageId,id:text} : null;
}
function binderNormalizeRef(ref) {
  if (!ref?.key || !ref?.pageId) return null;
  return {key:ref.key,pageId:ref.pageId,id:binderRefId(ref)};
}
function notebookBinderOpenPages() {
  state.settings ||= {};
  const current=binderNormalizeRef({key:currentNotebookDate,pageId:currentNotebookPageId});
  const legacy=binderNormalizeRef(state.settings.notebookReferencePage);
  let raw=Array.isArray(state.settings.notebookBinderOpenPages) ? state.settings.notebookBinderOpenPages : [];
  let pages=raw.map(binderNormalizeRef).filter(Boolean);

  /* Migrate the earlier two-page order/reference state into the Binder once. */
  if (!pages.length) {
    const oldOrder=Array.isArray(state.settings.notebookOpenPageOrder) ? state.settings.notebookOpenPageOrder : [];
    pages=oldOrder.map(binderRefFromId).filter(Boolean);
    if (current && !pages.some(page=>page.id===current.id)) pages.unshift(current);
    if (legacy && !pages.some(page=>page.id===legacy.id)) pages.push(legacy);
  }
  if (current && !pages.some(page=>page.id===current.id)) pages.unshift(current);
  if (legacy && !pages.some(page=>page.id===legacy.id)) pages.push(legacy);

  const seen=new Set();
  pages=pages.filter(page=>page?.id && !seen.has(page.id) && seen.add(page.id)).slice(0,NOTEBOOK_BINDER_MAX_PAGES);
  if (!pages.length && current) pages=[current];
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  return pages;
}
function notebookBinderPageById(id) {
  return notebookBinderOpenPages().find(page=>page.id===id) || null;
}
function notebookBinderActiveRef() {
  return binderNormalizeRef({key:currentNotebookDate,pageId:currentNotebookPageId});
}
function notebookBinderSpread() {
  state.settings ||= {};
  const pages=notebookBinderOpenPages();
  const ids=new Set(pages.map(page=>page.id));
  const active=notebookBinderActiveRef();
  let spread=Array.isArray(state.settings.notebookBinderSpread) ? state.settings.notebookBinderSpread.filter(id=>ids.has(id)) : [];

  if (active && !spread.includes(active.id)) {
    if (spread.length>=2) {
      const activeSide=state.settings.notebookBinderActiveSide==='right' ? 1 : 0;
      spread[activeSide]=active.id;
    } else spread.unshift(active.id);
  }
  pages.forEach(page=>{ if (spread.length<2 && !spread.includes(page.id)) spread.push(page.id); });
  spread=[...new Set(spread)].slice(0,2);
  if (active && spread.includes(active.id)) state.settings.notebookBinderActiveSide=spread.indexOf(active.id)===1?'right':'left';
  state.settings.notebookBinderSpread=spread;
  return spread;
}
function notebookBinderFacingRef() {
  const active=notebookBinderActiveRef();
  const spread=notebookBinderSpread();
  const id=spread.find(item=>item!==active?.id);
  return id ? notebookBinderPageById(id) : null;
}
function syncNotebookBinderLegacyState({persist=false}={}) {
  const pages=notebookBinderOpenPages();
  const active=notebookBinderActiveRef();
  const spread=notebookBinderSpread();
  const facing=notebookBinderFacingRef();

  if (facing) state.settings.notebookReferencePage={key:facing.key,pageId:facing.pageId};
  else delete state.settings.notebookReferencePage;

  /* Older peer CSS/order helpers still read this two-item array. Keep it as the physical spread. */
  state.settings.notebookOpenPageOrder=[...spread];
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  if (active && spread.includes(active.id)) state.settings.notebookBinderActiveSide=spread.indexOf(active.id)===1?'right':'left';
  if (persist) save();
  return {pages,active,spread,facing};
}

/* The peer helpers now read the generalized Binder state. */
notebookPeerRefById=function(id) { return notebookBinderPageById(id); };
ensureNotebookPeerOrder=function() { return [...notebookBinderSpread()]; };

function binderSetActivePage(ref,{record=true,keepSlot=true}={}) {
  ref=binderNormalizeRef(ref);
  if (!ref) return;
  const pages=notebookBinderOpenPages();
  if (!pages.some(page=>page.id===ref.id)) return;
  const previous=notebookBinderActiveRef();
  let spread=notebookBinderSpread();

  if (!spread.includes(ref.id)) {
    let slot=0;
    if (keepSlot && previous && spread.includes(previous.id)) slot=spread.indexOf(previous.id);
    else if (state.settings?.notebookBinderActiveSide==='right') slot=1;
    spread[slot]=ref.id;
    spread=[...new Set(spread)].slice(0,2);
    pages.forEach(page=>{ if (spread.length<2 && !spread.includes(page.id)) spread.push(page.id); });
    state.settings.notebookBinderSpread=spread;
  }

  notebookPageState()[ref.key]=ref.pageId;
  setNotebookWorkingPage?.(ref.key,ref.pageId,{record,kind:'binder-tab'});
  currentNotebookDate=ref.key;
  currentNotebookPageId=ref.pageId;
  state.settings.notebookBinderActiveSide=spread.indexOf(ref.id)===1?'right':'left';
  syncNotebookBinderLegacyState({persist:true});
  renderAll();
}

/* Clicking a visible peer or Binder tab activates that page without changing its physical side. */
activateNotebookPeerPage=function(ref,{record=true}={}) {
  binderSetActivePage(ref,{record,keepSlot:true});
};

function openNotebookPageInBinder(key,pageId) {
  const ref=binderNormalizeRef({key,pageId});
  if (!ref) return;
  let pages=notebookBinderOpenPages();
  const existing=pages.find(page=>page.id===ref.id);
  if (existing) {
    closeModal?.();
    binderSetActivePage(existing,{record:true,keepSlot:true});
    return;
  }
  if (pages.length>=NOTEBOOK_BINDER_MAX_PAGES) {
    toast(`Binder can hold up to ${NOTEBOOK_BINDER_MAX_PAGES} open pages.`);
    return;
  }
  const active=notebookBinderActiveRef();
  pages.push(ref);
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  let spread=notebookBinderSpread();
  if (spread.length<2) spread.push(ref.id);
  else {
    const activeSlot=active && spread.includes(active.id) ? spread.indexOf(active.id) : 0;
    spread[activeSlot===0?1:0]=ref.id;
  }
  state.settings.notebookBinderSpread=[...new Set(spread)].slice(0,2);
  syncNotebookBinderLegacyState({persist:true});
  closeModal?.();
  renderAll();
  toast('Page added to Binder');
}

/* History's existing Reference/Open action now adds pages to the Binder instead of replacing one slot. */
setNotebookReferencePage=function(key,pageId) {
  openNotebookPageInBinder(key,pageId);
};

function swapNotebookBinderSpread() {
  const spread=notebookBinderSpread();
  if (spread.length<2) return;
  state.settings.notebookBinderSpread=[spread[1],spread[0]];
  state.settings.notebookOpenPageOrder=[spread[1],spread[0]];
  const active=notebookBinderActiveRef();
  if (active) state.settings.notebookBinderActiveSide=state.settings.notebookBinderSpread.indexOf(active.id)===1?'right':'left';
  save();
  renderAll();
}
swapNotebookPeerLocations=swapNotebookBinderSpread;
swapNotebookReferencePage=swapNotebookBinderSpread;

function closeNotebookBinderPage(ref) {
  ref=binderNormalizeRef(ref);
  if (!ref) return;
  let pages=notebookBinderOpenPages();
  if (!pages.some(page=>page.id===ref.id)) return;
  const active=notebookBinderActiveRef();
  let spread=notebookBinderSpread();
  const closingActive=active?.id===ref.id;
  const closedSlot=spread.indexOf(ref.id);
  pages=pages.filter(page=>page.id!==ref.id);
  spread=spread.filter(id=>id!==ref.id);

  if (!pages.length) {
    /* Never leave the notebook with no page identity. */
    const today=dateKey();
    const pageId=notebookPageState()[today] || ensureNotebookPage(today);
    pages=[binderNormalizeRef({key:today,pageId})];
  }

  pages.forEach(page=>{ if (spread.length<Math.min(2,pages.length) && !spread.includes(page.id)) spread.push(page.id); });
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  state.settings.notebookBinderSpread=spread.slice(0,2);

  if (closingActive) {
    const nextId=(closedSlot>=0 ? state.settings.notebookBinderSpread[Math.min(closedSlot,state.settings.notebookBinderSpread.length-1)] : null)
      || state.settings.notebookBinderSpread[0]
      || pages[0].id;
    const next=pages.find(page=>page.id===nextId) || pages[0];
    notebookPageState()[next.key]=next.pageId;
    setNotebookWorkingPage?.(next.key,next.pageId,{record:true,kind:'binder-close'});
    currentNotebookDate=next.key;
    currentNotebookPageId=next.pageId;
  }
  syncNotebookBinderLegacyState({persist:true});
  renderAll();
}
closeNotebookPeerPage=closeNotebookBinderPage;
clearNotebookReferencePage=function() {
  const facing=notebookBinderFacingRef();
  if (facing) closeNotebookBinderPage(facing);
};

/* Add row/column identity to the lightweight facing table so the first cell click can be replayed
   after that page becomes the full renderer. */
if (typeof notebookReferenceTable==='function' && !window.__salesShopBinderReferenceCellCoords) {
  window.__salesShopBinderReferenceCellCoords=true;
  const _binderReferenceTable=notebookReferenceTable;
  notebookReferenceTable=function(object) {
    const table=_binderReferenceTable(object);
    const occupied=[];
    Array.from(table.rows||[]).forEach((tr,r)=>{
      occupied[r] ||= [];
      let c=0;
      Array.from(tr.cells||[]).forEach(td=>{
        while (occupied[r][c]) c++;
        td.dataset.referenceRow=String(r);
        td.dataset.referenceCol=String(c);
        const rowSpan=Math.max(1,Number(td.rowSpan)||1),colSpan=Math.max(1,Number(td.colSpan)||1);
        for (let rr=r;rr<r+rowSpan;rr++) {
          occupied[rr] ||= [];
          for (let cc=c;cc<c+colSpan;cc++) occupied[rr][cc]=true;
        }
        c+=colSpan;
      });
    });
    return table;
  };
}

function binderIconSvg(kind) {
  if (kind==='style') return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.8c3.9 0 6.7 2.2 6.7 5.1 0 2.1-1.5 3-3.1 3h-1.2c-.8 0-1.2.6-.9 1.3.5 1.2-.2 2.7-1.7 3.5-1 .5-2.3.7-3.5.3-3-.9-4.9-3.3-4.9-6.1 0-3.9 3.8-7.1 8.6-7.1Z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6" cy="7" r="1" fill="currentColor"/><circle cx="9.3" cy="5.7" r="1" fill="currentColor"/><circle cx="12.8" cy="6.5" r="1" fill="currentColor"/></svg>';
  if (kind==='swap') return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h10.5M12 3.5 14.5 6 12 8.5M16 14H5.5M8 11.5 5.5 14 8 16.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if (kind==='close') return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/></svg>';
  return '';
}

function binderStyleControl(ref) {
  const wrap=document.createElement('div');
  wrap.className='notebook-peer-style notebook-binder-style';
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='notebook-peer-local-button notebook-binder-grid-button notebook-peer-style-trigger';
  trigger.innerHTML=binderIconSvg('style');
  trigger.title='Page style';
  trigger.setAttribute('aria-label','Page style');
  const menu=document.createElement('div');
  menu.className='notebook-peer-style-menu';
  const active=notebookPeerPageColor?.(ref,ref.id===notebookBinderActiveRef()?.id?'warm':'blue') || 'warm';
  [['warm','Warm'],['blue','Blue'],['neutral','Neutral']].forEach(([color,label])=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=`notebook-peer-style-choice${active===color?' active':''}`;
    button.innerHTML=`<span class="notebook-peer-style-swatch swatch-${color}"></span><span>${label}</span>`;
    button.onclick=event=>{event.preventDefault();event.stopPropagation();setNotebookPagePaperColorFinal?.(ref.key,ref.pageId,color);};
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

function binderFavoriteButton(ref) {
  const active=!!notebookPageFavorite?.(ref.key,ref.pageId);
  const button=document.createElement('button');
  button.type='button';
  button.className=`notebook-peer-local-button notebook-binder-grid-button notebook-peer-favorite${active?' active':''}`;
  button.innerHTML=notebookMetaIcon?.('favorite',active) || '★';
  button.title=active?'Remove from Favorites':'Favorite page';
  button.setAttribute('aria-label',button.title);
  button.onclick=event=>{event.preventDefault();event.stopPropagation();setNotebookPageFavorite?.(ref.key,ref.pageId,!active);renderAll();};
  return button;
}
function binderSimpleIconButton(kind,ref) {
  const button=document.createElement('button');
  button.type='button';
  button.className=`notebook-peer-local-button notebook-binder-grid-button notebook-peer-${kind}`;
  button.innerHTML=binderIconSvg(kind);
  if (kind==='swap') {
    button.title='Swap visible page positions';button.setAttribute('aria-label',button.title);
    button.onclick=event=>{event.preventDefault();event.stopPropagation();swapNotebookBinderSpread();};
  } else {
    button.title='Close this page';button.setAttribute('aria-label',button.title);
    button.onclick=event=>{event.preventDefault();event.stopPropagation();closeNotebookBinderPage(ref);};
  }
  return button;
}
function buildBinderPageActions(ref,{binder=false}={}) {
  const actions=document.createElement('div');
  actions.className=`notebook-peer-local-actions notebook-binder-local-actions${binder?' binder-grid':''}`;
  actions.dataset.peerLocalActions=ref.id;
  actions.append(binderFavoriteButton(ref),binderStyleControl(ref));
  if (binder) actions.append(binderSimpleIconButton('swap',ref),binderSimpleIconButton('close',ref));
  return actions;
}

function installBinderLockedMarker(head,ref) {
  if (!head || !ref) return;
  $('.notebook-open-locked-marker',head)?.remove();
  if (!notebookPageLocked?.(ref.key,ref.pageId)) return;
  const marker=document.createElement('span');
  marker.className='notebook-open-locked-marker';
  marker.title='Locked page';
  marker.setAttribute('aria-label','Locked page');
  marker.innerHTML=notebookMetaIcon?.('lock',true) || '🔒';
  const title=head.querySelector('.notebook-date,.notebook-reference-date,.notebook-page-header,.notebook-reference-page-header');
  if (title) title.insertAdjacentElement('beforebegin',marker);
  else head.prepend(marker);
}

installNotebookPeerLocalActions=function(root=$('#notebookDock')) {
  if (!root) return;
  const active=notebookBinderActiveRef();
  const facing=notebookBinderFacingRef();
  const pages=notebookBinderOpenPages();
  const binder=pages.length>1;
  $$('[data-notebook-page-favorite],[data-notebook-page-lock]',root).forEach(node=>node.remove());

  const currentHead=$('.notebook-page-pair > .notebook-page .notebook-paper-head',root) || $('.notebook-page .notebook-paper-head',root);
  if (currentHead && active) {
    $('[data-peer-local-actions]',currentHead)?.remove();
    currentHead.appendChild(buildBinderPageActions(active,{binder}));
    installBinderLockedMarker(currentHead,active);
  }
  const referencePage=$('.notebook-reference-page',root);
  const referenceHead=$('.notebook-reference-head',referencePage);
  if (referenceHead && facing) {
    $('.notebook-reference-actions',referenceHead)?.remove();
    $('[data-peer-local-actions]',referenceHead)?.remove();
    referenceHead.appendChild(buildBinderPageActions(facing,{binder:true}));
    installBinderLockedMarker(referenceHead,facing);
  }
};

function installNotebookBinderTabsFinal(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  const pair=$('.notebook-page-pair',root);
  const pages=notebookBinderOpenPages();
  shell?.classList.toggle('notebook-binder-mode',pages.length>1);
  shell?.classList.toggle('notebook-single-mode',pages.length<=1);
  $('.notebook-binder-tabs',root)?.remove();
  if (!pair || pages.length<=1) return;

  const active=notebookBinderActiveRef();
  const spread=notebookBinderSpread();
  const tabs=document.createElement('nav');
  tabs.className='notebook-binder-tabs notebook-binder-tabs-final';
  tabs.setAttribute('aria-label','Open notebook pages');
  pages.forEach((ref,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=`notebook-binder-tab${active?.id===ref.id?' active':''}${spread.includes(ref.id)?' in-spread':''}`;
    button.dataset.binderPage=ref.id;
    button.dataset.paperColor=notebookPeerPageColor?.(ref,index===0?'warm':'blue') || 'warm';
    button.title=notebookPeerPageTitle?.(ref) || ref.key;
    button.innerHTML=`<span class="notebook-binder-tab-index">${index+1}</span><span class="notebook-binder-tab-title">${escapeHtml(notebookPeerPageTitle?.(ref)||ref.key)}</span>`;
    button.onclick=event=>{event.preventDefault();event.stopPropagation();binderSetActivePage(ref,{record:true,keepSlot:true});};
    tabs.appendChild(button);
  });
  pair.appendChild(tabs);
}
installNotebookBinderTabs=installNotebookBinderTabsFinal;

/* Apply physical left/right ownership from Binder spread, not Current/Reference role. */
notebookPeerApplyOrder=function(root=$('#notebookDock')) {
  const pair=$('.notebook-page-pair',root);
  if (!pair) return;
  const active=notebookBinderActiveRef(),facing=notebookBinderFacingRef(),spread=notebookBinderSpread();
  const currentPage=$(':scope > .notebook-page',pair),otherPage=$(':scope > .notebook-reference-page',pair);
  if (!active || !facing || !currentPage || !otherPage) return;
  currentPage.dataset.peerPageId=active.id;
  currentPage.dataset.peerSide=spread.indexOf(active.id)===1?'right':'left';
  currentPage.dataset.peerActive='true';
  otherPage.dataset.peerPageId=facing.id;
  otherPage.dataset.peerSide=spread.indexOf(facing.id)===1?'right':'left';
  otherPage.dataset.peerActive='false';
  pair.dataset.peerActiveSide=currentPage.dataset.peerSide;
};

/* Shift+click behaves like Sheets: preserve the anchor and extend the rectangular selection. */
if (!window.__salesShopShiftClickTableRange) {
  window.__salesShopShiftClickTableRange=true;
  document.addEventListener('pointerdown',event=>{
    if (!event.shiftKey || event.button!==0) return;
    const td=event.target?.closest?.('#notebookDock .spatial-object-table td');
    if (!td || td.classList.contains('spreadsheet-cell-editing')) return;
    const wrap=td.closest('.spatial-object-table');
    const object=spatialObjectById?.(wrap?.dataset?.spatialObjectId);
    const table=wrap?.querySelector('.spatial-table');
    if (!object || !table) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.getSelection()?.removeAllRanges();
    const end={r:Number(td.dataset.spatialRow)||0,c:Number(td.dataset.spatialCol)||0};
    const existing=activeSpatialTableSelection?.objectId===object.id ? activeSpatialTableSelection : null;
    const start=existing ? {...existing.start} : {...end};
    activeSpatialTableSelection={objectId:object.id,start,end};
    selectedSpatialObjectId=object.id;
    if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
    wrap.classList.add('is-selected','format-open');
    paintSpatialTableSelection?.(table,object);
    decorateSpreadsheetSelection?.(table,object);
    const controls=wrap.querySelector('.spatial-table-controls');
    if (controls && typeof advancedSpatialTableControls==='function') controls.replaceWith(advancedSpatialTableControls(object));
    requestAnimationFrame(()=>renderSpreadsheetFillHandle?.(wrap,object,table));
  },true);
}

/* Medium/Full are explicit stable modes even after Float and Binder layers have wrapped width logic. */
if (!window.__salesShopBinderPresentationFix) {
  window.__salesShopBinderPresentationFix=true;
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#notebookDock [data-notebook-width="medium"],#notebookDock [data-notebook-width="full"]');
    if (!button) return;
    state.settings ||= {};
    state.settings.notebookWidthMode=button.dataset.notebookWidth;
    save();
    requestAnimationFrame(()=>{
      applyNotebookWidthMode?.($('#notebookDock'));
      installNotebookBinderFinal($('#notebookDock'));
    });
  },true);
}

function installNotebookBinderFinal(root=$('#notebookDock')) {
  if (!root) return;
  syncNotebookBinderLegacyState({persist:false});
  const shell=$('.notebook-shell',root);
  const pages=notebookBinderOpenPages();
  shell?.classList.toggle('notebook-binder-mode',pages.length>1);
  shell?.classList.toggle('notebook-single-mode',pages.length<=1);
  restoreNotebookSplitToolbar?.(root);
  notebookPeerApplyOrder(root);
  installNotebookPeerLocalActions(root);
  installNotebookBinderTabsFinal(root);
  bindNotebookPeerActivation?.(root);
  $$('.notebook-paper-active-tab,.notebook-paper-peek',root).forEach(node=>node.remove());
}

const _binderFinalRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  syncNotebookBinderLegacyState({persist:false});
  _binderFinalRenderNotebook(root);
  if (!root) return;
  installNotebookBinderFinal(root);
};

requestAnimationFrame(()=>installNotebookBinderFinal($('#notebookDock')));
