/* Spatial notebook layer.
   Lined pages are writing-oriented; Spatial pages share one free-placement coordinate system.
   Spatial background variants: blank, grid, dots. Empty-canvas drag selects grid cells that
   can become persistent page objects such as tables and shapes. */

let activeSpatialSelection = null;
let selectedSpatialObjectId = null;

/* Treat the old Blank paper as Spatial / Blank without throwing away existing page content. */
const _salesShopSpatialPaperView = notebookPaperView;
notebookPaperView = function() {
  const raw = state.settings?.notebookPaperView;
  if (raw === 'blank') return 'grid';
  return _salesShopSpatialPaperView();
};

notebookGridPaper = function() {
  const value = state.settings?.notebookGridPaper;
  if (value === 'blank' || value === 'dots') return value;
  return 'grid';
};

function migrateBlankToSpatialOnce() {
  state.settings ||= {};
  if (state.settings.spatialPaperVersion >= 1) return;
  if (state.settings.notebookPaperView === 'blank') {
    state.settings.notebookPaperView = 'grid';
    state.settings.notebookGridPaper = 'blank';
  }
  state.settings.spatialPaperVersion = 1;
  save();
}

function spatialPageKey(key=currentNotebookDate,pageId=currentNotebookPageId) {
  return `${key || dateKey()}::${pageId || ensureNotebookPage(key || dateKey())}`;
}

function spatialObjectMap() {
  state.settings ||= {};
  state.settings.notebookSpatialObjectsByPage ||= {};
  return state.settings.notebookSpatialObjectsByPage;
}

function spatialObjects() {
  const map = spatialObjectMap();
  const key = spatialPageKey();
  map[key] ||= [];
  return map[key];
}

function spatialStyleIcon(kind) {
  return `<span class="notebook-spatial-style-icon ${kind}" aria-hidden="true"></span>`;
}

function installSpatialStyleMenu(root) {
  const menu = $('[data-notebook-view-menu]',root);
  if (!menu) return;

  const view = notebookPaperView();
  const gridPaper = notebookGridPaper();
  const columns = typeof notebookColumnMode === 'function' ? notebookColumnMode() : 'one';
  const linedMode = view === 'cornell' ? 'cornell' : (view === 'lines' && columns === 'two' ? 'double' : 'single');
  const spatialMode = view === 'grid' ? gridPaper : null;

  menu.classList.add('notebook-style-groups');
  menu.innerHTML = `
    <div class="notebook-style-group">
      <div class="notebook-style-group-label">Lined</div>
      <div class="notebook-style-choice-row">
        <button type="button" class="notebook-style-choice ${linedMode==='single'?'active':''}" data-lined-style="single" title="Single-column lined paper" aria-label="Single-column lined paper">${spatialStyleIcon('lined-single')}</button>
        <button type="button" class="notebook-style-choice ${linedMode==='double'?'active':''}" data-lined-style="double" title="Two-column lined paper" aria-label="Two-column lined paper">${spatialStyleIcon('lined-double')}</button>
        <button type="button" class="notebook-style-choice notebook-style-choice-text ${linedMode==='cornell'?'active':''}" data-lined-style="cornell" title="Cornell notes" aria-label="Cornell notes">Cornell</button>
      </div>
    </div>
    <div class="notebook-style-group">
      <div class="notebook-style-group-label">Spatial</div>
      <div class="notebook-style-choice-row">
        <button type="button" class="notebook-style-choice ${spatialMode==='blank'?'active':''}" data-spatial-paper="blank" title="Blank spatial canvas" aria-label="Blank spatial canvas">${spatialStyleIcon('blank')}</button>
        <button type="button" class="notebook-style-choice ${spatialMode==='grid'?'active':''}" data-spatial-paper="grid" title="Grid paper" aria-label="Grid paper">${spatialStyleIcon('grid')}</button>
        <button type="button" class="notebook-style-choice ${spatialMode==='dots'?'active':''}" data-spatial-paper="dots" title="Dot-grid paper" aria-label="Dot-grid paper">${spatialStyleIcon('dots')}</button>
      </div>
    </div>`;

  $$('[data-lined-style]',menu).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    const mode = button.dataset.linedStyle;
    pageStateSyncDraft?.(root);
    state.settings ||= {};
    state.settings.notebookColumnMode = mode === 'double' ? 'two' : 'one';
    pageStateSwitchStyle?.(mode === 'cornell' ? 'cornell' : 'lines',root);
  });

  $$('[data-spatial-paper]',menu).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    const paper = button.dataset.spatialPaper;
    pageStateSyncDraft?.(root);
    if (notebookPaperView() !== 'grid') pageStateMaterializeDraft?.(root);
    ensureCurrentGridPlacements?.();
    state.settings ||= {};
    state.settings.notebookPaperView = 'grid';
    state.settings.notebookGridPaper = paper;
    save();
    renderAll();
  });
}

