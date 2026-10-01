/* Spatial interaction polish: exact table footprint, range clearing, robust notebook undo,
   and common hover controls for tables / rectangles / clouds. */

let openSpatialFormatObjectId = null;

/* A table column is two spatial squares wide. When a spatial range becomes a table, derive
   the logical column count from the selected physical width so the table fits inside the
   selection instead of doubling it. Odd half-cell widths round down. */
const _salesShopExactFootprintCreateSpatialObject = createSpatialObject;
createSpatialObject = function(type,bounds) {
  if (type === 'table' && bounds) {
    const squaresPerColumn = (typeof SPATIAL_TABLE_DEFAULT_COL_SQUARES !== 'undefined')
      ? Math.max(1,Number(SPATIAL_TABLE_DEFAULT_COL_SQUARES) || 2)
      : 2;
    const selectedSquares = Math.max(1,Math.round(Number(bounds.cols) || 1));
    const logicalCols = Math.max(1,Math.floor(selectedSquares / squaresPerColumn));
    const rows = Math.max(1,Math.round(Number(bounds.rows) || 1));
    return _salesShopExactFootprintCreateSpatialObject(type,{...bounds,cols:logicalCols,rows});
  }
  return _salesShopExactFootprintCreateSpatialObject(type,bounds);
};

function spatialTableSelectionIsRange() {
  const selection = (typeof activeSpatialTableSelection !== 'undefined') ? activeSpatialTableSelection : null;
  if (!selection) return false;
  const bounds = spatialSelectionBoundsForTable?.(selection);
  return !!bounds && (bounds.rows > 1 || bounds.cols > 1);
}

function clearSelectedSpatialTableContents() {
  const selection = (typeof activeSpatialTableSelection !== 'undefined') ? activeSpatialTableSelection : null;
  if (!selection || !spatialTableSelectionIsRange()) return false;
  const object = spatialObjectById?.(selection.objectId);
  if (!object || object.type !== 'table') return false;

  normalizeAdvancedSpatialTable?.(object);
  const cells = selectedSpatialTableCells?.(object) || [];
  if (!cells.length) return false;

  if (typeof notebookPushUndoCheckpoint === 'function') notebookPushUndoCheckpoint();
  const anchors = new Set();
  cells.forEach(({r,c})=>{
    const merge = spatialMergeCovering?.(object,r,c);
    anchors.add(spatialCellKey(merge?.r ?? r,merge?.c ?? c));
  });
  anchors.forEach(key=>{
    const [r,c] = key.split(':').map(Number);
    if (object.cells?.[r]) object.cells[r][c] = '';
  });
  object.updatedAt = new Date().toISOString();
  selectedSpatialObjectId = object.id;
  save();
  renderAll();
  return true;
}

/* Range clearing wins over the older spatial-object Delete handler. Single-cell editing keeps
   normal Backspace/Delete behavior inside contenteditable cells. */
