/* Spatial object tools: adjustable tables and callout-style cloud frames. */

function spatialObjectById(id) {
  return spatialObjects().find(object=>object.id===id) || null;
}

function normalizeSpatialTable(object) {
  object.cols=Math.max(1,Math.round(Number(object.cols)||1));
  object.rows=Math.max(1,Math.round(Number(object.rows)||1));
  object.cells ||= [];
  while (object.cells.length < object.rows) object.cells.push([]);
  object.cells.length=object.rows;
  object.cells.forEach(row=>{
    while (row.length < object.cols) row.push('');
    row.length=object.cols;
  });
}

function spatialTableEdgeHasText(object,axis) {
  normalizeSpatialTable(object);
  if (axis==='col') {
    const c=object.cols-1;
    return object.cells.some(row=>String(row[c]||'').trim());
  }
  const r=object.rows-1;
  return (object.cells[r]||[]).some(value=>String(value||'').trim());
}

function resizeSpatialTable(object,{cols=0,rows=0}={}) {
  if (!object || object.type!=='table') return;
  normalizeSpatialTable(object);

  if (cols<0 && object.cols<=1) return;
  if (rows<0 && object.rows<=1) return;
  if (cols<0 && spatialTableEdgeHasText(object,'col')) {
    toast('Clear the last column before removing it.');
    return;
  }
  if (rows<0 && spatialTableEdgeHasText(object,'row')) {
    toast('Clear the last row before removing it.');
    return;
  }

  if (typeof notebookPushUndoCheckpoint==='function') notebookPushUndoCheckpoint();
  object.cols=Math.max(1,Math.min(30,object.cols+Math.sign(cols)));
  object.rows=Math.max(1,Math.min(30,object.rows+Math.sign(rows)));
  normalizeSpatialTable(object);
  object.updatedAt=new Date().toISOString();
  selectedSpatialObjectId=object.id;
  save();
  renderAll();
}

function spatialTableDimensionStepper(axis,count) {
  const isCols=axis==='cols';
  const wrap=document.createElement('span');
  wrap.className='spatial-table-dimension-stepper';
  wrap.dataset.tableDimension=axis;
  wrap.title=isCols ? `${count} column${count===1?'':'s'}` : `${count} row${count===1?'':'s'}`;
  wrap.innerHTML=`
    <span class="spatial-table-dimension-icon ${isCols?'cols':'rows'}" aria-hidden="true"></span>
    <button type="button" ${isCols?'data-table-cols':'data-table-rows'}="-1" title="Remove ${isCols?'column':'row'}" aria-label="Remove ${isCols?'column':'row'}">−</button>
    <span class="spatial-table-count">${count}</span>
    <button type="button" ${isCols?'data-table-cols':'data-table-rows'}="1" title="Add ${isCols?'column':'row'}" aria-label="Add ${isCols?'column':'row'}">+</button>`;
  return wrap;
}

function spatialTableControls(object) {
  const controls=document.createElement('div');
  controls.className='spatial-table-controls';
  controls.append(
    spatialTableDimensionStepper('cols',object.cols),
    spatialTableDimensionStepper('rows',object.rows)
  );

  $$('[data-table-cols]',controls).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    resizeSpatialTable(object,{cols:Number(button.dataset.tableCols)});
  });
  $$('[data-table-rows]',controls).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    resizeSpatialTable(object,{rows:Number(button.dataset.tableRows)});
  });
  return controls;
}

function bindSpatialTableNavigation(table) {
  if (!table || table.dataset.tableNavBound) return;
  table.dataset.tableNavBound='1';
  table.addEventListener('keydown',event=>{
    if (event.key!=='Tab') return;
    const cell=event.target.closest('td');
    if (!cell) return;
    const cells=$$('td',table);
    const index=cells.indexOf(cell);
    if (index<0) return;
    const next=index+(event.shiftKey?-1:1);
    if (next<0 || next>=cells.length) return;
    event.preventDefault();
    cells[next].focus();
  });
}

const _salesShopSpatialToolsRenderTable=renderSpatialTable;
renderSpatialTable=function(object,wrap) {
  normalizeSpatialTable(object);
  _salesShopSpatialToolsRenderTable(object,wrap);
  const table=$('.spatial-table',wrap);
  bindSpatialTableNavigation(table);
  const editable=typeof isCurrentNotebookPageEditable!=='function' || isCurrentNotebookPageEditable();
  if (editable) wrap.appendChild(spatialTableControls(object));
};

/* A callout cloud should occupy the selected rectangle; only its perimeter is cloud-like. */
const SPATIAL_CALLOUT_CLOUD_PATH='M8 4 Q12 -1 16 4 Q20 9 24 4 Q28 -1 32 4 Q36 9 40 4 Q44 -1 48 4 Q52 9 56 4 Q60 -1 64 4 Q68 9 72 4 Q76 -1 80 4 Q84 9 88 4 Q94 0 96 6 Q101 10 96 14 Q91 18 96 22 Q101 26 96 30 Q91 34 96 38 Q101 42 96 46 Q91 50 96 54 Q94 60 88 56 Q84 51 80 56 Q76 61 72 56 Q68 51 64 56 Q60 61 56 56 Q52 51 48 56 Q44 61 40 56 Q36 51 32 56 Q28 61 24 56 Q20 51 16 56 Q12 61 8 56 Q2 60 4 54 Q-1 50 4 46 Q9 42 4 38 Q-1 34 4 30 Q9 26 4 22 Q-1 18 4 14 Q9 10 4 6 Q2 0 8 4 Z';

const _salesShopSpatialToolsRenderObject=renderSpatialObject;
renderSpatialObject=function(object,canvas) {
  _salesShopSpatialToolsRenderObject(object,canvas);
  const escaped=(window.CSS&&CSS.escape)?CSS.escape(object.id):object.id;
  const wrap=canvas.querySelector(`[data-spatial-object-id="${escaped}"]`);
  if (!wrap) return;

  if (object.type==='cloud') {
    const path=$('.spatial-cloud-svg path',wrap);
    path?.setAttribute('d',SPATIAL_CALLOUT_CLOUD_PATH);
  }

  /* Clicking into a table should select the table object too, so its controls become available. */
  wrap.addEventListener('focusin',()=>{
    selectedSpatialObjectId=object.id;
    $$('.notebook-spatial-object.is-selected',canvas).forEach(el=>el.classList.remove('is-selected'));
    wrap.classList.add('is-selected');
  });

  if (selectedSpatialObjectId===object.id) wrap.classList.add('is-selected');
};
