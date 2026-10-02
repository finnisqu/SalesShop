/* Unified notebook interaction layer: reliable table-range actions, direct table editing from Grid
   writing mode, grouped flyout direction, quick table functions, compact CRM actions, and a
   simplified Grid-selection creation menu. Loaded after notebook-table-qc.js. */

let notebookToolbarRangeSnapshot = null;
const NOTEBOOK_COMPACT_FLYOUT_DELAY = 950;

function cloneNotebookTableSelection(selection) {
  if (!selection?.start || !selection?.end) return null;
  return {
    objectId:selection.objectId,
    start:{r:Number(selection.start.r)||0,c:Number(selection.start.c)||0},
    end:{r:Number(selection.end.r)||0,c:Number(selection.end.c)||0}
  };
}

function tableObjectIdForControls(controls) {
  return controls?.closest?.('.spatial-object-table')?.dataset?.spatialObjectId || null;
}

function selectionForTableControls(controls) {
  const objectId = tableObjectIdForControls(controls);
  const live = (typeof activeSpatialTableSelection !== 'undefined') ? activeSpatialTableSelection : null;
  if (live?.objectId === objectId) return cloneNotebookTableSelection(live);
  const saved = controls?.__salesShopTableSelection;
  return saved?.objectId === objectId ? cloneNotebookTableSelection(saved) : null;
}

/* A toolbar remembers the table selection it was built for. This avoids the fragile behavior where
   some pointer/focus path collapses the global selection to one cell before the button click runs. */
function rememberTableToolbarSelection(controls,object) {
  if (!controls || !object) return;
  const live = (typeof activeSpatialTableSelection !== 'undefined') ? activeSpatialTableSelection : null;
  if (live?.objectId === object.id) controls.__salesShopTableSelection = cloneNotebookTableSelection(live);
}

window.addEventListener('pointerdown',event=>{
  const controls = event.target?.closest?.('.spatial-table-controls');
  if (!controls) return;
  notebookToolbarRangeSnapshot = selectionForTableControls(controls);
},true);

/* Restore the remembered range at click-capture time, immediately before the target button's own
   click handler. This protects Fill / Number / Alignment / Merge / Split / functions uniformly. */
window.addEventListener('click',event=>{
  const controls = event.target?.closest?.('.spatial-table-controls');
  if (!controls) return;
  const selection = notebookToolbarRangeSnapshot || selectionForTableControls(controls);
  if (selection && typeof activeSpatialTableSelection !== 'undefined') {
    activeSpatialTableSelection = cloneNotebookTableSelection(selection);
  }
  queueMicrotask(()=>{ notebookToolbarRangeSnapshot = null; });
},true);

function notebookPlaceCaretAtPoint(root,x,y) {
  if (!root) return;
  try {
    let range = null;
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x,y);
      if (pos?.offsetNode && root.contains(pos.offsetNode)) {
        range = document.createRange();
        range.setStart(pos.offsetNode,pos.offset);
      }
    } else if (document.caretRangeFromPoint) {
      const candidate = document.caretRangeFromPoint(x,y);
      if (candidate && root.contains(candidate.startContainer)) range = candidate;
    }
    if (!range) return;
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  } catch {}
}

/* Switching from an empty/new Grid writing caret into a table/shape should be one click. Close the
   Grid editor before the browser performs the table-cell focus/caret default action. */
window.addEventListener('pointerdown',event=>{
  const editable = event.target?.closest?.('.spatial-table td,.spatial-shape-text');
  if (!editable) return;
  if (typeof activeGridEditor !== 'undefined' && activeGridEditor) {
    if (typeof closeGridEditor === 'function') closeGridEditor({rerender:false});
    else if (typeof closeActiveGridWritingMode === 'function') closeActiveGridWritingMode();
  }
  const x=event.clientX, y=event.clientY;
  setTimeout(()=>{
    if (!editable.isConnected || editable.getAttribute('contenteditable') === 'false') return;
    if (document.activeElement !== editable) editable.focus({preventScroll:true});
    notebookPlaceCaretAtPoint(editable,x,y);
  },0);
},true);

