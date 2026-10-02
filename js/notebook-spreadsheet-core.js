/* Quiet spreadsheet behavior for notebook tables.
   Adds familiar keyboard/range mechanics without permanent spreadsheet chrome:
   - Shift+Arrow range extension
   - structured multi-cell copy/paste
   - direct =SUM(A1:A4) / =AVERAGE(...) / =PRODUCT(...) formulas
   - relative formula references on copy/fill
   - Ctrl/Cmd+D Fill Down and Ctrl/Cmd+R Fill Right. */

const SALESSHOP_TABLE_CLIPBOARD_MIME='application/x-salesshop-table-v1';

function spreadsheetClone(value) {
  if (value == null) return value;
  try { return JSON.parse(JSON.stringify(value)); }
  catch { return value; }
}

function spreadsheetColumnIndex(label) {
  const text=String(label||'').toUpperCase();
  if (!/^[A-Z]+$/.test(text)) return null;
  let value=0;
  for (const char of text) value=value*26+(char.charCodeAt(0)-64);
  return value-1;
}

function spreadsheetParseCellReference(raw) {
  const match=String(raw||'').trim().match(/^\$?([A-Za-z]+)\$?(\d+)$/);
  if (!match) return null;
  const c=spreadsheetColumnIndex(match[1]);
  const r=Number(match[2])-1;
  if (!Number.isFinite(r) || r<0 || c==null || c<0) return null;
  return {r,c};
}

function spreadsheetFormulaTokenCells(token,object) {
  const text=String(token||'').trim();
  if (!text) return [];
  const parts=text.split(':').map(part=>part.trim());
  if (parts.length>2) return null;
  const a=spreadsheetParseCellReference(parts[0]);
  const b=parts.length===2 ? spreadsheetParseCellReference(parts[1]) : a;
  if (!a || !b) return null;
  const r1=Math.min(a.r,b.r),r2=Math.max(a.r,b.r);
  const c1=Math.min(a.c,b.c),c2=Math.max(a.c,b.c);
  if (r2>=object.rows || c2>=object.cols) return {error:'Reference is outside this table.'};
  const keys=[];
  for (let r=r1;r<=r2;r++) for (let c=c1;c<=c2;c++) keys.push(notebookFunctionCellKey(r,c));
  return keys;
}

function spreadsheetParseFormulaText(raw,object) {
  const text=String(raw||'').trim();
  const match=text.match(/^=\s*(SUM|AVERAGE|AVG|PRODUCT)\s*\((.*)\)\s*$/i);
  if (!match) return null;
  const typeName=match[1].toUpperCase();
  const type=typeName==='SUM'?'sum':typeName==='PRODUCT'?'product':'average';
  const args=match[2].trim();
  const sources=[];
  const seen=new Set();
  if (args) {
    for (const token of args.split(',')) {
      const cells=spreadsheetFormulaTokenCells(token,object);
      if (cells?.error) return cells;
      if (!Array.isArray(cells)) return {error:`Couldn't read “${token.trim()}”.`};
      cells.forEach(key=>{ if (!seen.has(key)) { seen.add(key); sources.push(key); } });
    }
  }
  return {type,sources};
}

function spreadsheetTableContext(node) {
  const td=node?.closest?.('.spatial-object-table td') || null;
  const wrap=td?.closest?.('.spatial-object-table') || node?.closest?.('.spatial-object-table') || null;
  const object=spatialObjectById?.(wrap?.dataset?.spatialObjectId);
  const table=wrap ? $('.spatial-table',wrap) : null;
  return object && table ? {td,wrap,object,table} : null;
}

function spreadsheetSelectionContext() {
  const selection=(typeof activeSpatialTableSelection!=='undefined') ? activeSpatialTableSelection : null;
  if (!selection?.objectId) return null;
  const object=spatialObjectById?.(selection.objectId);
  if (!object || object.type!=='table') return null;
  const wrap=$(`#notebookDock [data-spatial-object-id="${selection.objectId}"]`);
  const table=wrap ? $('.spatial-table',wrap) : null;
  const bounds=spatialSelectionBoundsForTable?.(selection);
  if (!wrap || !table || !bounds) return null;
  return {selection,object,wrap,table,bounds};
}

