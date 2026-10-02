/* Final Binder behavior model.
   Open pages and visible sheets are separate concepts:
   - up to four pages can remain open as tabs;
   - one visible sheet uses normal Notebook width;
   - two visible sheets form a Binder spread;
   - a left/right tab changes only that physical side;
   - page paper color is permanent page metadata;
   - tab switches get a small paper-opening transition. */

let notebookBinderTurnAnimation = null;

function binderFinalPageIds() {
  return new Set((notebookBinderOpenPages?.() || []).map(page=>page.id));
}

/* Unlike the earlier Binder implementation, do not automatically fill an empty second side just
   because another page is open. Hidden open pages remain represented by their tabs. */
notebookBinderSpread=function() {
  state.settings ||= {};
  const pages=notebookBinderOpenPages?.() || [];
  const ids=new Set(pages.map(page=>page.id));
  const active=notebookBinderActiveRef?.();
  let spread=Array.isArray(state.settings.notebookBinderSpread)
    ? state.settings.notebookBinderSpread.filter(id=>id && ids.has(id))
    : [];
  spread=[...new Set(spread)].slice(0,2);

  if (!spread.length && active?.id && ids.has(active.id)) spread=[active.id];
  if (active?.id && ids.has(active.id) && !spread.includes(active.id)) {
    if (spread.length>=2) {
      const slot=state.settings.notebookBinderActiveSide==='right' ? 1 : 0;
      spread[slot]=active.id;
    } else spread=[active.id];
    spread=[...new Set(spread.filter(Boolean))].slice(0,2);
  }

  state.settings.notebookBinderSpread=spread;
  return spread;
};

notebookBinderFacingRef=function() {
  const spread=notebookBinderSpread?.() || [];
  if (spread.length<2) return null;
  const active=notebookBinderActiveRef?.();
  const id=spread.find(item=>item!==active?.id);
  return id ? notebookBinderPageById?.(id) : null;
};

/* Legacy Reference state is now only a renderer compatibility pointer. It exists exactly when two
   sheets are visible; it never controls which pages remain open in the Binder. */
syncNotebookBinderLegacyState=function({persist=false}={}) {
  state.settings ||= {};
  const pages=notebookBinderOpenPages?.() || [];
  const active=notebookBinderActiveRef?.();
  const spread=notebookBinderSpread?.() || [];
  const facing=notebookBinderFacingRef?.();

  if (facing) state.settings.notebookReferencePage={key:facing.key,pageId:facing.pageId};
  else delete state.settings.notebookReferencePage;
  state.settings.notebookOpenPageOrder=[...spread];
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  if (active?.id && spread.includes(active.id)) {
    state.settings.notebookBinderActiveSide=spread.indexOf(active.id)===1?'right':'left';
  }
  if (persist) save();
  return {pages,active,spread,facing};
};

primeNotebookBinderIdentityForRender=function() {
  if (!currentNotebookPageId) {
    const working=typeof notebookWorkingPageState==='function' ? notebookWorkingPageState() : null;
    if (working?.key && working?.pageId) {
      currentNotebookDate=working.key;
      currentNotebookPageId=working.pageId;
    } else if (currentNotebookDate) {
      currentNotebookPageId=notebookPageState?.()[currentNotebookDate] || ensureNotebookPage?.(currentNotebookDate) || null;
    }
  }
  notebookBinderSpread?.();
  syncNotebookBinderLegacyState?.({persist:false});
};

function markBinderTurn(ref,side) {
  if (!ref?.id) return;
  notebookBinderTurnAnimation={id:ref.id,side:side==='right'?'right':'left',at:performance.now()};
}

/* A side-tab affects only the requested side. If that page was visible across the Binder, moving it
   to the requested side hides the displaced page rather than swapping both sheets. Both displaced
   pages remain open as tabs. */
notebookBinderOpenPageOnSide=function(ref,side,{record=true}={}) {
  ref=binderNormalizeRef?.(ref);
  if (!ref) return;
  const pages=notebookBinderOpenPages?.() || [];
  if (!pages.some(page=>page.id===ref.id)) return;

  const target=side==='right'?1:0;
  const other=target===0?1:0;
  let spread=[...(notebookBinderSpread?.() || [])];

  if (spread.length===0) {
    spread=[ref.id];
  } else if (spread.length===1) {
    if (spread[0]!==ref.id) spread=target===0 ? [ref.id,spread[0]] : [spread[0],ref.id];
  } else if (spread[target]===ref.id) {
    /* Already on the requested side; only promote it to the full renderer. */
  } else if (spread[other]===ref.id) {
    /* Move this page to the requested side without moving the displaced sheet across the Binder. */
    spread=[ref.id];
  } else {
    spread[target]=ref.id;
  }

  spread=[...new Set(spread.filter(Boolean))].slice(0,2);
  state.settings ||= {};
  state.settings.notebookBinderSpread=spread;
  state.settings.notebookOpenPageOrder=[...spread];
  state.settings.notebookBinderActiveSide=spread.length===2 && spread.indexOf(ref.id)===1?'right':'left';
  notebookPageState()[ref.key]=ref.pageId;
  setNotebookWorkingPage?.(ref.key,ref.pageId,{record,kind:`binder-${side}-tab`});
  currentNotebookDate=ref.key;
  currentNotebookPageId=ref.pageId;
  markBinderTurn(ref,side);
  syncNotebookBinderLegacyState?.({persist:true});
  renderAll();
};

