/* Advanced spatial table cells: drag range selection, merge/split, and cell alignment. */

let activeSpatialTableSelection = null;

function spatialCellKey(row,col) { return `${row}:${col}`; }

function normalizeAdvancedSpatialTable(object) {
  normalizeSpatialTable(object);
  object.merges ||= [];
  object.cellStyles ||= {};
  object.merges = object.merges.filter(m=>{
    m.r=Math.max(0,Math.round(Number(m.r)||0));
    m.c=Math.max(0,Math.round(Number(m.c)||0));
    m.rows=Math.max(1,Math.round(Number(m.rows)||1));
    m.cols=Math.max(1,Math.round(Number(m.cols)||1));
    return m.r<object.rows && m.c<object.cols;
  }).map(m=>({
    ...m,
    rows:Math.min(m.rows,object.rows-m.r),
    cols:Math.min(m.cols,object.cols-m.c)
  }));
}

function spatialMergeCovering(object,row,col) {
  normalizeAdvancedSpatialTable(object);
  return object.merges.find(m=>row>=m.r && row<m.r+m.rows && col>=m.c && col<m.c+m.cols) || null;
}

function spatialSelectionBoundsForTable(selection=activeSpatialTableSelection) {
  if (!selection) return null;
  const r1=Math.min(selection.start.r,selection.end.r);
  const r2=Math.max(selection.start.r,selection.end.r);
  const c1=Math.min(selection.start.c,selection.end.c);
  const c2=Math.max(selection.start.c,selection.end.c);
  return {r1,r2,c1,c2,rows:r2-r1+1,cols:c2-c1+1};
}

function selectionIntersectsMerge(bounds,merge) {
  return bounds.r1 < merge.r+merge.rows && bounds.r2 >= merge.r && bounds.c1 < merge.c+merge.cols && bounds.c2 >= merge.c;
}
function selectionContainsMerge(bounds,merge) {
  return bounds.r1<=merge.r && bounds.r2>=merge.r+merge.rows-1 && bounds.c1<=merge.c && bounds.c2>=merge.c+merge.cols-1;
}

function selectedSpatialTableCells(object) {
  const selection=activeSpatialTableSelection;
  if (!selection || selection.objectId!==object.id) return [];
  const bounds=spatialSelectionBoundsForTable(selection);
  const out=[];
  for(let r=bounds.r1;r<=bounds.r2;r++) for(let c=bounds.c1;c<=bounds.c2;c++) out.push({r,c});
  return out;
}

function spatialTableSelectionAlign(object) {
  const cells=selectedSpatialTableCells(object);
  const first=cells[0] || {r:0,c:0};
  const merge=spatialMergeCovering(object,first.r,first.c);
  const key=spatialCellKey(merge?.r ?? first.r,merge?.c ?? first.c);
  return object.cellStyles?.[key]?.align || 'left';
}

function applySpatialTableAlignment(object,align) {
  if (!['left','center','right'].includes(align)) return;
  normalizeAdvancedSpatialTable(object);
  let cells=selectedSpatialTableCells(object);
  if (!cells.length) return;
  if (typeof notebookPushUndoCheckpoint==='function') notebookPushUndoCheckpoint();
  const anchors=new Set();
  cells.forEach(({r,c})=>{
    const merge=spatialMergeCovering(object,r,c);
    anchors.add(spatialCellKey(merge?.r ?? r,merge?.c ?? c));
  });
  anchors.forEach(key=>{
    object.cellStyles[key] ||= {};
    object.cellStyles[key].align=align;
  });
  object.updatedAt=new Date().toISOString();
  save();
  renderAll();
}