function spatialStep() {
  return typeof notebookPaperRhythm === 'function' ? notebookPaperRhythm() : 28;
}

function spatialPointerCell(canvas,event) {
  const rect = canvas.getBoundingClientRect();
  const step = spatialStep();
  return {
    col: Math.max(0,Math.floor((event.clientX - rect.left) / step)),
    row: Math.max(0,Math.floor((event.clientY - rect.top) / step))
  };
}

function spatialSelectionBounds(a,b) {
  const left = Math.min(a.col,b.col);
  const top = Math.min(a.row,b.row);
  return {
    col:left,
    row:top,
    cols:Math.abs(a.col-b.col)+1,
    rows:Math.abs(a.row-b.row)+1
  };
}

function clearSpatialSelection(canvas=$('#notebookDock .grid-notebook-canvas')) {
  activeSpatialSelection = null;
  $('.grid-cell-selection',canvas)?.remove();
  $('.grid-cell-selection-toolbar',canvas)?.remove();
}

function drawSpatialSelection(canvas,bounds,{toolbar=false}={}) {
  let box = $('.grid-cell-selection',canvas);
  if (!box) {
    box = document.createElement('div');
    box.className = 'grid-cell-selection';
    canvas.appendChild(box);
  }
  box.style.setProperty('--select-col',bounds.col);
  box.style.setProperty('--select-row',bounds.row);
  box.style.setProperty('--select-cols',bounds.cols);
  box.style.setProperty('--select-rows',bounds.rows);

  $('.grid-cell-selection-toolbar',canvas)?.remove();
  if (!toolbar) return;
  const controls = document.createElement('div');
  controls.className = 'grid-cell-selection-toolbar';
  controls.style.setProperty('--select-col',bounds.col);
  controls.style.setProperty('--select-row',bounds.row);
  controls.innerHTML = `
    <button type="button" data-spatial-create="table">Table</button>
    <button type="button" data-spatial-create="box">Box</button>
    <button type="button" data-spatial-create="cloud">Cloud</button>`;
  canvas.appendChild(controls);
  $$('[data-spatial-create]',controls).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    createSpatialObject(button.dataset.spatialCreate,bounds);
  });
}

function createSpatialObject(type,bounds) {
  if (!['table','box','cloud'].includes(type)) return;
  const object = {
    id:uid('spatial'),
    type,
    col:bounds.col,
    row:bounds.row,
    cols:bounds.cols,
    rows:bounds.rows,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  if (type === 'table') {
    object.cells = Array.from({length:bounds.rows},()=>Array.from({length:bounds.cols},()=>''));
  }
  spatialObjects().push(object);
  save();
  clearSpatialSelection();
  renderAll();
}

function removeSpatialObject(id) {
  const objects = spatialObjects();
  const index = objects.findIndex(item=>item.id===id);
  if (index < 0) return;
  if (typeof notebookPushUndoCheckpoint === 'function') notebookPushUndoCheckpoint();
  objects.splice(index,1);
  selectedSpatialObjectId = null;
  save();
  renderAll();
}

function spatialObjectDeleteButton(object) {
  const button = document.createElement('button');
  button.type='button';
  button.className='spatial-object-delete';
  button.title='Delete';
  button.setAttribute('aria-label','Delete spatial object');
  button.textContent='×';
  button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    removeSpatialObject(object.id);
  };
  return button;
}