function spreadsheetSelectionHasDomText() {
  const selection=window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed || !selection.toString()) return false;
  const node=selection.anchorNode?.nodeType===Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode?.parentElement;
  return !!node?.closest?.('.spatial-table td');
}

function spreadsheetFormulaShifted(formula,rowDelta,colDelta) {
  if (!formula) return null;
  const sources=(formula.sources||[]).map(key=>{
    const {r,c}=notebookFunctionCellCoords(key);
    const nr=r+rowDelta,nc=c+colDelta;
    return nr<0 || nc<0 ? null : notebookFunctionCellKey(nr,nc);
  }).filter(Boolean);
  return {...spreadsheetClone(formula),sources};
}

function spreadsheetCellPayload(object,r,c) {
  const merge=spatialMergeCovering?.(object,r,c);
  if (merge && (merge.r!==r || merge.c!==c)) {
    return {sourceR:r,sourceC:c,value:'',style:null,formula:null,covered:true};
  }
  const key=notebookFunctionCellKey(r,c);
  return {
    sourceR:r,
    sourceC:c,
    value:String(object.cells?.[r]?.[c]??''),
    style:spreadsheetClone(object.cellStyles?.[key]||null),
    formula:spreadsheetClone(object.cellFormulas?.[key]||null),
    covered:false
  };
}

function spreadsheetSelectionClipboardPayload(object,bounds) {
  const cells=[];
  for (let r=bounds.r1;r<=bounds.r2;r++) {
    for (let c=bounds.c1;c<=bounds.c2;c++) {
      cells.push({...spreadsheetCellPayload(object,r,c),relR:r-bounds.r1,relC:c-bounds.c1});
    }
  }
  return {
    version:1,
    sourceObjectId:object.id,
    origin:{r:bounds.r1,c:bounds.c1},
    rows:bounds.rows,
    cols:bounds.cols,
    cells
  };
}

function spreadsheetSelectionPlainText(object,bounds) {
  const rows=[];
  for (let r=bounds.r1;r<=bounds.r2;r++) {
    const values=[];
    for (let c=bounds.c1;c<=bounds.c2;c++) {
      const merge=spatialMergeCovering?.(object,r,c);
      values.push(merge && (merge.r!==r || merge.c!==c) ? '' : String(object.cells?.[r]?.[c]??''));
    }
    rows.push(values.join('\t'));
  }
  return rows.join('\n');
}

function spreadsheetEnsureCapacity(object,minRows,minCols) {
  const rows=Math.max(object.rows,Math.round(minRows)||1);
  const cols=Math.max(object.cols,Math.round(minCols)||1);
  if (rows>30 || cols>30) {
    toast('Notebook tables currently support up to 30 rows and 30 columns.');
    return false;
  }
  object.rows=rows;
  object.cols=cols;
  normalizeAdvancedSpatialTable?.(object);
  ensureSemanticTableRows?.(object,{persist:false});
  return true;
}

function spreadsheetRegionHitsMerge(object,r1,c1,rows,cols) {
  const r2=r1+rows-1,c2=c1+cols-1;
  return (object.merges||[]).some(merge=>{
    const intersects=r1<merge.r+merge.rows && r2>=merge.r && c1<merge.c+merge.cols && c2>=merge.c;
    if (!intersects) return false;
    /* A one-cell paste into the anchor of an existing merge is safe. */
    return !(rows===1 && cols===1 && r1===merge.r && c1===merge.c);
  });
}

