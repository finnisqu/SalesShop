/* Dual Binder tab rails + final spreadsheet range presentation.
   - Every open Binder page has a tab on both the left and right rails.
   - Clicking a rail chooses which physical side that page occupies.
   - Tabs read persistent page color metadata only.
   - Shift/drag range selection gets one quiet Sheets-like outer outline.
   - Persisted Binder pages are restored before rendering so a hidden page cannot reappear only after
     an unrelated action such as changing paper color. */

function primeNotebookBinderIdentityForRender() {
  /* On a hard refresh the page renderer can run before currentNotebookPageId has been established.
     Recover the saved working page first so Binder spread/reference compatibility state is derived
     from the real active page, not from a temporary null identity. */
  if (!currentNotebookPageId) {
    const working=typeof notebookWorkingPageState==='function' ? notebookWorkingPageState() : null;
    if (working?.key && working?.pageId) {
      currentNotebookDate=working.key;
      currentNotebookPageId=working.pageId;
    } else if (currentNotebookDate) {
      currentNotebookPageId=notebookPageState?.()[currentNotebookDate] || ensureNotebookPage?.(currentNotebookDate) || null;
    }
  }

  const pages=typeof notebookBinderOpenPages==='function' ? notebookBinderOpenPages() : [];
  if (pages.length>1) {
    /* Rehydrate the old two-page compatibility pointer before the base renderer decides whether to
       build a page pair. This makes refresh deterministic: an open Binder is visible immediately. */
    syncNotebookBinderLegacyState?.({persist:false});
  } else if (pages.length===1) {
    /* A true one-page Notebook must not retain a ghost Reference pointer from an older session. */
    if (state.settings?.notebookReferencePage) delete state.settings.notebookReferencePage;
    state.settings.notebookBinderSpread=[pages[0].id];
    state.settings.notebookOpenPageOrder=[pages[0].id];
  }
}

function notebookBinderOpenPageOnSide(ref,side,{record=true}={}) {
  ref=binderNormalizeRef?.(ref);
  if (!ref) return;
  const pages=notebookBinderOpenPages?.() || [];
  if (!pages.some(page=>page.id===ref.id)) return;

  const target=side==='right' ? 1 : 0;
  const other=target===0 ? 1 : 0;
  let spread=[...(notebookBinderSpread?.() || [])];
  pages.forEach(page=>{ if (spread.length<2 && !spread.includes(page.id)) spread.push(page.id); });

  const existing=spread.indexOf(ref.id);
  if (existing>=0 && existing!==target) {
    /* A page already visible across the Binder moves to the requested side; preserve the other
       visible paper by swapping the two physical slots rather than closing/replacing it. */
    const displaced=spread[target];
    spread[target]=ref.id;
    if (displaced && displaced!==ref.id) spread[other]=displaced;
    else spread.splice(other,1);
  } else if (existing<0) {
    spread[target]=ref.id;
  }

  spread=spread.filter(Boolean);
  const seen=new Set();
  spread=spread.filter(id=>!seen.has(id) && seen.add(id));
  pages.forEach(page=>{ if (spread.length<Math.min(2,pages.length) && !spread.includes(page.id)) spread.push(page.id); });
  spread=spread.slice(0,2);

  state.settings ||= {};
  state.settings.notebookBinderSpread=spread;
  state.settings.notebookOpenPageOrder=[...spread];
  state.settings.notebookBinderActiveSide=target===1?'right':'left';

  notebookPageState()[ref.key]=ref.pageId;
  setNotebookWorkingPage?.(ref.key,ref.pageId,{record,kind:`binder-${side}-tab`});
  currentNotebookDate=ref.key;
  currentNotebookPageId=ref.pageId;
  syncNotebookBinderLegacyState?.({persist:true});
  renderAll();
}

function notebookBinderRailTab(ref,index,side,spread,active) {
  const sideIndex=side==='right' ? 1 : 0;
  const otherIndex=sideIndex===0 ? 1 : 0;
  const onThisSide=spread[sideIndex]===ref.id;
  const onOtherSide=spread[otherIndex]===ref.id;
  const button=document.createElement('button');
  button.type='button';
  button.className=`notebook-binder-side-tab${onThisSide?' on-this-side':''}${onOtherSide?' on-other-side':''}${active?.id===ref.id?' renderer-active':''}`;
  button.dataset.binderPage=ref.id;
  button.dataset.binderRailSide=side;
  button.dataset.paperColor=notebookPagePaperColorFinal?.(ref.key,ref.pageId) || 'warm';
  button.dataset.openSide=onThisSide?side:(onOtherSide?(side==='left'?'right':'left'):'');
  button.title=`${notebookPeerPageTitle?.(ref)||ref.key} — open on ${side}`;
  button.setAttribute('aria-label',button.title);
  /* The opposite-side state is conveyed by lower opacity, not an extra chevron. */
  button.innerHTML=`<span class="notebook-binder-side-tab-index">${index+1}</span><span class="notebook-binder-side-tab-label">${escapeHtml(notebookPeerPageTitle?.(ref)||ref.key)}</span>`;
  button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    notebookBinderOpenPageOnSide(ref,side,{record:true});
  };
  return button;
}

