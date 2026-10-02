/* Sheets-style notebook table selection/editing and fill handle.
   Single click selects a cell without entering text. Typing replaces the selected cell;
   double-click/F2 edits existing text. A subtle bottom-right handle drag-fills values/styles/formulas. */

let notebookSpreadsheetCellEdit = null;
let notebookSpreadsheetFillDrag = null;

function spreadsheetCellObject(td) {
  const wrap=td?.closest?.('.spatial-object-table');
  const object=spatialObjectById?.(wrap?.dataset?.spatialObjectId);
  return object ? {object,wrap,table:$('.spatial-table',wrap)} : null;
}

function spreadsheetTdCoords(td) {
  return {r:Number(td?.dataset?.spatialRow)||0,c:Number(td?.dataset?.spatialCol)||0};
}

function spreadsheetCellFormulaKey(td) {
  const {object}=spreadsheetCellObject(td)||{};
  if (!object) return null;
  const {r,c}=spreadsheetTdCoords(td);
  const merge=spatialMergeCovering?.(object,r,c);
  return notebookFunctionCellKey(merge?.r??r,merge?.c??c);
}

function spreadsheetDropFormulaImmediately(td,object) {
  if (!td || !object) return;
  const key=spreadsheetCellFormulaKey(td);
  if (!key) return;
  if (object.cellFormulas?.[key]) delete object.cellFormulas[key];
  td.classList.remove('has-notebook-formula','notebook-formula-result-preview','notebook-formula-source-preview');
  if (typeof notebookFormulaInspection!=='undefined' && notebookFormulaInspection?.objectId===object.id && notebookFormulaInspection?.targetKey===key) {
    clearNotebookFormulaInspection?.();
  }
}