/* Clicking the lightweight visible sheet merely promotes that page. It never changes the spread. */
binderSetActivePage=function(ref,{record=true}={}) {
  ref=binderNormalizeRef?.(ref);
  if (!ref) return;
  const pages=notebookBinderOpenPages?.() || [];
  if (!pages.some(page=>page.id===ref.id)) return;
  let spread=notebookBinderSpread?.() || [];
  if (!spread.includes(ref.id)) {
    if (spread.length>=2) {
      const slot=state.settings?.notebookBinderActiveSide==='right'?1:0;
      spread[slot]=ref.id;
    } else spread=[ref.id];
    state.settings.notebookBinderSpread=[...new Set(spread.filter(Boolean))].slice(0,2);
  }
  notebookPageState()[ref.key]=ref.pageId;
  setNotebookWorkingPage?.(ref.key,ref.pageId,{record,kind:'binder-page'});
  currentNotebookDate=ref.key;
  currentNotebookPageId=ref.pageId;
  const finalSpread=notebookBinderSpread?.() || [];
  if (finalSpread.length===2) state.settings.notebookBinderActiveSide=finalSpread.indexOf(ref.id)===1?'right':'left';
  syncNotebookBinderLegacyState?.({persist:true});
  renderAll();
};
activateNotebookPeerPage=function(ref,{record=true}={}) { binderSetActivePage(ref,{record}); };

swapNotebookBinderSpread=function() {
  const spread=notebookBinderSpread?.() || [];
  if (spread.length<2) return;
  state.settings.notebookBinderSpread=[spread[1],spread[0]];
  state.settings.notebookOpenPageOrder=[spread[1],spread[0]];
  const active=notebookBinderActiveRef?.();
  if (active?.id) state.settings.notebookBinderActiveSide=state.settings.notebookBinderSpread.indexOf(active.id)===1?'right':'left';
  save();
  renderAll();
};
swapNotebookPeerLocations=swapNotebookBinderSpread;
swapNotebookReferencePage=swapNotebookBinderSpread;

/* Closing a visible page does not pull a hidden tab into the empty slot. The surviving visible sheet
   becomes a full-width Notebook page while all other open pages remain available as tabs. */
closeNotebookBinderPage=function(ref) {
  ref=binderNormalizeRef?.(ref);
  if (!ref) return;
  let pages=notebookBinderOpenPages?.() || [];
  if (!pages.some(page=>page.id===ref.id)) return;
  const active=notebookBinderActiveRef?.();
  let spread=(notebookBinderSpread?.() || []).filter(id=>id!==ref.id);
  pages=pages.filter(page=>page.id!==ref.id);

  if (!pages.length) {
    const today=dateKey();
    const pageId=notebookPageState()[today] || ensureNotebookPage(today);
    pages=[binderNormalizeRef({key:today,pageId})];
  }

  let next=active && active.id!==ref.id ? pages.find(page=>page.id===active.id) : null;
  if (!next) next=spread.length ? pages.find(page=>page.id===spread[0]) : pages[0];
  if (!spread.length && next) spread=[next.id];

  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  state.settings.notebookBinderSpread=[...new Set(spread.filter(Boolean))].slice(0,2);
  if (next && active?.id===ref.id) {
    notebookPageState()[next.key]=next.pageId;
    setNotebookWorkingPage?.(next.key,next.pageId,{record:true,kind:'binder-close'});
    currentNotebookDate=next.key;
    currentNotebookPageId=next.pageId;
  }
  syncNotebookBinderLegacyState?.({persist:true});
  renderAll();
};
closeNotebookPeerPage=closeNotebookBinderPage;
clearNotebookReferencePage=function() {
  const facing=notebookBinderFacingRef?.();
  if (facing) closeNotebookBinderPage(facing);
};

/* If an already-open hidden page is chosen from History/Favorites, surface it on the current side
   without forcing the other visible sheet to move. */