function installSpatialObjectEventShield(root=$('#notebookDock')) {
  if (!root) return;
  $$('.notebook-spatial-object',root).forEach(wrap=>{
    if (wrap.dataset.gridEventShieldBound) return;
    wrap.dataset.gridEventShieldBound='1';
    /* Let the target itself receive the double-click (including native word selection in a cell),
       but never let it bubble into the Grid canvas and create/edit a note behind the object. */
    wrap.addEventListener('dblclick',event=>event.stopPropagation());
  });
}

function selectedQuickFunctionValues(object) {
  const selection = (typeof activeSpatialTableSelection !== 'undefined') ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId !== object?.id) return [];
  normalizeAdvancedSpatialTable?.(object);
  const cells = selectedSpatialTableCells?.(object) || [];
  const anchors = new Set();
  const values = [];
  cells.forEach(({r,c})=>{
    const merge = spatialMergeCovering?.(object,r,c);
    const ar=merge?.r ?? r, ac=merge?.c ?? c;
    const key=spatialCellKey(ar,ac);
    if (anchors.has(key)) return;
    anchors.add(key);
    const parsed = parseSpatialNumericValue?.(object.cells?.[ar]?.[ac]);
    if (parsed != null && Number.isFinite(parsed)) values.push(parsed);
  });
  return values;
}

function quickFunctionResultCell(object,bounds) {
  normalizeAdvancedSpatialTable?.(object);
  const horizontal = bounds.rows === 1 && bounds.cols > 1;
  if (horizontal) {
    let r=bounds.r1, c=bounds.c2+1;
    while (true) {
      if (c >= object.cols) {
        object.cols=c+1;
        normalizeAdvancedSpatialTable?.(object);
        ensureSemanticTableRows?.(object,{persist:false});
      }
      const merge=spatialMergeCovering?.(object,r,c);
      const occupied = !!String(object.cells?.[r]?.[c] || '').trim() || !!(merge && (merge.r!==r || merge.c!==c));
      if (!occupied) return {r,c};
      c = merge ? Math.max(c+1,merge.c+merge.cols) : c+1;
    }
  }

  let r=bounds.r2+1, c=bounds.c1;
  while (true) {
    if (r >= object.rows) {
      object.rows=r+1;
      normalizeAdvancedSpatialTable?.(object);
      ensureSemanticTableRows?.(object,{persist:false});
    }
    const merge=spatialMergeCovering?.(object,r,c);
    const occupied = !!String(object.cells?.[r]?.[c] || '').trim() || !!(merge && (merge.r!==r || merge.c!==c));
    if (!occupied) return {r,c};
    r = merge ? Math.max(r+1,merge.r+merge.rows) : r+1;
  }
}

function runNotebookQuickFunction(object,type) {
  const selection = (typeof activeSpatialTableSelection !== 'undefined') ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId !== object?.id) return toast('Select table cells first.');
  const bounds=spatialSelectionBoundsForTable?.(selection);
  if (!bounds) return;
  const values=selectedQuickFunctionValues(object);
  if (!values.length) return toast('The selected cells do not contain numbers.');

  let result=0;
  if (type==='sum') result=values.reduce((a,b)=>a+b,0);
  else if (type==='average') result=values.reduce((a,b)=>a+b,0)/values.length;
  else if (type==='product') result=values.reduce((a,b)=>a*b,1);
  else return;

  notebookPushUndoCheckpoint?.();
  const target=quickFunctionResultCell(object,bounds);
  normalizeAdvancedSpatialTable?.(object);
  const clean = Number.isInteger(result) ? String(result) : String(Number(result.toFixed(8)));
  object.cells[target.r][target.c]=clean;
  object.cellStyles ||= {};
  const key=spatialCellKey(target.r,target.c);
  object.cellStyles[key] ||= {};
  object.cellStyles[key].align='right';
  const numberFormat=spatialSelectionUniformStyle?.(object,'numberFormat','none') || 'none';
  if (numberFormat !== 'none') object.cellStyles[key].numberFormat=numberFormat;
  object.updatedAt=new Date().toISOString();
  activeSpatialTableSelection={objectId:object.id,start:{...target},end:{...target}};
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId !== 'undefined') openSpatialFormatObjectId=object.id;
  save();
  renderAll();
}