function spreadsheetPlaceEditingCaret(td,edge='end') {
  if (!td) return;
  td.focus({preventScroll:true});
  try {
    const range=document.createRange();
    range.selectNodeContents(td);
    range.collapse(edge==='start');
    const selection=window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {}
}

function spreadsheetBeginCellEdit(td,{replace=null,edge='end'}={}) {
  const ctx=spreadsheetCellObject(td);
  if (!ctx || !td || td.getAttribute('aria-readonly')==='true') return false;
  const {object}=ctx;
  const {r,c}=spreadsheetTdCoords(td);
  const merge=spatialMergeCovering?.(object,r,c);
  const ar=merge?.r??r, ac=merge?.c??c;
  const key=notebookFunctionCellKey(ar,ac);

  notebookSpreadsheetCellEdit={
    objectId:object.id,
    r:ar,
    c:ac,
    original:String(object.cells?.[ar]?.[ac]??''),
    originalFormula:object.cellFormulas?.[key] ? spreadsheetClone?.(object.cellFormulas[key]) : null
  };

  td.contentEditable='true';
  td.classList.add('spreadsheet-cell-editing');
  td.tabIndex=0;

  if (replace!=null) {
    spreadsheetDropFormulaImmediately(td,object);
    td.textContent=String(replace);
    object.cells[ar] ||= [];
    object.cells[ar][ac]=String(replace);
    object.updatedAt=new Date().toISOString();
    save();
  }
  spreadsheetPlaceEditingCaret(td,edge);
  return true;
}

function spreadsheetEndCellEdit(td,{cancel=false}={}) {
  if (!td) return;
  const ctx=spreadsheetCellObject(td);
  const edit=notebookSpreadsheetCellEdit;
  if (ctx && edit && edit.objectId===ctx.object.id) {
    const key=notebookFunctionCellKey(edit.r,edit.c);
    if (cancel) {
      ctx.object.cells[edit.r] ||= [];
      ctx.object.cells[edit.r][edit.c]=edit.original;
      ctx.object.cellFormulas ||= {};
      if (edit.originalFormula) ctx.object.cellFormulas[key]=spreadsheetClone?.(edit.originalFormula) || edit.originalFormula;
      else delete ctx.object.cellFormulas[key];
      td.textContent=edit.original;
      ctx.object.updatedAt=new Date().toISOString();
      save();
    }
  }
  td.classList.remove('spreadsheet-cell-editing');
  td.contentEditable='false';
  td.tabIndex=0;
  notebookSpreadsheetCellEdit=null;
  window.getSelection()?.removeAllRanges();
}

/* Navigation focuses/selects cells, not their text. Actual caret placement is reserved for edit mode. */
if (typeof notebookPlaceCaretInCell==='function' && !window.__salesShopSheetsCellFocus) {
  window.__salesShopSheetsCellFocus=true;
  const _spreadsheetCaretPlacement=notebookPlaceCaretInCell;
  notebookPlaceCaretInCell=function(cell,edge='end') {
    if (!cell) return;
    if (cell.classList.contains('spreadsheet-cell-editing')) return _spreadsheetCaretPlacement(cell,edge);
    cell.contentEditable='false';
    cell.tabIndex=0;
    cell.focus({preventScroll:true});
    window.getSelection()?.removeAllRanges();
  };
}

function spreadsheetSelectionCells(table,object,bounds) {
  if (!table || !object || !bounds) return [];
  return $$('td',table).filter(td=>{
    const r=Number(td.dataset.spatialRow)||0,c=Number(td.dataset.spatialCol)||0;
    const merge=spatialMergeCovering?.(object,r,c);
    const r1=merge?.r??r,c1=merge?.c??c;
    const r2=merge ? merge.r+merge.rows-1 : r;
    const c2=merge ? merge.c+merge.cols-1 : c;
    return r1<=bounds.r2 && r2>=bounds.r1 && c1<=bounds.c2 && c2>=bounds.c1;
  });
}

function decorateSpreadsheetSelection(table,object) {
  if (!table || !object) return;
  $$('td',table).forEach(td=>td.classList.remove('spreadsheet-active-cell','spreadsheet-range-cell'));
  const selection=(typeof activeSpatialTableSelection!=='undefined') ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId!==object.id) return;
  const bounds=spatialSelectionBoundsForTable?.(selection);
  if (!bounds) return;
  const active=notebookTableCellAt?.(table,selection.start.r,selection.start.c)
    || table.querySelector(`td[data-spatial-row="${selection.start.r}"][data-spatial-col="${selection.start.c}"]`);
  spreadsheetSelectionCells(table,object,bounds).forEach(td=>{
    if (td===active) td.classList.add('spreadsheet-active-cell');
    else td.classList.add('spreadsheet-range-cell');
  });
  active?.classList.add('spreadsheet-active-cell');
}

function spreadsheetSelectionUnionRect(table,object,bounds) {
  const cells=spreadsheetSelectionCells(table,object,bounds);
  if (!cells.length) return null;
  const rects=cells.map(cell=>cell.getBoundingClientRect());
  return {
    left:Math.min(...rects.map(r=>r.left)),
    top:Math.min(...rects.map(r=>r.top)),
    right:Math.max(...rects.map(r=>r.right)),
    bottom:Math.max(...rects.map(r=>r.bottom))
  };
}

function clearSpreadsheetFillPreview(table) {
  $$('.spreadsheet-fill-preview',table).forEach(td=>td.classList.remove('spreadsheet-fill-preview'));
}

function spreadsheetFillTarget(object,source,direction,edge) {
  if (!source || !direction) return null;
  if (direction==='down' && edge<=source.r2) return null;
  if (direction==='up' && edge>=source.r1) return null;
  if (direction==='right' && edge<=source.c2) return null;
  if (direction==='left' && edge>=source.c1) return null;
  if (direction==='down') return {r1:source.r2+1,r2:edge,c1:source.c1,c2:source.c2};
  if (direction==='up') return {r1:edge,r2:source.r1-1,c1:source.c1,c2:source.c2};
  if (direction==='right') return {r1:source.r1,r2:source.r2,c1:source.c2+1,c2:edge};
  return {r1:source.r1,r2:source.r2,c1:edge,c2:source.c1-1};
}

