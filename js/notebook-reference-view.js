/* Notebook reference view + post-table-mutation focus recovery.
   Current stays live/editable; Reference is a second read-only page used for side-by-side work. */

function restoreNotebookTableFocus(objectId,selection) {
  if (!objectId || !selection) return;
  requestAnimationFrame(()=>{
    const escaped=(window.CSS&&CSS.escape)?CSS.escape(objectId):objectId;
    const wrap=document.querySelector(`#notebookDock [data-spatial-object-id="${escaped}"]`);
    const table=wrap?.querySelector?.('.spatial-table');
    if (!wrap || !table) return;
    activeSpatialTableSelection={
      objectId,
      start:{...selection.start},
      end:{...selection.end}
    };
    selectedSpatialObjectId=objectId;
    const object=spatialObjectById?.(objectId);
    if (object) {
      paintSpatialTableSelection?.(table,object);
      decorateSpreadsheetSelection?.(table,object);
    }
    const cell=notebookTableCellAt?.(table,selection.start.r,selection.start.c)
      || table.querySelector(`td[data-spatial-row="${selection.start.r}"][data-spatial-col="${selection.start.c}"]`);
    if (cell) {
      cell.tabIndex=0;
      try { cell.focus({preventScroll:true}); } catch { cell.focus(); }
    }
  });
}

/* After a range clear renderAll() replaces the focused TD. Re-focus the corresponding cell so the
   very next Ctrl/Cmd+Z is still inside notebook context instead of requiring a preparatory click. */
if (typeof clearSelectedSpatialTableContents==='function' && !window.__salesShopRangeClearFocusRestore) {
  window.__salesShopRangeClearFocusRestore=true;
  const _referenceClearRange=clearSelectedSpatialTableContents;
  clearSelectedSpatialTableContents=function() {
    const selection=(typeof activeSpatialTableSelection!=='undefined' && activeSpatialTableSelection)
      ? {objectId:activeSpatialTableSelection.objectId,start:{...activeSpatialTableSelection.start},end:{...activeSpatialTableSelection.end}}
      : null;
    const result=_referenceClearRange();
    if (result && selection) restoreNotebookTableFocus(selection.objectId,selection);
    return result;
  };
}

function notebookReferencePageState() {
  const ref=state.settings?.notebookReferencePage;
  if (!ref?.key || !ref?.pageId) return null;
  const order=typeof notebookPageOrderForDate==='function' ? notebookPageOrderForDate(ref.key) : [];
  if (order.length && !order.includes(ref.pageId)) {
    delete state.settings.notebookReferencePage;
    save();
    return null;
  }
  const working=typeof notebookWorkingPageState==='function' ? notebookWorkingPageState() : null;
  if (working?.key===ref.key && working?.pageId===ref.pageId) return null;
  return ref;
}

function setNotebookReferencePage(key,pageId) {
  if (!key || !pageId) return;
  const working=typeof notebookWorkingPageState==='function' ? notebookWorkingPageState() : null;
  if (working?.key===key && working?.pageId===pageId) return toast('That page is already Current.');
  state.settings ||= {};
  state.settings.notebookReferencePage={key,pageId};
  save();
  closeModal?.();
  renderAll();
  toast('Reference page opened');
}

function clearNotebookReferencePage() {
  if (!state.settings?.notebookReferencePage) return;
  delete state.settings.notebookReferencePage;
  save();
  renderAll();
}

function swapNotebookReferencePage() {
  const ref=notebookReferencePageState();
  const working=typeof notebookWorkingPageState==='function' ? notebookWorkingPageState() : null;
  if (!ref || !working) return;
  notebookPushUndoCheckpoint?.();
  state.settings.notebookReferencePage={key:working.key,pageId:working.pageId};
  notebookPageState()[ref.key]=ref.pageId;
  setNotebookWorkingPage?.(ref.key,ref.pageId,{record:true,kind:'reference-swap'});
  currentNotebookDate=ref.key;
  currentNotebookPageId=ref.pageId;
  save();
  renderAll();
  toast('Current and Reference swapped');
}

function notebookReferenceMergeCovering(object,r,c) {
  return (object?.merges||[]).find(merge=>
    r>=merge.r && r<merge.r+merge.rows && c>=merge.c && c<merge.c+merge.cols
  ) || null;
}

