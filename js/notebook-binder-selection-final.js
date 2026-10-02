/* Final Binder state guard + Sheets-style shift-click range selection.
   Loaded after all Binder/QC layers so open pages stay independent from visible spread state. */

function notebookFinalBinderRoster() {
  try {
    return (notebookBinderOpenPages?.() || []).map(ref=>({key:ref.key,pageId:ref.pageId,id:ref.id}));
  } catch {
    const raw=state.settings?.notebookBinderOpenPages || [];
    return raw.map(ref=>{
      try { return binderNormalizeRef?.(ref) || ref; } catch { return ref; }
    }).filter(Boolean);
  }
}

/* Single/Double changes only visibility. It must never change which pages are open. */
setNotebookBinderDisplayMode=function(mode) {
  state.settings ||= {};
  mode=mode==='double'?'double':'single';
  const roster=notebookFinalBinderRoster();
  if (mode==='double' && roster.length<2) {
    toast?.('Open another page before using two-page view.');
    return;
  }
  const active=notebookBinderActiveRef?.() || roster[0] || null;
  state.settings.notebookBinderDisplayMode=mode;
  state.settings.notebookBinderOpenPages=roster.map(({key,pageId})=>({key,pageId}));

  if (mode==='single') {
    state.settings.notebookBinderSpread=active?.id?[active.id]:[];
    state.settings.notebookBinderActiveSide='left';
  } else {
    const activeIndex=Math.max(0,roster.findIndex(page=>page.id===active?.id));
    const neighbor=roster[activeIndex+1] || roster[activeIndex-1] || roster.find(page=>page.id!==active?.id) || null;
    const ids=[active?.id,neighbor?.id].filter(Boolean);
    const order=new Map(roster.map((page,index)=>[page.id,index]));
    state.settings.notebookBinderSpread=[...new Set(ids)].sort((a,b)=>(order.get(a)??99)-(order.get(b)??99)).slice(0,2);
    state.settings.notebookBinderActiveSide=state.settings.notebookBinderSpread.indexOf(active?.id)===1?'right':'left';
  }

  save();
  renderAll();

  /* Legacy render paths can rewrite compatibility state while rendering. Restore the open roster
     after the paint, then rebuild the final Binder chrome from that authoritative roster. */
  state.settings.notebookBinderOpenPages=roster.map(({key,pageId})=>({key,pageId}));
  save();
  requestAnimationFrame(()=>{
    state.settings.notebookBinderOpenPages=roster.map(({key,pageId})=>({key,pageId}));
    notebookBinderModeQcPolish?.($('#notebookDock'));
  });
};

/* Keep the spread button available after every presentation-mode render. */
function notebookFinalEnsureSpreadControl(root=$('#notebookDock')) {
  notebookBinderModeQcEnsureSpreadToggle?.(root);
  const control=$('[data-notebook-width-controls]',root);
  const button=control ? $('[data-notebook-spread-toggle]',control) : null;
  if (!button) return;
  const pages=notebookFinalBinderRoster();
  const mode=state.settings?.notebookBinderDisplayMode==='double'?'double':'single';
  const width=typeof notebookWidthMode==='function'?notebookWidthMode():state.settings?.notebookWidthMode;
  button.dataset.spreadMode=mode;
  button.innerHTML=typeof notebookFixSpreadGlyph==='function'
    ? notebookFixSpreadGlyph(mode)
    : `<span class="notebook-spread-glyph ${mode}" aria-hidden="true"><i></i>${mode==='double'?'<i></i>':''}</span>`;
  button.title=mode==='double'?'Switch to single-page view':'Switch to two-page view';
  button.setAttribute('aria-label',button.title);
  button.disabled=pages.length<2 || width==='float' || width==='dock-left';
  button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    control?.classList.remove('position-click-collapsed');
    setNotebookBinderDisplayMode(mode==='double'?'single':'double');
  };
}

function notebookFinalSelectionContext(td) {
  const wrap=td?.closest?.('.spatial-object-table');
  const table=wrap ? $('.spatial-table',wrap) : null;
  const object=wrap ? spatialObjectById?.(wrap.dataset.spatialObjectId) : null;
  return wrap&&table&&object ? {wrap,table,object} : null;
}

function notebookFinalTableCell(table,r,c) {
  return notebookTableCellAt?.(table,r,c) || table?.querySelector?.(`td[data-spatial-row="${r}"][data-spatial-col="${c}"]`) || null;
}

function notebookFinalRangeCells(table,object,bounds) {
  if (typeof spreadsheetSelectionCells==='function') return spreadsheetSelectionCells(table,object,bounds);
  return $$('td',table).filter(td=>{
    const r=Number(td.dataset.spatialRow)||0,c=Number(td.dataset.spatialCol)||0;
    return r>=bounds.r1&&r<=bounds.r2&&c>=bounds.c1&&c<=bounds.c2;
  });
}