function spreadsheetPositiveMod(n,m) { return ((n%m)+m)%m; }

function applySpreadsheetFillDrag(object,source,direction,edge) {
  const dest=spreadsheetFillTarget(object,source,direction,edge);
  if (!dest) return false;
  const destRows=dest.r2-dest.r1+1,destCols=dest.c2-dest.c1+1;
  if (spreadsheetSelectionIntersectsMerge?.(object,source) || spreadsheetRegionHitsMerge?.(object,dest.r1,dest.c1,destRows,destCols)) {
    toast('Split merged cells before using the fill handle.');
    return false;
  }

  notebookPushUndoCheckpoint?.();
  const sourceRows=source.rows,sourceCols=source.cols;
  for (let r=dest.r1;r<=dest.r2;r++) {
    for (let c=dest.c1;c<=dest.c2;c++) {
      const sr=source.r1+spreadsheetPositiveMod(r-source.r1,sourceRows);
      const sc=source.c1+spreadsheetPositiveMod(c-source.c1,sourceCols);
      const payload=spreadsheetCellPayload?.(object,sr,sc);
      if (payload) spreadsheetApplyCellPayload?.(object,payload,r,c,{copyStyle:true});
    }
  }

  const full={
    r1:Math.min(source.r1,dest.r1),
    r2:Math.max(source.r2,dest.r2),
    c1:Math.min(source.c1,dest.c1),
    c2:Math.max(source.c2,dest.c2)
  };
  full.rows=full.r2-full.r1+1;
  full.cols=full.c2-full.c1+1;
  spreadsheetFinishMutation?.(object,full);
  return true;
}

function renderSpreadsheetFillHandle(wrap,object,table) {
  $('.spreadsheet-fill-handle',wrap)?.remove();
  if (!wrap || !object || !table) return;
  if (typeof isCurrentNotebookPageEditable==='function' && !isCurrentNotebookPageEditable()) return;
  if (typeof notebookFunctionPickMode!=='undefined' && notebookFunctionPickMode) return;
  if (notebookSpreadsheetCellEdit?.objectId===object.id) return;
  const selection=(typeof activeSpatialTableSelection!=='undefined') ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId!==object.id) return;
  const bounds=spatialSelectionBoundsForTable?.(selection);
  if (!bounds) return;
  const union=spreadsheetSelectionUnionRect(table,object,bounds);
  if (!union) return;
  const wrapRect=wrap.getBoundingClientRect();

  const handle=document.createElement('button');
  handle.type='button';
  handle.className='spreadsheet-fill-handle';
  handle.title='Drag to fill';
  handle.setAttribute('aria-label','Drag to fill selected cells');
  handle.style.left=`${Math.round(union.right-wrapRect.left)}px`;
  handle.style.top=`${Math.round(union.bottom-wrapRect.top)}px`;

  handle.addEventListener('pointerdown',event=>{
    if (event.button!==0) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture?.(event.pointerId);
    const startX=event.clientX,startY=event.clientY;
    const source={...bounds};
    let direction=null,edge=null;
    notebookSpreadsheetFillDrag={objectId:object.id,source,direction:null,edge:null};
    wrap.classList.add('spreadsheet-fill-dragging');

    const onMove=ev=>{
      ev.preventDefault();
      const td=document.elementFromPoint(ev.clientX,ev.clientY)?.closest?.('.spatial-table td');
      if (!td || !table.contains(td)) return;
      const {r,c}=spreadsheetTdCoords(td);
      const dx=ev.clientX-startX,dy=ev.clientY-startY;
      if (Math.abs(dx)>=Math.abs(dy)) {
        if (c>source.c2) { direction='right';edge=c; }
        else if (c<source.c1) { direction='left';edge=c; }
        else { direction=null;edge=null; }
      } else {
        if (r>source.r2) { direction='down';edge=r; }
        else if (r<source.r1) { direction='up';edge=r; }
        else { direction=null;edge=null; }
      }
      notebookSpreadsheetFillDrag={objectId:object.id,source,direction,edge};
      clearSpreadsheetFillPreview(table);
      const dest=spreadsheetFillTarget(object,source,direction,edge);
      if (dest) spreadsheetSelectionCells(table,object,{...dest,rows:dest.r2-dest.r1+1,cols:dest.c2-dest.c1+1})
        .forEach(cell=>cell.classList.add('spreadsheet-fill-preview'));
    };

    const onUp=()=>{
      document.removeEventListener('pointermove',onMove);
      document.removeEventListener('pointerup',onUp);
      document.removeEventListener('pointercancel',onUp);
      wrap.classList.remove('spreadsheet-fill-dragging');
      clearSpreadsheetFillPreview(table);
      const drag=notebookSpreadsheetFillDrag;
      notebookSpreadsheetFillDrag=null;
      if (drag?.direction && drag.edge!=null) applySpreadsheetFillDrag(object,source,drag.direction,drag.edge);
    };

    document.addEventListener('pointermove',onMove,{passive:false});
    document.addEventListener('pointerup',onUp,{once:true});
    document.addEventListener('pointercancel',onUp,{once:true});
  });
  wrap.appendChild(handle);
}