if (!window.__salesShopSpatialRangeDelete) {
  window.__salesShopSpatialRangeDelete = true;
  document.addEventListener('keydown',event=>{
    if (!['Delete','Backspace'].includes(event.key)) return;
    if (!spatialTableSelectionIsRange()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearSelectedSpatialTableContents();
  },true);
}

/* Notebook QOL already owns the undo stacks. This bridge catches notebook-dock focus cases that
   do not sit under .notebook-shell (notably embedded table editing) without creating a second
   history system. */
if (!window.__salesShopNotebookUndoBridge) {
  window.__salesShopNotebookUndoBridge = true;
  document.addEventListener('keydown',event=>{
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = String(event.key || '').toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    const dock = $('#notebookDock');
    if (!dock || (!dock.contains(event.target) && !dock.contains(document.activeElement))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (key === 'y' || (key === 'z' && event.shiftKey)) notebookRedo?.();
    else notebookUndo?.();
  },true);
}

function spatialFormatGlyph() {
  return '<span class="spatial-format-glyph" aria-hidden="true"><i></i><i></i><i></i></span>';
}

function spatialDragGlyph() {
  return '<span class="spatial-drag-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
}

function closeOtherSpatialFormatters(canvas,except=null) {
  $$('.notebook-spatial-object.format-open',canvas).forEach(el=>{
    if (el !== except) el.classList.remove('format-open');
  });
}

function spatialObjectFormatToggle(object,wrap,canvas) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'spatial-object-format-toggle';
  button.title = 'Format';
  button.setAttribute('aria-label','Open formatting');
  button.innerHTML = spatialFormatGlyph();
  button.onclick = event=>{
    event.preventDefault();
    event.stopPropagation();
    const opening = !wrap.classList.contains('format-open');
    closeOtherSpatialFormatters(canvas,wrap);
    wrap.classList.toggle('format-open',opening);
    openSpatialFormatObjectId = opening ? object.id : null;
    selectedSpatialObjectId = object.id;
    $$('.notebook-spatial-object.is-selected',canvas).forEach(el=>el.classList.remove('is-selected'));
    wrap.classList.add('is-selected');
  };
  return button;
}

function bindSpatialObjectDragHandle(object,wrap,canvas,handle) {
  handle.addEventListener('pointerdown',event=>{
    if (event.button !== 0) return;
    if (typeof isCurrentNotebookPageEditable === 'function' && !isCurrentNotebookPageEditable()) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startCol = Math.max(0,Number(object.col)||0);
    const startRow = Math.max(0,Number(object.row)||0);
    let nextCol = startCol;
    let nextRow = startRow;
    let dragging = false;
    let checkpointed = false;
    const step = spatialStep?.() || 28;

    selectedSpatialObjectId = object.id;
    $$('.notebook-spatial-object.is-selected',canvas).forEach(el=>el.classList.remove('is-selected'));
    wrap.classList.add('is-selected');
    handle.setPointerCapture?.(event.pointerId);

    const onMove = ev=>{
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx,dy) < 3) return;
      dragging = true;
      if (!checkpointed) {
        checkpointed = true;
        notebookPushUndoCheckpoint?.();
      }
      ev.preventDefault();
      nextCol = Math.max(0,startCol + Math.round(dx / step));
      nextRow = Math.max(0,startRow + Math.round(dy / step));
      wrap.style.setProperty('--object-col',nextCol);
      wrap.style.setProperty('--object-row',nextRow);
      wrap.classList.add('is-dragging');
    };

    const onUp = ()=>{
      document.removeEventListener('pointermove',onMove);
      document.removeEventListener('pointerup',onUp);
      document.removeEventListener('pointercancel',onUp);
      wrap.classList.remove('is-dragging');
      if (!dragging) return;
      object.col = nextCol;
      object.row = nextRow;
      object.updatedAt = new Date().toISOString();
      openSpatialFormatObjectId = null;
      save();
      renderAll();
    };

    document.addEventListener('pointermove',onMove,{passive:false});
    document.addEventListener('pointerup',onUp,{once:true});
    document.addEventListener('pointercancel',onUp,{once:true});
  });
}

function spatialObjectDragHandle(object,wrap,canvas) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'spatial-object-drag-handle';
  button.title = 'Drag to move';
  button.setAttribute('aria-label','Move object');
  button.innerHTML = spatialDragGlyph();
  bindSpatialObjectDragHandle(object,wrap,canvas,button);
  return button;
}

function setSpatialShapeType(object,type) {
  if (!object || !['box','cloud'].includes(type) || object.type === type) return;
  notebookPushUndoCheckpoint?.();
  object.type = type;
  object.updatedAt = new Date().toISOString();
  selectedSpatialObjectId = object.id;
  openSpatialFormatObjectId = object.id;
  save();
  renderAll();
}