function notebookReferenceTable(object) {
  const table=document.createElement('table');
  table.className='notebook-reference-table spatial-table';
  const rows=Math.max(1,Number(object.rows)||1);
  const cols=Math.max(1,Number(object.cols)||1);
  const headerRow=object.tableHeaderRow ? (object.tableTitleRow?1:0) : -1;
  for (let r=0;r<rows;r++) {
    const tr=document.createElement('tr');
    for (let c=0;c<cols;c++) {
      const merge=notebookReferenceMergeCovering(object,r,c);
      if (merge && (merge.r!==r || merge.c!==c)) continue;
      const td=document.createElement('td');
      if (merge) {
        td.rowSpan=Math.max(1,Number(merge.rows)||1);
        td.colSpan=Math.max(1,Number(merge.cols)||1);
      }
      const key=typeof notebookFunctionCellKey==='function' ? notebookFunctionCellKey(r,c) : `${r}:${c}`;
      const style=object.cellStyles?.[key] || object.cellStyles?.[`${r}:${c}`] || {};
      const raw=String(object.cells?.[r]?.[c] ?? '');
      td.textContent=typeof formatSpatialCellValue==='function' ? formatSpatialCellValue(raw,style.numberFormat||'none') : raw;
      if (style.align) td.style.textAlign=style.align;
      if (style.fill && style.fill!=='none') td.dataset.cellFill=style.fill;
      if (object.tableTitleRow && r===0) td.classList.add('spatial-table-title-cell');
      if (headerRow===r) td.classList.add('spatial-table-header-cell');
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  return table;
}

function notebookReferenceObjectElement(object,step) {
  const wrap=document.createElement('div');
  wrap.className=`notebook-reference-object notebook-reference-object-${object.type}`;
  const col=Math.max(0,Number(object.col)||0);
  const row=Math.max(0,Number(object.row)||0);
  const rows=Math.max(1,Number(object.rows)||1);
  const logicalCols=Math.max(1,Number(object.cols)||1);
  const colSquares=object.type==='table' ? Math.max(1,Number(object.cellWidthSquares)||2) : 1;
  const physicalCols=logicalCols*colSquares;
  wrap.style.left=`${col*step}px`;
  wrap.style.top=`${row*step}px`;
  wrap.style.width=`${physicalCols*step}px`;
  wrap.style.height=`${rows*step}px`;
  if (object.type==='table') wrap.appendChild(notebookReferenceTable(object));
  else {
    const text=document.createElement('div');
    text.className='notebook-reference-shape-text';
    text.textContent=object.text || '';
    wrap.appendChild(text);
  }
  return {wrap,bottom:(row+rows)*step,right:(col+physicalCols)*step};
}

function notebookReferenceEntryElement(entry,step,fallbackRow) {
  const el=document.createElement('div');
  el.className='notebook-reference-entry';
  const grid=entry.grid;
  const row=Number.isFinite(Number(entry.paperRow)) ? Math.max(0,Number(entry.paperRow))
    : Number.isFinite(Number(grid?.row)) ? Math.max(0,Number(grid.row)) : fallbackRow;
  const col=Number.isFinite(Number(grid?.col)) ? Math.max(0,Number(grid.col)) : 0;
  el.style.top=`${row*step}px`;
  el.style.left=`${col*step}px`;
  if (col) el.style.maxWidth=`calc(100% - ${col*step}px)`;

  if (entry.cue) {
    const cue=document.createElement('div');
    cue.className='notebook-reference-entry-cue';
    cue.textContent=entry.cue;
    el.appendChild(cue);
  }
  const text=document.createElement('div');
  text.className='notebook-reference-entry-text';
  if (entry.richHtml && typeof sanitizeRichHtml==='function') text.innerHTML=sanitizeRichHtml(entry.richHtml);
  else text.textContent=entry.text || entry.attachment?.name || '';
  el.appendChild(text);
  if (entry.attachment) {
    const attachment=document.createElement('div');
    attachment.className='notebook-reference-attachment';
    attachment.textContent=`📎 ${entry.attachment.name || 'Attachment'}`;
    el.appendChild(attachment);
  }
  if (entry.voiceMemo) {
    const voice=document.createElement('div');
    voice.className='notebook-reference-voice';
    voice.textContent=`♪ ${entry.voiceMemo.title || 'Voice Memo'}`;
    el.appendChild(voice);
  }
  const span=typeof pageStateEntrySpan==='function' ? pageStateEntrySpan(entry) : Math.max(1,String(entry.text||'').split('\n').length);
  return {el,row,span,bottom:(row+span)*step,right:(col+8)*step};
}

function buildNotebookReferencePage(ref) {
  const step=typeof notebookPaperRhythm==='function' ? notebookPaperRhythm() : 28;
  const page=document.createElement('section');
  const view=typeof notebookPaperView==='function' ? notebookPaperView() : 'lines';
  const gridPaper=typeof notebookGridPaper==='function' ? notebookGridPaper() : 'grid';
  page.className=`notebook-reference-page reference-${view}${view==='grid'?` reference-grid-${gridPaper}`:''}`;
  page.dataset.referenceDate=ref.key;
  page.dataset.referencePage=ref.pageId;

  const head=document.createElement('div');
  head.className='notebook-reference-head';
  const titleWrap=document.createElement('div');
  titleWrap.className='notebook-reference-title-wrap';
  const label=document.createElement('div');
  label.className='notebook-reference-label';
  label.textContent='Reference';
  const date=document.createElement('div');
  date.className='notebook-reference-date';
  date.textContent=fmtDate(ref.key,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const header=typeof notebookPageHeader==='function' ? notebookPageHeader(ref.key,ref.pageId).trim() : '';
  const pageHeader=document.createElement('div');
  pageHeader.className='notebook-reference-page-header';
  pageHeader.textContent=header;
  titleWrap.append(label,date);
  if (header) titleWrap.appendChild(pageHeader);

  const actions=document.createElement('div');
  actions.className='notebook-reference-actions';
  actions.innerHTML='<button type="button" data-reference-swap title="Make Reference current and keep the current page as Reference">Swap</button><button type="button" data-reference-close title="Close Reference" aria-label="Close Reference">×</button>';
  head.append(titleWrap,actions);
  page.appendChild(head);

  const scroller=document.createElement('div');
  scroller.className='notebook-reference-scroller';
  const body=document.createElement('div');
  body.className='notebook-reference-body';
  let bottom=step*16;
  let right=0;
  let fallbackRow=0;
  const entries=notebookEntriesForPage(ref.key,ref.pageId);
  entries.forEach(entry=>{
    const rendered=notebookReferenceEntryElement(entry,step,fallbackRow);
    body.appendChild(rendered.el);
    bottom=Math.max(bottom,rendered.bottom+step*3);
    right=Math.max(right,rendered.right);
    fallbackRow=Math.max(fallbackRow,rendered.row+rendered.span+1);
  });
  const objects=state.settings?.notebookSpatialObjectsByPage?.[notebookPageStorageKey(ref.key,ref.pageId)] || [];
  objects.forEach(object=>{
    const rendered=notebookReferenceObjectElement(object,step);
    body.appendChild(rendered.wrap);
    bottom=Math.max(bottom,rendered.bottom+step*3);
    right=Math.max(right,rendered.right+step*2);
  });
  body.style.minHeight=`${Math.max(step*16,bottom)}px`;
  if (right) body.style.minWidth=`${Math.max(420,right)}px`;
  if (!entries.length && !objects.length) {
    const empty=document.createElement('div');
    empty.className='notebook-reference-empty';
    empty.textContent='Blank page';
    body.appendChild(empty);
  }
  scroller.appendChild(body);
  page.appendChild(scroller);
  $('[data-reference-swap]',page).onclick=swapNotebookReferencePage;
  $('[data-reference-close]',page).onclick=clearNotebookReferencePage;
  return page;
}

function installNotebookReferenceView(root=$('#notebookDock')) {
  if (!root) return;
  const ref=notebookReferencePageState();
  const shell=$('.notebook-shell',root);
  const current=$('.notebook-page',shell);
  if (!shell || !current || !ref) return;
  shell.classList.add('notebook-has-reference');
  const pair=document.createElement('div');
  pair.className='notebook-page-pair';
  current.parentNode.insertBefore(pair,current);
  pair.appendChild(current);
  pair.appendChild(buildNotebookReferencePage(ref));
}

/* Add Reference beside Resume in every calendar-history page row. */
function installNotebookHistoryReferenceActions(root=$('#modalRoot')) {
  if (!root) return;
  const working=typeof notebookWorkingPageState==='function' ? notebookWorkingPageState() : null;
  const currentRef=state.settings?.notebookReferencePage || null;
  $$('.notebook-history-calendar-page',root).forEach(row=>{
    const open=$('[data-history-calendar-open-page]',row);
    const actions=$('.notebook-history-calendar-page-actions',row);
    if (!open || !actions || $('[data-history-reference-page]',actions)) return;
    const key=open.dataset.historyCalendarOpenDate;
    const pageId=open.dataset.historyCalendarOpenPage;
    if (working?.key===key && working?.pageId===pageId) return;
    const button=document.createElement('button');
    button.type='button';
    button.className='notebook-history-reference';
    button.dataset.historyReferenceDate=key;
    button.dataset.historyReferencePage=pageId;
    const active=currentRef?.key===key && currentRef?.pageId===pageId;
    button.textContent=active?'Referenced':'Reference';
    button.disabled=active;
    button.title=active?'This page is already open as Reference':'Open beside the current notebook page';
    button.onclick=()=>setNotebookReferencePage(key,pageId);
    actions.insertBefore(button,actions.firstChild);
  });
}

if (typeof bindNotebookHistoryCalendar==='function' && !window.__salesShopHistoryReferenceActions) {
  window.__salesShopHistoryReferenceActions=true;
  const _referenceHistoryBind=bindNotebookHistoryCalendar;
  bindNotebookHistoryCalendar=function() {
    const result=_referenceHistoryBind();
    installNotebookHistoryReferenceActions($('#modalRoot'));
    return result;
  };
}

/* If Resume is used on the page currently pinned as Reference, clear the duplicate pin. */
if (typeof resumeNotebookPage==='function' && !window.__salesShopResumeReferenceCleanup) {
  window.__salesShopResumeReferenceCleanup=true;
  const _referenceResumePage=resumeNotebookPage;
  resumeNotebookPage=function(key,pageId,options={}) {
    const ref=state.settings?.notebookReferencePage;
    if (ref?.key===key && ref?.pageId===pageId) delete state.settings.notebookReferencePage;
    return _referenceResumePage(key,pageId,options);
  };
}

const _referenceNotebookRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _referenceNotebookRender(root);
  if (!root) return;
  installNotebookReferenceView(root);
};