const _binderFinalOpenPageInBinder=typeof openNotebookPageInBinder==='function' ? openNotebookPageInBinder : null;
if (_binderFinalOpenPageInBinder) {
  openNotebookPageInBinder=function(key,pageId) {
    const ref=binderNormalizeRef?.({key,pageId});
    if (!ref) return;
    let pages=notebookBinderOpenPages?.() || [];
    const existing=pages.find(page=>page.id===ref.id);
    if (existing) {
      closeModal?.();
      const side=(state.settings?.notebookBinderActiveSide==='right')?'right':'left';
      notebookBinderOpenPageOnSide(existing,side,{record:true});
      return;
    }
    if (pages.length>=NOTEBOOK_BINDER_MAX_PAGES) {
      toast(`Binder can hold up to ${NOTEBOOK_BINDER_MAX_PAGES} open pages.`);
      return;
    }
    pages.push(ref);
    state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
    const spread=notebookBinderSpread?.() || [];
    if (spread.length<2) {
      const side=spread.length===1 ? (state.settings?.notebookBinderActiveSide==='right'?'left':'right') : 'left';
      state.settings.notebookBinderSpread=side==='left' ? [ref.id,...spread] : [...spread,ref.id];
    }
    syncNotebookBinderLegacyState?.({persist:true});
    closeModal?.();
    renderAll();
    toast(spread.length<2?'Page added to Binder spread':'Page added to Binder tabs');
  };
  setNotebookReferencePage=function(key,pageId) { openNotebookPageInBinder(key,pageId); };
}

/* Both rails are positioned from live sheet geometry, so tabs sit exactly outside the paper edge in
   single-page and split-page layouts rather than overlapping/clipping the paper. */
notebookBinderRailTab=function(ref,index,side,spread,active) {
  const single=spread.length===1;
  const sideIndex=side==='right'?1:0;
  const otherIndex=sideIndex===0?1:0;
  const onThisSide=single ? spread[0]===ref.id : spread[sideIndex]===ref.id;
  const onOtherSide=!single && spread[otherIndex]===ref.id;
  const button=document.createElement('button');
  button.type='button';
  button.className=`notebook-binder-side-tab${onThisSide?' on-this-side':''}${onOtherSide?' on-other-side':''}${active?.id===ref.id?' renderer-active':''}`;
  button.dataset.binderPage=ref.id;
  button.dataset.binderRailSide=side;
  button.dataset.paperColor=notebookPagePaperColorFinal?.(ref.key,ref.pageId) || notebookDefaultPagePaperColor?.() || 'warm';
  button.title=`${notebookPeerPageTitle?.(ref)||ref.key} — open on ${side}`;
  button.setAttribute('aria-label',button.title);
  button.innerHTML=`<span class="notebook-binder-side-tab-index">${index+1}</span><span class="notebook-binder-side-tab-label">${escapeHtml(notebookPeerPageTitle?.(ref)||ref.key)}</span>`;
  button.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    notebookBinderOpenPageOnSide(ref,side,{record:true});
  };
  return button;
};

function positionNotebookBinderRails(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  const leftRail=$('.notebook-binder-side-rail-left',shell);
  const rightRail=$('.notebook-binder-side-rail-right',shell);
  if (!shell || !leftRail || !rightRail) return;
  const pair=$('.notebook-page-pair',shell);
  const sheets=pair
    ? $$(':scope > .notebook-page,:scope > .notebook-reference-page',pair)
    : [$('.notebook-page',shell)].filter(Boolean);
  if (!sheets.length) return;
  const shellRect=shell.getBoundingClientRect();
  const rects=sheets.map(sheet=>sheet.getBoundingClientRect()).filter(rect=>rect.width>0);
  if (!rects.length) return;
  const left=Math.min(...rects.map(rect=>rect.left))-shellRect.left;
  const right=Math.max(...rects.map(rect=>rect.right))-shellRect.left;
  const top=Math.min(...rects.map(rect=>rect.top))-shellRect.top+82;
  leftRail.style.left=`${Math.round(left)}px`;
  rightRail.style.left=`${Math.round(right)}px`;
  leftRail.style.top=rightRail.style.top=`${Math.max(52,Math.round(top))}px`;
}

