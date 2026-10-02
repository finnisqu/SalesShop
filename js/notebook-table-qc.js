/* Final table interaction QC: preserve range selection through toolbar clicks, auto-open tools for
   highlighted ranges, keep flyouts inside the visible notebook, and anchor notices to the notebook. */

let notebookPreserveTableSelectionPointer = false;

/* The earlier exclusive-mode listener clears table selection on every pointerdown inside a spatial
   object. Mark table editing/toolbar interactions one event earlier (window capture) so the current
   cell range survives long enough for formatting / merge / split to use it. */
window.addEventListener('pointerdown',event=>{
  notebookPreserveTableSelectionPointer = !!event.target?.closest?.(
    '.spatial-object-table td,.spatial-object-table .spatial-table-controls,.spatial-object-table .spatial-table-size-control'
  );
  queueMicrotask(()=>{ notebookPreserveTableSelectionPointer = false; });
},true);

if (typeof clearNotebookCellSelectionMode === 'function' && !window.__salesShopPreserveTableRange) {
  window.__salesShopPreserveTableRange = true;
  const _tableQcClearNotebookCellSelectionMode = clearNotebookCellSelectionMode;
  clearNotebookCellSelectionMode = function(root) {
    if (notebookPreserveTableSelectionPointer) return;
    return _tableQcClearNotebookCellSelectionMode(root);
  };
}

function notebookTableRangeIsMulti(object) {
  const selection = (typeof activeSpatialTableSelection !== 'undefined') ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId !== object?.id) return false;
  const bounds = spatialSelectionBoundsForTable?.(selection);
  return !!bounds && (bounds.rows > 1 || bounds.cols > 1);
}

function openTableToolsForSelection(object,wrap) {
  if (!object || !wrap || !notebookTableRangeIsMulti(object)) return;
  selectedSpatialObjectId = object.id;
  if (typeof openSpatialFormatObjectId !== 'undefined') openSpatialFormatObjectId = object.id;
  wrap.classList.add('is-selected','format-open');
  requestAnimationFrame(()=>{
    installNotebookTableQc?.($('#notebookDock'));
    scheduleNotebookToolbarClamp?.();
  });
}

/* Add behavior after the existing renderer/bindings, so this pointerup runs after the table's own
   range-selection handler has finalized the selection and rebuilt its controls. */
if (typeof renderSpatialTable === 'function' && !window.__salesShopTableRangeToolbarOpen) {
  window.__salesShopTableRangeToolbarOpen = true;
  const _tableQcRenderSpatialTable = renderSpatialTable;
  renderSpatialTable = function(object,wrap) {
    _tableQcRenderSpatialTable(object,wrap);
    const table = $('.spatial-table',wrap);
    if (!table || table.dataset.rangeToolbarQcBound) return;
    table.dataset.rangeToolbarQcBound = '1';
    table.addEventListener('pointerup',()=>{
      setTimeout(()=>openTableToolsForSelection(object,wrap),0);
    });
  };
}

function reorderTableStructureFlyout(controls) {
  const panel = $('.spatial-table-size-panel',controls);
  if (!panel) return;
  const roles = $('.spatial-table-row-role-controls',panel);
  const steppers = $$('.spatial-table-dimension-stepper',panel);
  if (roles) panel.prepend(roles);
  let divider = $('.spatial-table-size-panel-divider',panel);
  if (roles && steppers.length) {
    if (!divider) {
      divider = document.createElement('span');
      divider.className = 'spatial-table-size-panel-divider';
    }
    roles.after(divider);
  }
  steppers.forEach(stepper=>panel.appendChild(stepper));
}