function spreadsheetApplyCellPayload(object,payload,destR,destC,{copyStyle=true}={}) {
  object.cells[destR] ||= [];
  const destKey=notebookFunctionCellKey(destR,destC);
  object.cells[destR][destC]=String(payload?.value??'');

  object.cellFormulas ||= {};
  if (payload?.formula) {
    const dr=destR-(Number(payload.sourceR)||0);
    const dc=destC-(Number(payload.sourceC)||0);
    object.cellFormulas[destKey]=spreadsheetFormulaShifted(payload.formula,dr,dc);
  } else {
    delete object.cellFormulas[destKey];
  }

  if (copyStyle) {
    object.cellStyles ||= {};
    if (payload?.style && Object.keys(payload.style).length) object.cellStyles[destKey]=spreadsheetClone(payload.style);
    else delete object.cellStyles[destKey];
  }
}

function spreadsheetFinishMutation(object,bounds) {
  recalcNotebookTableFormulas?.(object);
  object.updatedAt=new Date().toISOString();
  activeSpatialTableSelection={
    objectId:object.id,
    start:{r:bounds.r1,c:bounds.c1},
    end:{r:bounds.r2,c:bounds.c2}
  };
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
  save();
  renderAll();
}

function spreadsheetPasteInternal(object,startR,startC,payload,selectionBounds=null) {
  if (!payload || payload.version!==1 || !Array.isArray(payload.cells)) return false;
  let rows=Math.max(1,Number(payload.rows)||1);
  let cols=Math.max(1,Number(payload.cols)||1);
  const repeatSingle=rows===1 && cols===1 && selectionBounds && (selectionBounds.rows>1 || selectionBounds.cols>1);
  if (repeatSingle) {
    rows=selectionBounds.rows;
    cols=selectionBounds.cols;
    startR=selectionBounds.r1;
    startC=selectionBounds.c1;
  }
  if (!spreadsheetEnsureCapacity(object,startR+rows,startC+cols)) return true;
  if (spreadsheetRegionHitsMerge(object,startR,startC,rows,cols)) {
    toast('Split merged cells before pasting across this range.');
    return true;
  }

  notebookPushUndoCheckpoint?.();
  if (repeatSingle) {
    const source=payload.cells[0];
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
      spreadsheetApplyCellPayload(object,source,startR+r,startC+c,{copyStyle:true});
    }
  } else {
    payload.cells.forEach(cell=>{
      const r=startR+(Number(cell.relR)||0);
      const c=startC+(Number(cell.relC)||0);
      if (r>=startR+rows || c>=startC+cols) return;
      spreadsheetApplyCellPayload(object,cell,r,c,{copyStyle:true});
    });
  }
  spreadsheetFinishMutation(object,{r1:startR,c1:startC,r2:startR+rows-1,c2:startC+cols-1,rows,cols});
  return true;
}

function spreadsheetPlainTextMatrix(text) {
  const normalized=String(text??'').replace(/\r/g,'');
  const rows=normalized.split('\n');
  if (rows.length>1 && rows.at(-1)==='') rows.pop();
  return rows.map(row=>row.split('\t'));
}

function spreadsheetApplyTypedFormulaAt(object,r,c,text,{checkpoint=false}={}) {
  const parsed=spreadsheetParseFormulaText(text,object);
  if (!parsed || parsed.error) return parsed || null;
  const targetKey=notebookFunctionCellKey(r,c);
  const sources=(parsed.sources||[]).filter(key=>key!==targetKey);
  if (checkpoint) notebookPushUndoCheckpoint?.();
  object.cellFormulas ||= {};
  object.cellFormulas[targetKey]={type:parsed.type,sources};
  object.cells[r] ||= [];
  object.cells[r][c]='';
  object.cellStyles ||= {};
  object.cellStyles[targetKey] ||= {};
  if (!object.cellStyles[targetKey].align) object.cellStyles[targetKey].align='right';
  recalcNotebookTableFormulas?.(object);
  return {type:parsed.type,sources};
}