function installSpreadsheetCellSelection(root=$('#notebookDock')) {
  if (!root) return;
  $$('.spatial-object-table',root).forEach(wrap=>{
    const object=spatialObjectById?.(wrap.dataset.spatialObjectId);
    const table=$('.spatial-table',wrap);
    if (!object || !table) return;

    $$('td',table).forEach(td=>{
      if (!td.classList.contains('spreadsheet-cell-editing')) td.contentEditable='false';
      td.tabIndex=0;
    });

    if (!table.dataset.sheetsSelectionBound) {
      table.dataset.sheetsSelectionBound='1';

      table.addEventListener('pointerdown',event=>{
        const td=event.target.closest('td');
        if (!td || event.button!==0 || td.classList.contains('spreadsheet-cell-editing')) return;
        if (event.target.closest('.spreadsheet-fill-handle')) return;
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        td.focus({preventScroll:true});
      },true);

      table.addEventListener('dblclick',event=>{
        const td=event.target.closest('td');
        if (!td) return;
        const key=spreadsheetCellFormulaKey(td);
        if (key && object.cellFormulas?.[key]) return; // existing formula F2/double-click reference editor owns this.
        event.preventDefault();
        event.stopPropagation();
        spreadsheetBeginCellEdit(td,{edge:'end'});
      });

      table.addEventListener('focusout',event=>{
        const td=event.target.closest('td');
        if (!td || !td.classList.contains('spreadsheet-cell-editing')) return;
        setTimeout(()=>{
          if (!td.isConnected || document.activeElement===td) return;
          spreadsheetEndCellEdit(td,{cancel:false});
        },0);
      });

      table.addEventListener('input',event=>{
        const td=event.target.closest('td');
        if (!td) return;
        spreadsheetDropFormulaImmediately(td,object);
      },true);
    }

    decorateSpreadsheetSelection(table,object);
    renderSpreadsheetFillHandle(wrap,object,table);
  });
}

/* Keep the selection decoration and fill handle synchronized with every range repaint. */
if (typeof paintSpatialTableSelection==='function' && !window.__salesShopSheetsSelectionPaint) {
  window.__salesShopSheetsSelectionPaint=true;
  const _sheetsPaintSelection=paintSpatialTableSelection;
  paintSpatialTableSelection=function(table,object) {
    const result=_sheetsPaintSelection(table,object);
    decorateSpreadsheetSelection(table,object);
    const wrap=table?.closest?.('.spatial-object-table');
    if (wrap) requestAnimationFrame(()=>renderSpreadsheetFillHandle(wrap,object,table));
    return result;
  };
}