function compactFinalMergeGlyph(controls) {
  const button = $('.spatial-table-merge-button.spatial-table-merge-icon-button',controls);
  if (!button || String(button.textContent || '').trim() === 'Split') return;
  button.innerHTML = `
    <span class="spatial-table-merge-glyph inward compact" aria-hidden="true">
      <svg viewBox="0 0 18 18" focusable="false">
        <path d="M2 6V2h4M2 2l4.4 4.4" />
        <path d="M16 6V2h-4M16 2l-4.4 4.4" />
        <path d="M2 12v4h4M2 16l4.4-4.4" />
        <path d="M16 12v4h-4M16 16l-4.4-4.4" />
      </svg>
    </span>`;
}

function flyoutNeededHeight(control) {
  if (control.classList.contains('spatial-align-control')) return 62;
  if (control.classList.contains('spatial-number-format-control')) return 80;
  if (control.classList.contains('spatial-fill-control')) return 98;
  if (control.classList.contains('spatial-table-size-control')) return 86;
  return 0;
}

function orientNotebookFlyout(control) {
  if (!control?.isConnected) return;
  const page = control.closest('.notebook-page');
  const boundary = page?.getBoundingClientRect();
  const rect = control.getBoundingClientRect();
  const needed = flyoutNeededHeight(control);
  if (!boundary || !needed) return;
  const roomAbove = rect.top - boundary.top;
  control.classList.toggle('flyout-down',roomAbove < needed + 8);
}

function bindFlyoutOrientation(control) {
  if (!control || control.dataset.flyoutOrientationBound) return;
  control.dataset.flyoutOrientationBound = '1';
  ['pointerenter','focusin','click'].forEach(type=>control.addEventListener(type,()=>{
    orientNotebookFlyout(control);
    requestAnimationFrame(()=>orientNotebookFlyout(control));
  }));
}

function positionToastAtNotebook() {
  const toastNode = $('#toast');
  const dock = $('#notebookDock');
  if (!toastNode || !dock) return;
  const rect = dock.getBoundingClientRect();
  const x = Math.max(16,Math.min(window.innerWidth-16,rect.left + rect.width/2));
  const y = Math.max(8,Math.min(window.innerHeight-40,rect.top + 8));
  toastNode.style.setProperty('--notebook-toast-left',`${Math.round(x)}px`);
  toastNode.style.setProperty('--notebook-toast-top',`${Math.round(y)}px`);
}

if (typeof toast === 'function' && !window.__salesShopNotebookAnchoredToast) {
  window.__salesShopNotebookAnchoredToast = true;
  const _tableQcToast = toast;
  toast = function(...args) {
    const result = _tableQcToast(...args);
    positionToastAtNotebook();
    requestAnimationFrame(positionToastAtNotebook);
    return result;
  };
}

function installNotebookTableQc(root=$('#notebookDock')) {
  if (!root) return;
  $$('.spatial-table-controls',root).forEach(controls=>{
    reorderTableStructureFlyout(controls);
    compactFinalMergeGlyph(controls);
  });
  $$('.spatial-align-control,.spatial-number-format-control,.spatial-fill-control,.spatial-table-size-control',root).forEach(control=>{
    bindFlyoutOrientation(control);
    orientNotebookFlyout(control);
  });
  positionToastAtNotebook();
}

/* Controls are rebuilt often as ranges/styles change. Keep the final structure polish on every
   rebuild rather than relying only on a whole-page render. */
if (typeof advancedSpatialTableControls === 'function' && !window.__salesShopTableQcControls) {
  window.__salesShopTableQcControls = true;
  const _tableQcAdvancedControls = advancedSpatialTableControls;
  advancedSpatialTableControls = function(object) {
    const controls = _tableQcAdvancedControls(object);
    reorderTableStructureFlyout(controls);
    compactFinalMergeGlyph(controls);
    $$('.spatial-align-control,.spatial-number-format-control,.spatial-fill-control,.spatial-table-size-control',controls)
      .forEach(bindFlyoutOrientation);
    return controls;
  };
}

window.addEventListener('resize',()=>installNotebookTableQc());

const _salesShopTableQcRender = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopTableQcRender(root);
  if (!root) return;
  installNotebookTableQc(root);
};
