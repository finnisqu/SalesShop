/* Final object-toolbar layout: compact table sizing, edge-aware floating strips, and stable chrome. */

let openTableSizeObjectId = null;
let notebookToolbarClampFrame = 0;

function notebookTableSizeControl(controls,object) {
  if (!controls || controls.querySelector('.spatial-table-size-control')) return;
  const steppers = $$('.spatial-table-dimension-stepper',controls);
  if (steppers.length < 2) return;

  const anchor = steppers[0];
  const parent = anchor.parentNode;
  if (!parent) return;

  const control = document.createElement('span');
  control.className = 'spatial-table-size-control';
  control.dataset.tableSizeControl = object.id;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'spatial-table-size-trigger';
  trigger.title = 'Table structure';
  trigger.setAttribute('aria-label','Table structure');
  trigger.innerHTML = '<span class="spatial-table-size-grid" aria-hidden="true"></span>';

  const panel = document.createElement('span');
  panel.className = 'spatial-table-size-panel';

  /* Insert the replacement slot before moving source controls into it. */
  parent.insertBefore(control,anchor);
  panel.append(...steppers);

  /* Title/Header are table-structure choices too. Keep them out of the main strip and with the
     row/column controls inside this one compact 2x2-grid menu. */
  const rowRoles = $('.spatial-table-row-role-controls',controls);
  const rowRoleDivider = rowRoles?.nextElementSibling?.classList?.contains('spatial-table-control-separator')
    ? rowRoles.nextElementSibling
    : null;
  if (rowRoles) {
    const roleDivider = document.createElement('span');
    roleDivider.className = 'spatial-table-size-panel-divider';
    panel.append(roleDivider,rowRoles);
    rowRoleDivider?.remove();
  }

  control.append(trigger,panel);

  if (openTableSizeObjectId === object.id) control.classList.add('size-open');

  trigger.onclick = event=>{
    event.preventDefault();
    event.stopPropagation();
    const opening = !control.classList.contains('size-open');
    $$('.spatial-table-size-control.size-open').forEach(el=>el.classList.remove('size-open'));
    control.classList.toggle('size-open',opening);
    openTableSizeObjectId = opening ? object.id : null;
    scheduleNotebookToolbarClamp();
  };

  panel.addEventListener('pointerdown',event=>{
    event.stopPropagation();
    openTableSizeObjectId = object.id;
  });
}

function notebookMoveTableDeleteToEnd(controls) {
  if (!controls) return;
  const del = $('[data-table-delete]',controls);
  if (!del) return;
  const separator = del.previousElementSibling?.classList?.contains('spatial-table-control-separator')
    ? del.previousElementSibling
    : null;
  if (separator) controls.appendChild(separator);
  controls.appendChild(del);
  del.classList.add('spatial-table-delete-at-end');
}

function notebookCompactMergeButton(controls) {
  if (!controls) return;
  const button = $('.spatial-table-merge-button',controls);
  if (!button) return;
  const label = String(button.textContent || '').trim();
  if (label === 'Merge') {
    button.classList.add('spatial-table-merge-icon-button');
    button.title = 'Merge selected cells';
    button.setAttribute('aria-label','Merge selected cells');
    button.innerHTML = '<span class="spatial-table-merge-glyph" aria-hidden="true"><i></i><i></i><b></b></span>';
  } else {
    button.classList.remove('spatial-table-merge-icon-button');
  }
}

function markCompactNotebookObjectChrome(root=$('#notebookDock')) {
  if (!root) return;
  $$('.notebook-spatial-object,.grid-note',root).forEach(object=>{
    const width = object.getBoundingClientRect().width || object.offsetWidth || 0;
    object.classList.toggle('compact-object-chrome',width > 0 && width < 82);
    object.classList.toggle('ultra-compact-object-chrome',width > 0 && width < 44);
  });
}

function clampNotebookFloatingToolbar(toolbar) {
  if (!toolbar?.isConnected) return;
  const page = toolbar.closest('.notebook-page');
  const body = page?.querySelector('.notebook-page-body') || page;
  if (!body) return;

  toolbar.style.setProperty('--toolbar-edge-shift','0px');
  const boundary = body.getBoundingClientRect();
  const rect = toolbar.getBoundingClientRect();
  if (!rect.width || !boundary.width) return;

  const inset = 6;
  let shift = 0;
  if (rect.left < boundary.left + inset) shift += (boundary.left + inset) - rect.left;
  if (rect.right + shift > boundary.right - inset) shift -= (rect.right + shift) - (boundary.right - inset);
  toolbar.style.setProperty('--toolbar-edge-shift',`${Math.round(shift)}px`);
}

function clampNotebookFloatingToolbars(root=$('#notebookDock')) {
  if (!root) return;
  markCompactNotebookObjectChrome(root);
  $$('.spatial-table-controls,.spatial-shape-toolbar,.grid-text-object-toolbar',root)
    .forEach(clampNotebookFloatingToolbar);
}

function scheduleNotebookToolbarClamp(root=$('#notebookDock')) {
  cancelAnimationFrame(notebookToolbarClampFrame);
  notebookToolbarClampFrame = requestAnimationFrame(()=>{
    notebookToolbarClampFrame = requestAnimationFrame(()=>clampNotebookFloatingToolbars(root));
  });
}

const _salesShopToolbarLayoutAdvancedControls = advancedSpatialTableControls;
advancedSpatialTableControls = function(object) {
  const controls = _salesShopToolbarLayoutAdvancedControls(object);
  notebookTableSizeControl(controls,object);
  notebookCompactMergeButton(controls);
  notebookMoveTableDeleteToEnd(controls);
  requestAnimationFrame(()=>clampNotebookFloatingToolbar(controls));
  return controls;
};

function installNotebookToolbarLayout(root) {
  if (!root) return;
  $$('.spatial-object-table',root).forEach(wrap=>{
    const object = spatialObjectById?.(wrap.dataset.spatialObjectId);
    const controls = $('.spatial-table-controls',wrap);
    if (!object || !controls) return;
    notebookTableSizeControl(controls,object);
    notebookCompactMergeButton(controls);
    notebookMoveTableDeleteToEnd(controls);
  });
  markCompactNotebookObjectChrome(root);
  scheduleNotebookToolbarClamp(root);

  const page = $('.notebook-page',root);
  if (page && !page.__salesShopToolbarResizeObserver && typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(()=>scheduleNotebookToolbarClamp(root));
    observer.observe(page);
    page.__salesShopToolbarResizeObserver = observer;
  }
}

if (!window.__salesShopToolbarLayoutEvents) {
  window.__salesShopToolbarLayoutEvents = true;

  document.addEventListener('click',event=>{
    if (event.target?.closest?.('.spatial-object-format-toggle,.grid-text-format-toggle,.spatial-table-size-trigger')) {
      scheduleNotebookToolbarClamp();
    }
  });

  document.addEventListener('pointerdown',event=>{
    if (event.target?.closest?.('.spatial-table-size-control')) return;
    openTableSizeObjectId = null;
    $$('.spatial-table-size-control.size-open').forEach(el=>el.classList.remove('size-open'));
  },true);

  window.addEventListener('resize',()=>scheduleNotebookToolbarClamp());
}

const _salesShopToolbarLayoutRender = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopToolbarLayoutRender(root);
  if (!root) return;
  installNotebookToolbarLayout(root);
};