/* Multi-cell Delete now removes formulas too, not just their rendered result values. */
if (typeof clearSelectedSpatialTableContents==='function' && !window.__salesShopSheetsRangeClear) {
  window.__salesShopSheetsRangeClear=true;
  clearSelectedSpatialTableContents=function() {
    const selection=(typeof activeSpatialTableSelection!=='undefined') ? activeSpatialTableSelection : null;
    if (!selection || !spatialTableSelectionIsRange?.()) return false;
    const object=spatialObjectById?.(selection.objectId);
    if (!object || object.type!=='table') return false;
    normalizeAdvancedSpatialTable?.(object);
    const cells=selectedSpatialTableCells?.(object)||[];
    if (!cells.length) return false;
    notebookPushUndoCheckpoint?.();
    const anchors=new Set();
    cells.forEach(({r,c})=>{
      const merge=spatialMergeCovering?.(object,r,c);
      anchors.add(notebookFunctionCellKey(merge?.r??r,merge?.c??c));
    });
    object.cellFormulas ||= {};
    anchors.forEach(key=>{
      const {r,c}=notebookFunctionCellCoords(key);
      if (object.cells?.[r]) object.cells[r][c]='';
      delete object.cellFormulas[key];
    });
    object.updatedAt=new Date().toISOString();
    selectedSpatialObjectId=object.id;
    save();
    renderAll();
    return true;
  };
}

/* Selection mode keyboard: typing replaces the active cell; F2 edits existing text; Delete clears
   a single selected cell. While actually editing, arrows remain ordinary text-caret keys. */
if (!window.__salesShopSheetsKeyboard) {
  window.__salesShopSheetsKeyboard=true;
  document.addEventListener('keydown',event=>{
    const td=event.target?.closest?.('.spatial-object-table td') || document.activeElement?.closest?.('.spatial-object-table td');
    if (!td) return;
    const ctx=spreadsheetCellObject(td);
    if (!ctx) return;

    if (td.classList.contains('spreadsheet-cell-editing')) {
      if (event.key==='Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        spreadsheetEndCellEdit(td,{cancel:true});
        td.focus({preventScroll:true});
        return;
      }
      if (event.key.startsWith('Arrow')) {
        event.stopPropagation();
        return;
      }
      return;
    }

    if (typeof notebookFunctionPickMode!=='undefined' && notebookFunctionPickMode) return;

    if (event.key==='F2') {
      const key=spreadsheetCellFormulaKey(td);
      if (key && ctx.object.cellFormulas?.[key]) return; // formula editor registered earlier owns this.
      event.preventDefault();
      event.stopImmediatePropagation();
      spreadsheetBeginCellEdit(td,{edge:'end'});
      return;
    }

    if ((event.key==='Delete' || event.key==='Backspace') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const selection=(typeof activeSpatialTableSelection!=='undefined') ? activeSpatialTableSelection : null;
      const bounds=selection?.objectId===ctx.object.id ? spatialSelectionBoundsForTable?.(selection) : null;
      if (bounds && (bounds.rows>1 || bounds.cols>1)) return; // range-clear handler registered earlier owns it.
      event.preventDefault();
      event.stopImmediatePropagation();
      const {r,c}=spreadsheetTdCoords(td);
      const merge=spatialMergeCovering?.(ctx.object,r,c);
      const ar=merge?.r??r,ac=merge?.c??c;
      const key=notebookFunctionCellKey(ar,ac);
      notebookPushUndoCheckpoint?.();
      ctx.object.cells[ar] ||= [];
      ctx.object.cells[ar][ac]='';
      if (ctx.object.cellFormulas) delete ctx.object.cellFormulas[key];
      td.textContent='';
      td.classList.remove('has-notebook-formula','notebook-formula-result-preview','notebook-formula-source-preview');
      clearNotebookFormulaInspection?.();
      ctx.object.updatedAt=new Date().toISOString();
      save();
      renderAll();
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.key.length!==1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const first=event.key;
    if (!spreadsheetBeginCellEdit(td,{replace:first,edge:'end'})) return;
    if (first==='=') showCellFunctionPalette?.(td,ctx.object);
  },true);
}

const _sheetsSelectionRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _sheetsSelectionRender(root);
  if (!root) return;
  installSpreadsheetCellSelection(root);
};