function notebookFinalPaintSheetsRange(table,object) {
  if (!table || !object) return;
  const wrap=table.closest('.spatial-object-table');
  wrap?.querySelector('.spreadsheet-range-outline-final')?.remove();
  $$('td',table).forEach(td=>td.classList.remove('spreadsheet-range-cell','spreadsheet-active-cell'));

  const selection=typeof activeSpatialTableSelection!=='undefined' ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId!==object.id) return;
  const bounds=spatialSelectionBoundsForTable?.(selection);
  if (!bounds) return;
  const cells=notebookFinalRangeCells(table,object,bounds);
  cells.forEach(td=>td.classList.add('spreadsheet-range-cell'));

  /* Sheets keeps the original anchor cell as the active cell during Shift-click. */
  const anchor=notebookFinalTableCell(table,selection.start.r,selection.start.c);
  anchor?.classList.add('spreadsheet-active-cell');

  if (!wrap || cells.length<2) return;
  const rects=cells.map(cell=>cell.getBoundingClientRect());
  const wrapRect=wrap.getBoundingClientRect();
  const left=Math.min(...rects.map(rect=>rect.left));
  const top=Math.min(...rects.map(rect=>rect.top));
  const right=Math.max(...rects.map(rect=>rect.right));
  const bottom=Math.max(...rects.map(rect=>rect.bottom));
  const outline=document.createElement('div');
  outline.className='spreadsheet-range-outline-final';
  outline.style.left=`${left-wrapRect.left}px`;
  outline.style.top=`${top-wrapRect.top}px`;
  outline.style.width=`${right-left}px`;
  outline.style.height=`${bottom-top}px`;
  wrap.appendChild(outline);
}

/* Shift-click extends from the original anchor without letting the legacy pointerdown/focus path
   first collapse the selection onto the clicked endpoint. */
if (!window.__salesShopFinalShiftClickRange) {
  window.__salesShopFinalShiftClickRange=true;
  document.addEventListener('pointerdown',event=>{
    if (!event.shiftKey || event.button!==0) return;
    const td=event.target?.closest?.('.spatial-object-table td');
    if (!td || td.classList.contains('spreadsheet-cell-editing')) return;
    const ctx=notebookFinalSelectionContext(td);
    if (!ctx) return;
    const previous=typeof activeSpatialTableSelection!=='undefined' ? activeSpatialTableSelection : null;
    if (!previous || previous.objectId!==ctx.object.id) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.getSelection()?.removeAllRanges();
    const end={r:Number(td.dataset.spatialRow)||0,c:Number(td.dataset.spatialCol)||0};
    activeSpatialTableSelection={objectId:ctx.object.id,start:{...previous.start},end};
    selectedSpatialObjectId=ctx.object.id;
    ctx.wrap.classList.add('is-selected','format-open');
    paintSpatialTableSelection?.(ctx.table,ctx.object);
    const old=$('.spatial-table-controls',ctx.wrap);
    if (old && typeof advancedSpatialTableControls==='function') old.replaceWith(advancedSpatialTableControls(ctx.object));
    requestAnimationFrame(()=>{
      notebookFinalPaintSheetsRange(ctx.table,ctx.object);
      renderSpreadsheetFillHandle?.(ctx.wrap,ctx.object,ctx.table);
    });
  },true);
}

if (typeof paintSpatialTableSelection==='function' && !window.__salesShopFinalRangePaint) {
  window.__salesShopFinalRangePaint=true;
  const _finalRangePaint=paintSpatialTableSelection;
  paintSpatialTableSelection=function(table,object) {
    const result=_finalRangePaint(table,object);
    notebookFinalPaintSheetsRange(table,object);
    return result;
  };
}

const _notebookFinalBinderSelectionRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _notebookFinalBinderSelectionRender(root);
  if (!root) return;
  notebookFinalEnsureSpreadControl(root);
  $$('.spatial-object-table',root).forEach(wrap=>{
    const object=spatialObjectById?.(wrap.dataset.spatialObjectId);
    const table=$('.spatial-table',wrap);
    if (object&&table) notebookFinalPaintSheetsRange(table,object);
  });
  requestAnimationFrame(()=>{
    notebookFinalEnsureSpreadControl(root);
    notebookBinderModeQcPolish?.(root);
  });
};

requestAnimationFrame(()=>{
  notebookFinalEnsureSpreadControl($('#notebookDock'));
  notebookBinderModeQcPolish?.($('#notebookDock'));
});