function spreadsheetPastePlainText(object,startR,startC,text,selectionBounds=null) {
  let matrix=spreadsheetPlainTextMatrix(text);
  if (!matrix.length) return false;
  let rows=matrix.length;
  let cols=Math.max(1,...matrix.map(row=>row.length));
  const repeatSingle=rows===1 && cols===1 && selectionBounds && (selectionBounds.rows>1 || selectionBounds.cols>1);
  if (repeatSingle) {
    const value=matrix[0][0];
    rows=selectionBounds.rows;
    cols=selectionBounds.cols;
    startR=selectionBounds.r1;
    startC=selectionBounds.c1;
    matrix=Array.from({length:rows},()=>Array.from({length:cols},()=>value));
  }
  if (!spreadsheetEnsureCapacity(object,startR+rows,startC+cols)) return true;
  if (spreadsheetRegionHitsMerge(object,startR,startC,rows,cols)) {
    toast('Split merged cells before pasting across this range.');
    return true;
  }

  notebookPushUndoCheckpoint?.();
  object.cellFormulas ||= {};
  for (let rr=0;rr<rows;rr++) {
    for (let cc=0;cc<cols;cc++) {
      const r=startR+rr,c=startC+cc;
      const value=String(matrix[rr]?.[cc]??'');
      const key=notebookFunctionCellKey(r,c);
      const parsed=value.trim().startsWith('=') ? spreadsheetApplyTypedFormulaAt(object,r,c,value) : null;
      if (parsed?.error) {
        object.cells[r][c]=value;
        delete object.cellFormulas[key];
      } else if (!parsed) {
        object.cells[r][c]=value;
        delete object.cellFormulas[key];
      }
    }
  }
  spreadsheetFinishMutation(object,{r1:startR,c1:startC,r2:startR+rows-1,c2:startC+cols-1,rows,cols});
  return true;
}

function spreadsheetCurrentPasteTarget(event) {
  const targetTd=event.target?.closest?.('.spatial-object-table td') || document.activeElement?.closest?.('.spatial-object-table td');
  const context=spreadsheetTableContext(targetTd);
  if (!context) return null;
  const selection=(typeof activeSpatialTableSelection!=='undefined') ? activeSpatialTableSelection : null;
  const bounds=selection?.objectId===context.object.id ? spatialSelectionBoundsForTable?.(selection) : null;
  const r=Number(targetTd.dataset.spatialRow)||0;
  const c=Number(targetTd.dataset.spatialCol)||0;
  return {context,bounds,startR:bounds?.r1??r,startC:bounds?.c1??c};
}

if (!window.__salesShopSpreadsheetClipboard) {
  window.__salesShopSpreadsheetClipboard=true;

  document.addEventListener('copy',event=>{
    if (spreadsheetSelectionHasDomText()) return;
    const ctx=spreadsheetSelectionContext();
    if (!ctx) return;
    const activeInNotebook=event.target?.closest?.('#notebookDock') || document.activeElement?.closest?.('#notebookDock');
    if (!activeInNotebook) return;
    const payload=spreadsheetSelectionClipboardPayload(ctx.object,ctx.bounds);
    event.clipboardData?.setData('text/plain',spreadsheetSelectionPlainText(ctx.object,ctx.bounds));
    try { event.clipboardData?.setData(SALESSHOP_TABLE_CLIPBOARD_MIME,JSON.stringify(payload)); } catch {}
    event.preventDefault();
  });

  document.addEventListener('paste',event=>{
    const target=spreadsheetCurrentPasteTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    let internal=null;
    try {
      const raw=event.clipboardData?.getData(SALESSHOP_TABLE_CLIPBOARD_MIME);
      if (raw) internal=JSON.parse(raw);
    } catch {}
    if (internal && spreadsheetPasteInternal(target.context.object,target.startR,target.startC,internal,target.bounds)) return;
    spreadsheetPastePlainText(target.context.object,target.startR,target.startC,event.clipboardData?.getData('text/plain')||'',target.bounds);
  },true);
}

function spreadsheetRangeEndTarget(table,end,direction) {
  const current=notebookTableCellAt?.(table,end.r,end.c);
  if (!current) return null;
  const r=Number(current.dataset.spatialRow)||0;
  const c=Number(current.dataset.spatialCol)||0;
  const rows=Math.max(1,Number(current.rowSpan)||1);
  const cols=Math.max(1,Number(current.colSpan)||1);
  let tr=r,tc=c;
  if (direction==='left') tc=c-1;
  if (direction==='right') tc=c+cols;
  if (direction==='up') tr=r-1;
  if (direction==='down') tr=r+rows;
  return notebookTableCellAt?.(table,tr,tc) || null;
}