function bindCompactFlyout(control,{delay=NOTEBOOK_COMPACT_FLYOUT_DELAY}={}) {
  if (!control || control.dataset.compactFlyoutBound) return;
  control.dataset.compactFlyoutBound='1';
  let timer=0;
  const open=()=>{ clearTimeout(timer); control.classList.add('flyout-open'); orientUnifiedFlyout(control); };
  const close=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if (control.matches(':hover') || control.matches(':focus-within')) return;
      control.classList.remove('flyout-open');
    },delay);
  };
  control.addEventListener('pointerenter',open);
  control.addEventListener('pointerleave',close);
  control.addEventListener('focusin',open);
  control.addEventListener('focusout',close);
  const trigger=$('[data-compact-flyout-trigger]',control);
  if (trigger) trigger.onclick=event=>{
    event.preventDefault(); event.stopPropagation();
    const opening=!control.classList.contains('flyout-open');
    clearTimeout(timer);
    control.classList.toggle('flyout-open',opening);
    if (opening) orientUnifiedFlyout(control);
  };
}

function notebookFunctionControl(object) {
  const control=document.createElement('span');
  control.className='spatial-function-control';
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='spatial-function-trigger';
  trigger.dataset.compactFlyoutTrigger='';
  trigger.title='Quick functions';
  trigger.setAttribute('aria-label','Quick functions');
  trigger.textContent='ƒx';
  const panel=document.createElement('span');
  panel.className='spatial-function-panel';
  [['sum','Σ','Sum'],['average','x̄','Average'],['product','×','Product']].forEach(([type,glyph,label])=>{
    const button=document.createElement('button');
    button.type='button';
    button.dataset.quickFunction=type;
    button.title=label;
    button.setAttribute('aria-label',label);
    button.innerHTML=`<span aria-hidden="true">${glyph}</span>`;
    button.onclick=event=>{
      event.preventDefault(); event.stopPropagation();
      runNotebookQuickFunction(object,type);
    };
    panel.appendChild(button);
  });
  control.append(trigger,panel);
  bindCompactFlyout(control);
  return control;
}

function installTableFunctionControl(controls,object) {
  if (!controls || $('.spatial-function-control',controls)) return;
  const control=notebookFunctionControl(object);
  const crm=$('.spatial-table-crm-action',controls);
  const separator=crm?.previousElementSibling?.classList?.contains('spatial-table-control-separator') ? crm.previousElementSibling : null;
  if (separator) controls.insertBefore(control,separator);
  else if (crm) controls.insertBefore(control,crm);
  else {
    const divider=document.createElement('span');
    divider.className='spatial-table-control-separator';
    controls.append(divider,control);
  }
}

function notebookActionGlyph() {
  return `<span class="notebook-action-glyph" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 12.5h4.5M6.5 3.5h6v6M12.5 3.5l-7 7"/></svg></span>`;
}