installNotebookBinderDualRails=function(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  const pages=notebookBinderOpenPages?.() || [];
  if (!shell) return;
  $$('.notebook-binder-side-rail',shell).forEach(node=>node.remove());
  $('.notebook-binder-tabs-final',shell)?.remove();
  if (pages.length<=1) return;
  const spread=notebookBinderSpread?.() || [];
  const active=notebookBinderActiveRef?.();
  ['left','right'].forEach(side=>{
    const rail=document.createElement('nav');
    rail.className=`notebook-binder-side-rail notebook-binder-side-rail-${side}`;
    rail.dataset.binderRailSide=side;
    rail.setAttribute('aria-label',`${side==='left'?'Left':'Right'} Binder page tabs`);
    pages.forEach((ref,index)=>rail.appendChild(notebookBinderRailTab(ref,index,side,spread,active)));
    shell.appendChild(rail);
  });
  requestAnimationFrame(()=>positionNotebookBinderRails(root));
};
installNotebookBinderTabsFinal=function(root=$('#notebookDock')) { installNotebookBinderDualRails(root); };
installNotebookBinderTabs=function(root=$('#notebookDock')) { installNotebookBinderDualRails(root); };

function enforceNotebookPageColorIdentity(root=$('#notebookDock')) {
  if (!root) return;
  const active=notebookBinderActiveRef?.();
  const facing=notebookBinderFacingRef?.();
  if (active?.key && active?.pageId) {
    const color=notebookPagePaperColorFinal?.(active.key,active.pageId) || 'warm';
    const current=$('.notebook-page',root);
    if (current) current.dataset.pagePaperColor=color;
  }
  if (facing?.key && facing?.pageId) {
    const color=notebookPagePaperColorFinal?.(facing.key,facing.pageId) || 'warm';
    const other=$('.notebook-reference-page',root);
    if (other) other.dataset.pagePaperColor=color;
  }
  $$('.notebook-binder-side-tab[data-binder-page]',root).forEach(tab=>{
    const ref=notebookBinderPageById?.(tab.dataset.binderPage);
    if (ref) tab.dataset.paperColor=notebookPagePaperColorFinal?.(ref.key,ref.pageId) || 'warm';
  });
}

function normalizeNotebookBinderTitles(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  const current=$('.notebook-page',shell);
  if (current) {
    const date=$('.notebook-date',current);
    const header=$('.notebook-page-header',current);
    const side=current.dataset.peerSide || ((notebookBinderSpread?.()||[]).length<2?'left':'');
    const blankHeader=!String(header?.textContent||'').trim();
    current.classList.toggle('binder-date-title-fallback',side==='left' && blankHeader);
    if (date && side==='left' && blankHeader) date.hidden=false;
  }
}

function applyBinderVisibleState(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  const pages=notebookBinderOpenPages?.() || [];
  const spread=notebookBinderSpread?.() || [];
  shell.dataset.binderOpenCount=String(pages.length);
  shell.dataset.binderVisibleCount=String(Math.max(1,spread.length));
  shell.classList.toggle('notebook-binder-tabs-open',pages.length>1);
  shell.classList.toggle('notebook-binder-single-visible',pages.length>1 && spread.length<=1);
}

function applyBinderTurnAnimation(root=$('#notebookDock')) {
  const turn=notebookBinderTurnAnimation;
  if (!turn || performance.now()-turn.at>1200) return;
  const active=notebookBinderActiveRef?.();
  const facing=notebookBinderFacingRef?.();
  let sheet=null;
  if (active?.id===turn.id) sheet=$('.notebook-page',root);
  else if (facing?.id===turn.id) sheet=$('.notebook-reference-page',root);
  if (!sheet) return;
  notebookBinderTurnAnimation=null;
  sheet.classList.remove('binder-sheet-opening','binder-sheet-opening-left','binder-sheet-opening-right');
  void sheet.offsetWidth;
  sheet.classList.add('binder-sheet-opening',turn.side==='right'?'binder-sheet-opening-right':'binder-sheet-opening-left');
  sheet.addEventListener('animationend',()=>sheet.classList.remove('binder-sheet-opening','binder-sheet-opening-left','binder-sheet-opening-right'),{once:true});
}

function installBinderBehaviorFinal(root=$('#notebookDock')) {
  if (!root) return;
  syncNotebookBinderLegacyState?.({persist:false});
  notebookPeerApplyOrder?.(root);
  applyBinderVisibleState(root);
  installNotebookPeerLocalActions?.(root);
  installNotebookBinderDualRails(root);
  enforceNotebookPageColorIdentity(root);
  normalizeNotebookBinderTitles(root);
  requestAnimationFrame(()=>{
    positionNotebookBinderRails(root);
    applyBinderTurnAnimation(root);
  });
}

if (!window.__salesShopBinderRailResizeFinal) {
  window.__salesShopBinderRailResizeFinal=true;
  let raf=0;
  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>positionNotebookBinderRails($('#notebookDock')));
  };
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('fullscreenchange',schedule);
}

const _binderBehaviorFinalRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  primeNotebookBinderIdentityForRender();
  _binderBehaviorFinalRender(root);
  if (!root) return;
  installBinderBehaviorFinal(root);
};

requestAnimationFrame(()=>installBinderBehaviorFinal($('#notebookDock')));