function spatialShapeToolbar(object) {
  const toolbar = document.createElement('div');
  toolbar.className = 'spatial-shape-toolbar spatial-object-format-toolbar';
  toolbar.innerHTML = `
    <button type="button" data-shape-type="box" class="${object.type==='box'?'active':''}">Rectangle</button>
    <button type="button" data-shape-type="cloud" class="${object.type==='cloud'?'active':''}">Cloud</button>
    <span class="spatial-table-control-separator"></span>
    <button type="button" data-shape-delete title="Delete">Delete</button>`;
  $$('[data-shape-type]',toolbar).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    setSpatialShapeType(object,button.dataset.shapeType);
  });
  $('[data-shape-delete]',toolbar).onclick = event=>{
    event.preventDefault();
    event.stopPropagation();
    removeSpatialObject(object.id);
  };
  return toolbar;
}

/* Keep Delete inside the table's formatting strip so all persistent spatial objects use the
   same Format -> tools pattern. */
const _salesShopSpatialAdvancedControls = advancedSpatialTableControls;
advancedSpatialTableControls = function(object) {
  const controls = _salesShopSpatialAdvancedControls(object);
  controls.classList.add('spatial-object-format-toolbar');
  if (!$('[data-table-delete]',controls)) {
    const separator = document.createElement('span');
    separator.className = 'spatial-table-control-separator';
    controls.appendChild(separator);
    const del = document.createElement('button');
    del.type = 'button';
    del.dataset.tableDelete = '';
    del.className = 'spatial-table-delete-button';
    del.title = 'Delete table';
    del.setAttribute('aria-label','Delete table');
    del.textContent = '×';
    del.onclick = event=>{
      event.preventDefault();
      event.stopPropagation();
      removeSpatialObject(object.id);
    };
    controls.appendChild(del);
  }
  return controls;
};

function installSpatialObjectHoverUI(object,canvas) {
  const escaped = (window.CSS&&CSS.escape) ? CSS.escape(object.id) : object.id;
  const wrap = canvas?.querySelector?.(`[data-spatial-object-id="${escaped}"]`);
  if (!wrap) return;
  wrap.classList.add('spatial-object-hover-ui');
  if (openSpatialFormatObjectId === object.id) wrap.classList.add('format-open');

  const editable = typeof isCurrentNotebookPageEditable !== 'function' || isCurrentNotebookPageEditable();
  if (!editable) return;

  if (!$('.spatial-object-format-toggle',wrap)) wrap.appendChild(spatialObjectFormatToggle(object,wrap,canvas));
  if (!$('.spatial-object-drag-handle',wrap)) wrap.appendChild(spatialObjectDragHandle(object,wrap,canvas));
  if ((object.type === 'box' || object.type === 'cloud') && !$('.spatial-shape-toolbar',wrap)) {
    wrap.appendChild(spatialShapeToolbar(object));
  }
}

const _salesShopSpatialHoverRenderObject = renderSpatialObject;
renderSpatialObject = function(object,canvas) {
  _salesShopSpatialHoverRenderObject(object,canvas);
  installSpatialObjectHoverUI(object,canvas);
};

/* Re-rendered advanced table controls are created after the object wrapper in some focus/range
   paths. Keep the format-open state reflected whenever a table range redraws its toolbar. */
const _salesShopAdvancedTableControlsWithOpen = advancedSpatialTableControls;
advancedSpatialTableControls = function(object) {
  const controls = _salesShopAdvancedTableControlsWithOpen(object);
  controls.classList.add('spatial-object-format-toolbar');
  return controls;
};

if (!window.__salesShopSpatialFormatDismiss) {
  window.__salesShopSpatialFormatDismiss = true;
  document.addEventListener('pointerdown',event=>{
    const object = event.target?.closest?.('.notebook-spatial-object');
    if (object) return;
    openSpatialFormatObjectId = null;
    $$('.notebook-spatial-object.format-open').forEach(el=>el.classList.remove('format-open'));
  },true);
}