function compactPromoteLinkActions(container) {
  if (!container || container.querySelector('.notebook-action-flyout')) return;
  let promote = container.querySelector('[data-rich-promote],[data-spatial-text-promote],[data-grid-promote],[data-grid-text-promote]');
  let link = container.querySelector('[data-rich-link],[data-spatial-text-link],[data-grid-link],[data-grid-text-link]');
  if (!promote || !link) {
    const crm=$$('.spatial-table-crm-action',container);
    promote=crm.find(button=>String(button.textContent||'').trim().toLowerCase()==='promote') || null;
    link=crm.find(button=>String(button.textContent||'').trim().toLowerCase()==='link') || null;
  }
  if (!promote || !link || promote.closest('.notebook-action-flyout')) return;

  const control=document.createElement('span');
  control.className='notebook-action-flyout';
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='notebook-action-trigger';
  trigger.dataset.compactFlyoutTrigger='';
  trigger.title='Promote or link';
  trigger.setAttribute('aria-label','Promote or link');
  trigger.innerHTML=notebookActionGlyph();
  const panel=document.createElement('span');
  panel.className='notebook-action-panel';
  promote.classList.add('notebook-action-option');
  link.classList.add('notebook-action-option');
  promote.title=promote.title || 'Promote';
  link.title=link.title || 'Link';
  promote.textContent='Promote';
  link.textContent='Link';

  container.insertBefore(control,promote);
  panel.append(promote,link);
  control.append(trigger,panel);
  container.classList.add('compact-action-toolbar');
  bindCompactFlyout(control);
}

function installCompactNotebookActions(root=document) {
  $$('.spatial-table-controls,.grid-text-object-toolbar,.grid-editor-selection-tools,.rich-selection-toolbar,.selection-popover',root)
    .forEach(compactPromoteLinkActions);
}

function orientTableFlyoutGroup(toolbar) {
  if (!toolbar?.isConnected) return;
  const page=toolbar.closest('.notebook-page');
  const boundary=page?.getBoundingClientRect();
  const rect=toolbar.getBoundingClientRect();
  if (!boundary) return;
  /* Use the tallest current palette so every control chooses the same direction. */
  let tallest=0;
  $$('.spatial-align-control,.spatial-number-format-control,.spatial-fill-control,.spatial-table-size-control,.spatial-function-control,.notebook-action-flyout',toolbar)
    .forEach(control=>{ tallest=Math.max(tallest,flyoutNeededHeight?.(control) || (control.classList.contains('spatial-function-control')?66:48)); });
  tallest=Math.max(tallest,98);
  const down=(rect.top-boundary.top) < tallest+8;
  toolbar.classList.toggle('table-flyouts-down',down);
  $$('.spatial-align-control,.spatial-number-format-control,.spatial-fill-control,.spatial-table-size-control,.spatial-function-control,.notebook-action-flyout',toolbar)
    .forEach(control=>control.classList.toggle('flyout-down',down));
}

function orientUnifiedFlyout(control) {
  if (!control?.isConnected) return;
  const toolbar=control.closest('.spatial-table-controls');
  if (toolbar) return orientTableFlyoutGroup(toolbar);
  const dock=control.closest('#notebookDock') || $('#notebookDock');
  const boundary=dock?.getBoundingClientRect();
  const rect=control.getBoundingClientRect();
  if (!boundary) return;
  const needed=control.classList.contains('grid-create-control') ? 46 : 54;
  control.classList.toggle('flyout-down',(rect.top-boundary.top)<needed+6);
}

/* Replace the previous per-control orientation behavior for table toolbars. All table flyouts now
   move together; non-table controls retain the earlier individual edge-aware behavior. */
if (typeof orientNotebookFlyout === 'function' && !window.__salesShopUnifiedFlyoutDirection) {
  window.__salesShopUnifiedFlyoutDirection=true;
  const _unifiedOldOrientNotebookFlyout=orientNotebookFlyout;
  orientNotebookFlyout=function(control) {
    const toolbar=control?.closest?.('.spatial-table-controls');
    if (toolbar) return orientTableFlyoutGroup(toolbar);
    return _unifiedOldOrientNotebookFlyout(control);
  };
}

/* Simplified Grid range creation: one compact + trigger with Table and Shape. Shape always creates
   a rectangle; its own object toolbar owns Rectangle <-> Cloud afterwards. */