function installNotebookBinderDualRails(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  const pair=$('.notebook-page-pair',root);
  const pages=notebookBinderOpenPages?.() || [];
  $$('.notebook-binder-side-rail',root).forEach(node=>node.remove());
  /* Retire the prior single left rail completely. */
  $('.notebook-binder-tabs-final',root)?.remove();
  if (!shell || !pair || pages.length<=1) return;

  const spread=notebookBinderSpread?.() || [];
  const active=notebookBinderActiveRef?.();
  ['left','right'].forEach(side=>{
    const rail=document.createElement('nav');
    rail.className=`notebook-binder-side-rail notebook-binder-side-rail-${side}`;
    rail.dataset.binderRailSide=side;
    rail.setAttribute('aria-label',`${side==='left'?'Left':'Right'} Binder page tabs`);
    pages.forEach((ref,index)=>rail.appendChild(notebookBinderRailTab(ref,index,side,spread,active)));
    pair.appendChild(rail);
  });
}

/* The final Binder installer calls its older single-rail function directly. Make that function build
   the two physical rails instead so every render/fullscreen/layout refresh stays consistent. */
if (typeof installNotebookBinderTabsFinal==='function') {
  installNotebookBinderTabsFinal=function(root=$('#notebookDock')) {
    installNotebookBinderDualRails(root);
  };
}
if (typeof installNotebookBinderTabs==='function') {
  installNotebookBinderTabs=function(root=$('#notebookDock')) {
    installNotebookBinderDualRails(root);
  };
}

function renderNotebookSpreadsheetRangeOutline(wrap,object,table) {
  $('.spreadsheet-range-outline',wrap)?.remove();
  if (!wrap || !object || !table) return;
  const selection=(typeof activeSpatialTableSelection!=='undefined') ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId!==object.id) return;
  const bounds=spatialSelectionBoundsForTable?.(selection);
  if (!bounds || (bounds.rows===1 && bounds.cols===1)) return;
  const union=spreadsheetSelectionUnionRect?.(table,object,bounds);
  if (!union) return;
  const wrapRect=wrap.getBoundingClientRect();
  const outline=document.createElement('div');
  outline.className='spreadsheet-range-outline';
  outline.style.left=`${Math.round(union.left-wrapRect.left)}px`;
  outline.style.top=`${Math.round(union.top-wrapRect.top)}px`;
  outline.style.width=`${Math.max(1,Math.round(union.right-union.left))}px`;
  outline.style.height=`${Math.max(1,Math.round(union.bottom-union.top))}px`;
  wrap.appendChild(outline);
}

if (typeof decorateSpreadsheetSelection==='function' && !window.__salesShopBinderRangeOutline) {
  window.__salesShopBinderRangeOutline=true;
  const _binderDecorateSpreadsheetSelection=decorateSpreadsheetSelection;
  decorateSpreadsheetSelection=function(table,object) {
    const result=_binderDecorateSpreadsheetSelection(table,object);
    const wrap=table?.closest?.('.spatial-object-table');
    if (wrap) requestAnimationFrame(()=>renderNotebookSpreadsheetRangeOutline(wrap,object,table));
    return result;
  };
}

function refreshNotebookBinderRails(root=$('#notebookDock')) {
  if (!root) return;
  installNotebookBinderDualRails(root);
  const selectedWrap=$('.spatial-object-table.is-selected',root);
  if (selectedWrap) {
    const object=spatialObjectById?.(selectedWrap.dataset.spatialObjectId);
    const table=$('.spatial-table',selectedWrap);
    if (object && table) renderNotebookSpreadsheetRangeOutline(selectedWrap,object,table);
  }
}

const _binderRailsRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  primeNotebookBinderIdentityForRender();
  _binderRailsRenderNotebook(root);
  if (!root) return;
  refreshNotebookBinderRails(root);
};

requestAnimationFrame(()=>{
  primeNotebookBinderIdentityForRender();
  /* If the first paint happened before Binder state was restored, one deterministic rerender now
     builds the actual persisted spread instead of waiting for the next Style/Favorite action. */
  const pages=notebookBinderOpenPages?.() || [];
  if (pages.length>1 && !$('#notebookDock .notebook-reference-page')) renderAll?.();
  else refreshNotebookBinderRails($('#notebookDock'));
});
