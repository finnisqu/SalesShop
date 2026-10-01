/* Unified notebook page-object layer.
   Tables / callouts belong to the page, not to the visible paper background. Lined and Cornell
   therefore keep the same invisible notebook coordinate system used by Blank / Grid / Dots. */

function notebookObjectLayerEligible() {
  const view = notebookPaperView?.();
  return view === 'lines' || view === 'cornell';
}

function ensureSemanticTableRows(object,{persist=false}={}) {
  if (!object || object.type !== 'table') return false;
  normalizeAdvancedSpatialTable?.(object);
  let changed = false;

  if (object.tableTitleRow) {
    /* A title row owns the entire first logical row. Preserve anything already typed there. */
    const rowValues = (object.cells?.[0] || []).map(value=>String(value || '').trim()).filter(Boolean);
    const existingTitle = object.merges?.find(merge=>merge.role === 'title');
    const conflicting = (object.merges || []).filter(merge=>{
      const intersectsFirstRow = merge.r <= 0 && (merge.r + merge.rows - 1) >= 0;
      return intersectsFirstRow && merge !== existingTitle;
    });
    if (conflicting.length) {
      object.merges = object.merges.filter(merge=>!conflicting.includes(merge));
      changed = true;
    }

    if (!existingTitle || existingTitle.r !== 0 || existingTitle.c !== 0 || existingTitle.rows !== 1 || existingTitle.cols !== object.cols) {
      object.merges = (object.merges || []).filter(merge=>merge.role !== 'title');
      object.merges.push({r:0,c:0,rows:1,cols:object.cols,role:'title'});
      changed = true;
    }

    if (rowValues.length) {
      const combined = rowValues.join(' · ');
      if (object.cells[0][0] !== combined) {
        object.cells[0][0] = combined;
        changed = true;
      }
      for (let c=1;c<object.cols;c++) {
        if (object.cells[0][c]) {
          object.cells[0][c] = '';
          changed = true;
        }
      }
    }
  } else if ((object.merges || []).some(merge=>merge.role === 'title')) {
    object.merges = object.merges.filter(merge=>merge.role !== 'title');
    changed = true;
  }

  /* A header beneath a title needs a second row to exist. */
  if (object.tableHeaderRow && object.tableTitleRow && object.rows < 2) {
    object.rows = 2;
    normalizeSpatialTable?.(object);
    changed = true;
  }

  if (changed) {
    object.updatedAt = new Date().toISOString();
    if (persist) save();
  }
  return changed;
}

function toggleSemanticTableRow(object,type) {
  if (!object || object.type !== 'table') return;
  notebookPushUndoCheckpoint?.();
  if (type === 'title') object.tableTitleRow = !object.tableTitleRow;
  if (type === 'header') object.tableHeaderRow = !object.tableHeaderRow;
  ensureSemanticTableRows(object,{persist:false});
  object.updatedAt = new Date().toISOString();
  selectedSpatialObjectId = object.id;
  openSpatialFormatObjectId = object.id;
  save();
  renderAll();
}

function semanticTableRowControls(object) {
  const wrap = document.createElement('span');
  wrap.className = 'spatial-table-row-role-controls';
  [['title','Title'],['header','Header']].forEach(([type,label])=>{
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `spatial-table-row-role${(type==='title' ? object.tableTitleRow : object.tableHeaderRow) ? ' active' : ''}`;
    button.dataset.tableRowRole = type;
    button.textContent = label;
    button.title = type === 'title' ? 'Toggle full-width title row' : 'Toggle styled header row';
    button.onclick = event=>{
      event.preventDefault();
      event.stopPropagation();
      toggleSemanticTableRow(object,type);
    };
    wrap.appendChild(button);
  });
  return wrap;
}

const _salesShopUnifiedAdvancedControls = advancedSpatialTableControls;
advancedSpatialTableControls = function(object) {
  const controls = _salesShopUnifiedAdvancedControls(object);
  if (!$('[data-table-row-role]',controls)) {
    const separator = document.createElement('span');
    separator.className = 'spatial-table-control-separator';
    controls.insertBefore(separator,controls.firstChild);
    controls.insertBefore(semanticTableRowControls(object),separator);
  }
  return controls;
};

function applySemanticTableRowClasses(object,wrap) {
  const table = $('.spatial-table',wrap);
  if (!table) return;
  const headerRow = object.tableHeaderRow ? (object.tableTitleRow ? 1 : 0) : -1;
  $$('td',table).forEach(td=>{
    const row = Number(td.dataset.spatialRow) || 0;
    td.classList.toggle('spatial-table-title-cell',!!object.tableTitleRow && row === 0);
    td.classList.toggle('spatial-table-header-cell',headerRow >= 0 && row === headerRow);
  });
}

const _salesShopUnifiedRenderTable = renderSpatialTable;
renderSpatialTable = function(object,wrap) {
  const changed = ensureSemanticTableRows(object,{persist:false});
  if (changed) save();
  _salesShopUnifiedRenderTable(object,wrap);
  applySemanticTableRowClasses(object,wrap);
};

function sizeLinedPageToObjects(root,layer) {
  const body = $('.notebook-page-body',root);
  if (!body || !layer) return;
  requestAnimationFrame(()=>{
    const step = spatialStep?.() || notebookPaperRhythm?.() || 28;
    let bottom = 0;
    $$('.notebook-spatial-object',layer).forEach(object=>{
      bottom = Math.max(bottom,object.offsetTop + Math.max(object.offsetHeight,object.scrollHeight || 0));
    });
    if (!bottom) return;
    const needed = Math.ceil((bottom + step * 3) / step) * step;
    body.style.minHeight = `${Math.max(body.scrollHeight,needed)}px`;
    layer.style.minHeight = `${needed}px`;
  });
}

function renderNotebookPageObjectLayer(root) {
  if (!notebookObjectLayerEligible()) return;
  const body = $('.notebook-page-body',root);
  if (!body) return;
  let layer = $('[data-notebook-object-layer]',body);
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'notebook-page-object-layer';
    layer.dataset.notebookObjectLayer = '';
    body.appendChild(layer);
  }
  spatialObjects().forEach(object=>renderSpatialObject(object,layer));
  sizeLinedPageToObjects(root,layer);
}

/* Restore the direct X affordance as a quiet hover action. The richer Format toolbar still owns
   the rest of the object's editing controls. */
function reinforceSpatialDeleteHover(root) {
  $$('.notebook-spatial-object',root).forEach(wrap=>{
    const del = $('.spatial-object-delete',wrap);
    if (!del) return;
    del.title = 'Delete';
    del.setAttribute('aria-label','Delete object');
  });
}

const _salesShopUnifiedPageRender = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopUnifiedPageRender(root);
  if (!root) return;
  renderNotebookPageObjectLayer(root);
  reinforceSpatialDeleteHover(root);
};