if (typeof drawSpatialSelection === 'function' && !window.__salesShopCompactGridCreateMenu) {
  window.__salesShopCompactGridCreateMenu=true;
  const _unifiedDrawSpatialSelection=drawSpatialSelection;
  drawSpatialSelection=function(canvas,bounds,{toolbar=false}={}) {
    _unifiedDrawSpatialSelection(canvas,bounds,{toolbar:false});
    if (!toolbar) return;
    $('.grid-cell-selection-toolbar',canvas)?.remove();
    const controls=document.createElement('div');
    controls.className='grid-cell-selection-toolbar grid-create-control';
    controls.style.setProperty('--select-col',bounds.col);
    controls.style.setProperty('--select-row',bounds.row);
    controls.innerHTML=`
      <button type="button" class="grid-create-trigger" data-compact-flyout-trigger title="Create object" aria-label="Create object">+</button>
      <span class="grid-create-panel">
        <button type="button" data-spatial-create="table" title="Table" aria-label="Table"><span class="grid-create-table-icon" aria-hidden="true"></span></button>
        <button type="button" data-spatial-create="box" title="Shape" aria-label="Shape"><span class="grid-create-shape-icon" aria-hidden="true"></span></button>
      </span>`;
    canvas.appendChild(controls);
    $$('[data-spatial-create]',controls).forEach(button=>button.onclick=event=>{
      event.preventDefault(); event.stopPropagation();
      createSpatialObject(button.dataset.spatialCreate,bounds);
    });
    bindCompactFlyout(controls);
    orientUnifiedFlyout(controls);
  };
}

function installUnifiedTableToolbar(controls,object) {
  if (!controls || !object) return;
  rememberTableToolbarSelection(controls,object);
  installTableFunctionControl(controls,object);
  compactPromoteLinkActions(controls);
  $$('.spatial-function-control,.notebook-action-flyout',controls).forEach(control=>bindCompactFlyout(control));
  requestAnimationFrame(()=>orientTableFlyoutGroup(controls));
}

if (typeof advancedSpatialTableControls === 'function' && !window.__salesShopUnifiedAdvancedControls) {
  window.__salesShopUnifiedAdvancedControls=true;
  const _unifiedAdvancedSpatialTableControls=advancedSpatialTableControls;
  advancedSpatialTableControls=function(object) {
    const controls=_unifiedAdvancedSpatialTableControls(object);
    installUnifiedTableToolbar(controls,object);
    return controls;
  };
}

function installUnifiedNotebookInteractions(root=$('#notebookDock')) {
  if (!root) return;
  installSpatialObjectEventShield(root);
  $$('.spatial-table-controls',root).forEach(controls=>{
    const object=spatialObjectById?.(tableObjectIdForControls(controls));
    if (object) installUnifiedTableToolbar(controls,object);
  });
  installCompactNotebookActions(root);
  $$('.grid-create-control,.notebook-action-flyout',root).forEach(control=>{
    bindCompactFlyout(control);
    orientUnifiedFlyout(control);
  });
  $$('.spatial-table-controls',root).forEach(orientTableFlyoutGroup);
}

/* Selection popovers are created outside #notebookDock after mouseup. Compact their Promote/Link
   actions as they arrive so notebook contextual UI follows the same pattern everywhere. */
if (!window.__salesShopNotebookActionObserver && typeof MutationObserver !== 'undefined') {
  window.__salesShopNotebookActionObserver=true;
  const observer=new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{
      if (!(node instanceof Element)) return;
      if (node.matches?.('.selection-popover')) compactPromoteLinkActions(node);
      $$('.selection-popover,.rich-selection-toolbar,.grid-editor-selection-tools',node).forEach(compactPromoteLinkActions);
    }));
  });
  observer.observe(document.body,{childList:true,subtree:true});
}

window.addEventListener('resize',()=>installUnifiedNotebookInteractions());

const _unifiedNotebookRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _unifiedNotebookRender(root);
  if (!root) return;
  installUnifiedNotebookInteractions(root);
};