function renderSpatialTable(object,wrap) {
  const table = document.createElement('table');
  table.className='spatial-table';
  const editable = typeof isCurrentNotebookPageEditable !== 'function' || isCurrentNotebookPageEditable();
  for (let r=0;r<object.rows;r++) {
    const tr=document.createElement('tr');
    for (let c=0;c<object.cols;c++) {
      const td=document.createElement('td');
      td.dataset.spatialRow=String(r);
      td.dataset.spatialCol=String(c);
      td.contentEditable=editable ? 'true' : 'false';
      td.spellcheck=true;
      td.textContent=object.cells?.[r]?.[c] || '';
      if (editable) td.addEventListener('input',()=>{
        object.cells ||= Array.from({length:object.rows},()=>Array.from({length:object.cols},()=>''));
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
}

function renderSpatialObject(object,canvas) {
  const wrap=document.createElement('div');
  wrap.className=`notebook-spatial-object spatial-object-${object.type}`;
  wrap.dataset.spatialObjectId=object.id;
  wrap.style.setProperty('--object-col',Math.max(0,Number(object.col)||0));
  wrap.style.setProperty('--object-row',Math.max(0,Number(object.row)||0));
  wrap.style.setProperty('--object-cols',Math.max(1,Number(object.cols)||1));
  wrap.style.setProperty('--object-rows',Math.max(1,Number(object.rows)||1));

  if (object.type==='table') renderSpatialTable(object,wrap);
  else if (object.type==='cloud') {
    wrap.innerHTML='<svg class="spatial-cloud-svg" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M18 50 C7 50 3 43 7 35 C1 27 9 17 19 19 C22 8 36 5 44 13 C53 4 69 8 72 18 C84 14 94 22 90 32 C99 39 92 50 82 49 C75 57 61 57 54 51 C45 58 29 57 24 50 Z"/></svg>';
  }
  if (typeof isCurrentNotebookPageEditable !== 'function' || isCurrentNotebookPageEditable()) {
    wrap.appendChild(spatialObjectDeleteButton(object));
  }

  wrap.addEventListener('click',event=>{
    if (event.target.closest('td,button')) return;
    selectedSpatialObjectId=object.id;
    $$('.notebook-spatial-object.is-selected',canvas).forEach(el=>el.classList.remove('is-selected'));
    wrap.classList.add('is-selected');
  });
  canvas.appendChild(wrap);
}

function renderSpatialObjects(root) {
  if (notebookPaperView() !== 'grid') return;
  const canvas=$('.grid-notebook-canvas',root);
  if (!canvas) return;
  spatialObjects().forEach(object=>renderSpatialObject(object,canvas));
}

function bindSpatialCellSelection(root) {
  if (notebookPaperView() !== 'grid') return;
  const canvas=$('.grid-notebook-canvas',root);
  if (!canvas || canvas.dataset.spatialSelectionBound) return;
  canvas.dataset.spatialSelectionBound='1';
  let start=null;
  let dragging=false;
  let suppressClickUntil=0;

  canvas.addEventListener('pointerdown',event=>{
    if (event.button!==0) return;
    if (typeof isCurrentNotebookPageEditable === 'function' && !isCurrentNotebookPageEditable()) return;
    if (event.target.closest('.grid-note,.grid-editor-wrap,.notebook-spatial-object,.grid-cell-selection-toolbar,.grid-grab-handle')) return;
    start={cell:spatialPointerCell(canvas,event),x:event.clientX,y:event.clientY,pointerId:event.pointerId};
    dragging=false;
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener('pointermove',event=>{
    if (!start || event.pointerId!==start.pointerId) return;
    if (!dragging && Math.hypot(event.clientX-start.x,event.clientY-start.y)<5) return;
    dragging=true;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    const bounds=spatialSelectionBounds(start.cell,spatialPointerCell(canvas,event));
    activeSpatialSelection=bounds;
    drawSpatialSelection(canvas,bounds);
  },{passive:false});

  const finish=event=>{
    if (!start || event.pointerId!==start.pointerId) return;
    if (dragging) {
      event.preventDefault();
      const bounds=spatialSelectionBounds(start.cell,spatialPointerCell(canvas,event));
      activeSpatialSelection=bounds;
      drawSpatialSelection(canvas,bounds,{toolbar:true});
      suppressClickUntil=Date.now()+240;
    }
    start=null;
    dragging=false;
  };
  canvas.addEventListener('pointerup',finish);
  canvas.addEventListener('pointercancel',()=>{start=null;dragging=false;});

  canvas.addEventListener('click',event=>{
    if (Date.now()<suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.target.closest('.grid-cell-selection-toolbar,.notebook-spatial-object')) return;
    clearSpatialSelection(canvas);
  },true);
}

if (!window.__salesShopSpatialKeys) {
  window.__salesShopSpatialKeys=true;
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape' && activeSpatialSelection) {
      clearSpatialSelection();
      return;
    }
    if (!selectedSpatialObjectId || !['Delete','Backspace'].includes(event.key)) return;
    const active=document.activeElement;
    if (active?.matches?.('input,textarea,[contenteditable="true"]')) return;
    event.preventDefault();
    removeSpatialObject(selectedSpatialObjectId);
  });
}

const _salesShopSpatialRenderNotebook = renderNotebookSurface;
renderNotebookSurface = function(root) {
  migrateBlankToSpatialOnce();
  _salesShopSpatialRenderNotebook(root);
  if (!root) return;
  installSpatialStyleMenu(root);
  applyGridPaper?.(root);
  renderSpatialObjects(root);
  bindSpatialCellSelection(root);
};