function mergeSelectedSpatialTableCells(object) {
  normalizeAdvancedSpatialTable(object);
  const selection=activeSpatialTableSelection;
  if (!selection || selection.objectId!==object.id) return;
  const bounds=spatialSelectionBoundsForTable(selection);
  if (bounds.rows===1 && bounds.cols===1) return;

  const partial=object.merges.find(m=>selectionIntersectsMerge(bounds,m) && !selectionContainsMerge(bounds,m));
  if (partial) return toast('Select the entire existing merged cell before merging this range.');

  if (typeof notebookPushUndoCheckpoint==='function') notebookPushUndoCheckpoint();
  const values=[];
  for(let r=bounds.r1;r<=bounds.r2;r++) {
    for(let c=bounds.c1;c<=bounds.c2;c++) {
      const value=String(object.cells?.[r]?.[c] || '').trim();
      if (value) values.push(value);
      if (object.cells?.[r]) object.cells[r][c]='';
    }
  }
  object.merges=object.merges.filter(m=>!selectionIntersectsMerge(bounds,m));
  object.merges.push({r:bounds.r1,c:bounds.c1,rows:bounds.rows,cols:bounds.cols});
  object.cells[bounds.r1][bounds.c1]=values.join('\n');
  object.updatedAt=new Date().toISOString();
  activeSpatialTableSelection={objectId:object.id,start:{r:bounds.r1,c:bounds.c1},end:{r:bounds.r1,c:bounds.c1}};
  selectedSpatialObjectId=object.id;
  save();
  renderAll();
}

function splitSelectedSpatialTableCell(object) {
  normalizeAdvancedSpatialTable(object);
  const selection=activeSpatialTableSelection;
  if (!selection || selection.objectId!==object.id) return;
  const cell=selection.start;
  const merge=spatialMergeCovering(object,cell.r,cell.c);
  if (!merge || (merge.rows===1 && merge.cols===1)) return;
  if (typeof notebookPushUndoCheckpoint==='function') notebookPushUndoCheckpoint();
  object.merges=object.merges.filter(m=>m!==merge);
  object.updatedAt=new Date().toISOString();
  activeSpatialTableSelection={objectId:object.id,start:{r:merge.r,c:merge.c},end:{r:merge.r,c:merge.c}};
  selectedSpatialObjectId=object.id;
  save();
  renderAll();
}

function spatialAlignmentGlyph(align) {
  return `<span class="spatial-align-glyph ${align}" aria-hidden="true"><i></i><i></i><i></i></span>`;
}

function advancedSpatialTableControls(object) {
  const controls=spatialTableControls(object);
  controls.classList.add('spatial-table-controls-advanced');
  const selection=activeSpatialTableSelection?.objectId===object.id ? activeSpatialTableSelection : null;
  const bounds=selection ? spatialSelectionBoundsForTable(selection) : null;
  const merge=selection ? spatialMergeCovering(object,selection.start.r,selection.start.c) : null;

  const divider=document.createElement('span');
  divider.className='spatial-table-control-separator';
  controls.appendChild(divider);

  const mergeButton=document.createElement('button');
  mergeButton.type='button';
  mergeButton.className='spatial-table-merge-button';
  if (merge && merge.rows*merge.cols>1 && (!bounds || (bounds.rows===1 && bounds.cols===1))) {
    mergeButton.textContent='Split';
    mergeButton.title='Split merged cell';
    mergeButton.onclick=e=>{e.preventDefault();e.stopPropagation();splitSelectedSpatialTableCell(object);};
  } else {
    mergeButton.textContent='Merge';
    mergeButton.title='Merge selected cells';
    mergeButton.disabled=!bounds || (bounds.rows===1 && bounds.cols===1);
    mergeButton.onclick=e=>{e.preventDefault();e.stopPropagation();mergeSelectedSpatialTableCells(object);};
  }
  controls.appendChild(mergeButton);

  const align=spatialTableSelectionAlign(object);
  const alignWrap=document.createElement('span');
  alignWrap.className='spatial-align-control';
  alignWrap.dataset.activeAlign=align;
  ['left','center','right'].forEach(value=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=`spatial-align-choice${value===align?' active':''}`;
    button.dataset.tableAlign=value;
    button.title=`Align ${value}`;
    button.setAttribute('aria-label',`Align ${value}`);
    button.innerHTML=spatialAlignmentGlyph(value);
    button.onclick=e=>{e.preventDefault();e.stopPropagation();applySpatialTableAlignment(object,value);};
    alignWrap.appendChild(button);
  });
  controls.appendChild(alignWrap);
  return controls;
}