function spreadsheetRefreshRangeUi(object,wrap,table,selection) {
  activeSpatialTableSelection=selection;
  selectedSpatialObjectId=object.id;
  wrap.classList.add('is-selected','format-open');
  paintSpatialTableSelection?.(table,object);
  const old=$('.spatial-table-controls',wrap);
  if (old) old.replaceWith(advancedSpatialTableControls(object));
}

function bindSpreadsheetShiftArrow(table,object,wrap) {
  if (!table || table.dataset.spreadsheetShiftArrowBound) return;
  table.dataset.spreadsheetShiftArrowBound='1';
  table.addEventListener('keydown',event=>{
    if (event.defaultPrevented || event.isComposing || !event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[event.key];
    if (!direction) return;
    const td=event.target.closest('td');
    if (!td || !table.contains(td)) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const current={r:Number(td.dataset.spatialRow)||0,c:Number(td.dataset.spatialCol)||0};
    const live=(typeof activeSpatialTableSelection!=='undefined' && activeSpatialTableSelection?.objectId===object.id)
      ? activeSpatialTableSelection
      : {objectId:object.id,start:{...current},end:{...current}};
    const target=spreadsheetRangeEndTarget(table,live.end,direction);
    if (!target) return;
    const end={r:Number(target.dataset.spatialRow)||0,c:Number(target.dataset.spatialCol)||0};
    notebookPlaceCaretInCell?.(target,direction==='right'?'start':'end');
    const next={objectId:object.id,start:{...live.start},end};
    spreadsheetRefreshRangeUi(object,wrap,table,next);
    if (typeof clearNotebookFormulaInspection==='function' && (next.start.r!==end.r || next.start.c!==end.c)) clearNotebookFormulaInspection();
    if (typeof notebookFunctionPickMode!=='undefined' && notebookFunctionPickMode?.objectId===object.id) {
      setTimeout(()=>applyNotebookFunctionSourceSelection?.(object,{toggle:false}),0);
    }
  },true);
}

function spreadsheetSelectionIntersectsMerge(object,bounds) {
  return (object.merges||[]).some(merge=>bounds.r1<merge.r+merge.rows && bounds.r2>=merge.r && bounds.c1<merge.c+merge.cols && bounds.c2>=merge.c);
}

function spreadsheetFillSelection(object,bounds,direction) {
  if (!object || !bounds) return false;
  if (direction==='down' && bounds.rows<2) return false;
  if (direction==='right' && bounds.cols<2) return false;
  if (spreadsheetSelectionIntersectsMerge(object,bounds)) {
    toast('Split merged cells before filling this range.');
    return true;
  }
  notebookPushUndoCheckpoint?.();
  if (direction==='down') {
    for (let c=bounds.c1;c<=bounds.c2;c++) {
      const source=spreadsheetCellPayload(object,bounds.r1,c);
      for (let r=bounds.r1+1;r<=bounds.r2;r++) spreadsheetApplyCellPayload(object,source,r,c,{copyStyle:true});
    }
  } else {
    for (let r=bounds.r1;r<=bounds.r2;r++) {
      const source=spreadsheetCellPayload(object,r,bounds.c1);
      for (let c=bounds.c1+1;c<=bounds.c2;c++) spreadsheetApplyCellPayload(object,source,r,c,{copyStyle:true});
    }
  }
  spreadsheetFinishMutation(object,bounds);
  return true;
}

if (!window.__salesShopSpreadsheetFillKeys) {
  window.__salesShopSpreadsheetFillKeys=true;
  document.addEventListener('keydown',event=>{
    if (event.defaultPrevented || event.isComposing || !(event.ctrlKey||event.metaKey) || event.altKey || event.shiftKey) return;
    const key=String(event.key||'').toLowerCase();
    if (key!=='d' && key!=='r') return;
    const ctx=spreadsheetSelectionContext();
    if (!ctx) return;
    if (key==='d' && ctx.bounds.rows<2) return;
    if (key==='r' && ctx.bounds.cols<2) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    spreadsheetFillSelection(ctx.object,ctx.bounds,key==='d'?'down':'right');
  },true);
}

function spreadsheetCommitTypedFormulaCell(td,object,{moveDown=false,silent=false}={}) {
  if (!td || !object) return false;
  const text=String(td.textContent||'').trim();
  if (!text.startsWith('=')) return false;
  const parsed=spreadsheetParseFormulaText(text,object);
  if (!parsed || parsed.error) {
    if (!silent) toast(parsed?.error || 'Try a formula like =SUM(B2:B8).');
    return false;
  }
  const r=Number(td.dataset.spatialRow)||0;
  const c=Number(td.dataset.spatialCol)||0;
  const nextCell=moveDown ? notebookTableCellAt?.($('.spatial-table',td.closest('.spatial-object-table')),r+Math.max(1,Number(td.rowSpan)||1),c) : null;
  const nextCoords=nextCell ? {r:Number(nextCell.dataset.spatialRow)||0,c:Number(nextCell.dataset.spatialCol)||0} : null;
  notebookPushUndoCheckpoint?.();
  spreadsheetApplyTypedFormulaAt(object,r,c,text);
  object.updatedAt=new Date().toISOString();
  notebookFormulaInspection={objectId:object.id,targetKey:notebookFunctionCellKey(r,c)};
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
  removeCellFunctionPalette?.();
  save();
  td.dataset.spreadsheetFormulaCommitted='1';
  renderAll();
  if (nextCoords) {
    setTimeout(()=>{
      const wrap=$(`#notebookDock [data-spatial-object-id="${object.id}"]`);
      const table=wrap ? $('.spatial-table',wrap) : null;
      const target=table ? notebookTableCellAt?.(table,nextCoords.r,nextCoords.c) : null;
      if (target) notebookPlaceCaretInCell?.(target,'end');
    },0);
  } else setTimeout(()=>renderNotebookFormulaInspection?.(),0);
  return true;
}

function bindSpreadsheetDirectFormula(table,object) {
  if (!table || table.dataset.spreadsheetFormulaTypingBound) return;
  table.dataset.spreadsheetFormulaTypingBound='1';

  table.addEventListener('keydown',event=>{
    if (event.defaultPrevented || event.isComposing || event.key!=='Enter' || event.shiftKey) return;
    if (typeof notebookFunctionPickMode!=='undefined' && notebookFunctionPickMode) return;
    const td=event.target.closest('td');
    if (!td || !String(td.textContent||'').trim().startsWith('=')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    spreadsheetCommitTypedFormulaCell(td,object,{moveDown:true,silent:false});
  },true);

  table.addEventListener('focusout',event=>{
    const td=event.target.closest('td');
    if (!td || td.dataset.spreadsheetFormulaCommitted) return;
    const text=String(td.textContent||'').trim();
    if (!text.startsWith('=') || (typeof notebookFunctionPickMode!=='undefined' && notebookFunctionPickMode)) return;
    setTimeout(()=>{
      if (!td.isConnected || td.dataset.spreadsheetFormulaCommitted) return;
      spreadsheetCommitTypedFormulaCell(td,object,{moveDown:false,silent:true});
    },0);
  });
}

function installNotebookSpreadsheetCore(root=$('#notebookDock')) {
  if (!root) return;
  $$('.spatial-object-table',root).forEach(wrap=>{
    const object=spatialObjectById?.(wrap.dataset.spatialObjectId);
    const table=$('.spatial-table',wrap);
    if (!object || !table) return;
    bindSpreadsheetShiftArrow(table,object,wrap);
    bindSpreadsheetDirectFormula(table,object);
  });
}

const _spreadsheetCoreRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _spreadsheetCoreRender(root);
  if (!root) return;
  installNotebookSpreadsheetCore(root);
};