function paintSpatialTableSelection(table,object) {
  const selection=activeSpatialTableSelection;
  $$('td',table).forEach(td=>td.classList.remove('spatial-table-cell-selected'));
  if (!selection || selection.objectId!==object.id) return;
  const bounds=spatialSelectionBoundsForTable(selection);
  $$('td',table).forEach(td=>{
    const r=Number(td.dataset.spatialRow), c=Number(td.dataset.spatialCol);
    const merge=spatialMergeCovering(object,r,c);
    const mr=merge?.r ?? r, mc=merge?.c ?? c;
    const mr2=merge ? merge.r+merge.rows-1 : r;
    const mc2=merge ? merge.c+merge.cols-1 : c;
    if (mr<=bounds.r2 && mr2>=bounds.r1 && mc<=bounds.c2 && mc2>=bounds.c1) td.classList.add('spatial-table-cell-selected');
  });
}

function bindSpatialTableRangeSelection(table,object,wrap) {
  if (!table || table.dataset.rangeSelectBound) return;
  table.dataset.rangeSelectBound='1';
  let start=null;
  let selecting=false;

  const coords=td=>({r:Number(td.dataset.spatialRow)||0,c:Number(td.dataset.spatialCol)||0});
  const setSelection=(a,b)=>{
    activeSpatialTableSelection={objectId:object.id,start:a,end:b};
    selectedSpatialObjectId=object.id;
    wrap.classList.add('is-selected');
    paintSpatialTableSelection(table,object);
  };

  table.addEventListener('pointerdown',event=>{
    if (event.button!==0) return;
    const td=event.target.closest('td');
    if (!td) return;
    start={coords:coords(td),x:event.clientX,y:event.clientY,pointerId:event.pointerId,td};
    selecting=false;
    setSelection(start.coords,start.coords);
  });
  table.addEventListener('pointermove',event=>{
    if (!start || event.pointerId!==start.pointerId) return;
    const hovered=document.elementFromPoint(event.clientX,event.clientY)?.closest?.('td');
    if (!hovered || !table.contains(hovered)) return;
    const end=coords(hovered);
    if (!selecting && end.r===start.coords.r && end.c===start.coords.c) return;
    selecting=true;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    setSelection(start.coords,end);
  },{passive:false});
  table.addEventListener('pointerup',event=>{
    if (!start || event.pointerId!==start.pointerId) return;
    if (selecting) {
      event.preventDefault();
      event.stopPropagation();
    }
    start=null;
    selecting=false;
    const old=$('.spatial-table-controls',wrap);
    old?.replaceWith(advancedSpatialTableControls(object));
  });

  table.addEventListener('focusin',event=>{
    const td=event.target.closest('td');
    if (!td) return;
    const cell=coords(td);
    setSelection(cell,cell);
    const old=$('.spatial-table-controls',wrap);
    old?.replaceWith(advancedSpatialTableControls(object));
  });
}

/* Full table renderer so colspan/rowspan are first-class instead of visual hacks. */
renderSpatialTable=function(object,wrap) {
  normalizeAdvancedSpatialTable(object);
  const table=document.createElement('table');
  table.className='spatial-table';
  const editable=typeof isCurrentNotebookPageEditable!=='function' || isCurrentNotebookPageEditable();

  for(let r=0;r<object.rows;r++) {
    const tr=document.createElement('tr');
    for(let c=0;c<object.cols;c++) {
      const merge=spatialMergeCovering(object,r,c);
      if (merge && (merge.r!==r || merge.c!==c)) continue;
      const td=document.createElement('td');
      td.dataset.spatialRow=String(r);
      td.dataset.spatialCol=String(c);
      if (merge) {
        td.rowSpan=merge.rows;
        td.colSpan=merge.cols;
        td.classList.add('spatial-table-cell-merged');
      }
      td.contentEditable=editable?'true':'false';
      td.spellcheck=true;
      td.textContent=object.cells?.[r]?.[c] || '';
      td.style.textAlign=object.cellStyles?.[spatialCellKey(r,c)]?.align || 'left';
      if (editable) td.addEventListener('input',()=>{
        object.cells[r] ||= [];
        object.cells[r][c]=td.textContent || '';
        object.updatedAt=new Date().toISOString();
        save();
      });
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  wrap.appendChild(table);
  bindSpatialTableNavigation(table);
  bindSpatialTableRangeSelection(table,object,wrap);
  paintSpatialTableSelection(table,object);
  if (editable) wrap.appendChild(advancedSpatialTableControls(object));
};
