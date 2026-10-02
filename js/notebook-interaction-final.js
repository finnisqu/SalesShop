/* Final notebook interaction pass: shape resizing, stable presentation/menu geometry,
   selection-anchored table toolbars, safer delete controls, and staged table functions. */

let notebookFunctionPickMode = null;

function notebookFunctionCellKey(r,c) { return `${r}:${c}`; }
function notebookFunctionCellCoords(key) {
  const [r,c]=String(key||'').split(':').map(Number);
  return {r:Number.isFinite(r)?r:0,c:Number.isFinite(c)?c:0};
}

function notebookFunctionResult(type,values) {
  if (!values.length) return null;
  if (type==='sum') return values.reduce((a,b)=>a+b,0);
  if (type==='average') return values.reduce((a,b)=>a+b,0)/values.length;
  if (type==='product') return values.reduce((a,b)=>a*b,1);
  return null;
}

function recalcNotebookTableFormulas(object) {
  if (!object || object.type!=='table' || !object.cellFormulas) return false;
  normalizeAdvancedSpatialTable?.(object);
  let changed=false;
  /* A few passes let simple chained results settle without introducing a full dependency graph. */
  for (let pass=0;pass<4;pass++) {
    let passChanged=false;
    Object.entries(object.cellFormulas).forEach(([targetKey,formula])=>{
      if (!formula || !['sum','average','product'].includes(formula.type) || !Array.isArray(formula.sources)) return;
      const target=notebookFunctionCellCoords(targetKey);
      if (target.r<0 || target.c<0 || target.r>=object.rows || target.c>=object.cols) {
        delete object.cellFormulas[targetKey];
        changed=true;
        return;
      }
      const values=[];
      formula.sources.forEach(key=>{
        if (key===targetKey) return;
        const {r,c}=notebookFunctionCellCoords(key);
        if (r<0 || c<0 || r>=object.rows || c>=object.cols) return;
        const parsed=parseSpatialNumericValue?.(object.cells?.[r]?.[c]);
        if (parsed!=null && Number.isFinite(parsed)) values.push(parsed);
      });
      const result=notebookFunctionResult(formula.type,values);
      if (result==null) return;
      const clean=Number.isInteger(result) ? String(result) : String(Number(result.toFixed(8)));
      if (String(object.cells?.[target.r]?.[target.c] ?? '') !== clean) {
        object.cells[target.r][target.c]=clean;
        passChanged=true;
        changed=true;
      }
    });
    if (!passChanged) break;
  }
  return changed;
}

function functionTargetFromSelection(object) {
  const selection=(typeof activeSpatialTableSelection!=='undefined') ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId!==object?.id) return null;
  const bounds=spatialSelectionBoundsForTable?.(selection);
  if (!bounds || bounds.rows!==1 || bounds.cols!==1) return null;
  const merge=spatialMergeCovering?.(object,bounds.r1,bounds.c1);
  return {r:merge?.r ?? bounds.r1,c:merge?.c ?? bounds.c1};
}

function beginNotebookFunctionPick(object,type) {
  if (!object || object.type!=='table' || !['sum','average','product'].includes(type)) return;
  const target=functionTargetFromSelection(object);
  if (!target) return toast('Click the result cell first, then choose a function.');
  notebookFunctionPickMode={
    objectId:object.id,
    type,
    target,
    sources:new Set()
  };
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
  syncNotebookFunctionModeUi();
}

function cancelNotebookFunctionPick() {
  notebookFunctionPickMode=null;
  syncNotebookFunctionModeUi();
}

function commitNotebookFunctionPick() {
  const mode=notebookFunctionPickMode;
  if (!mode) return false;
  const object=spatialObjectById?.(mode.objectId);
  if (!object || object.type!=='table') { cancelNotebookFunctionPick(); return false; }
  const targetKey=notebookFunctionCellKey(mode.target.r,mode.target.c);
  const sources=[...mode.sources].filter(key=>key!==targetKey);
  if (!sources.length) {
    toast('Select the cells to calculate first.');
    return false;
  }
  const values=[];
  sources.forEach(key=>{
    const {r,c}=notebookFunctionCellCoords(key);
    const parsed=parseSpatialNumericValue?.(object.cells?.[r]?.[c]);
    if (parsed!=null && Number.isFinite(parsed)) values.push(parsed);
  });
  if (!values.length) {
    toast('The selected cells do not contain numbers.');
    return false;
  }
  notebookPushUndoCheckpoint?.();
  object.cellFormulas ||= {};
  object.cellFormulas[targetKey]={type:mode.type,sources};
  recalcNotebookTableFormulas(object);
  object.cellStyles ||= {};
  object.cellStyles[targetKey] ||= {};
  if (!object.cellStyles[targetKey].align) object.cellStyles[targetKey].align='right';
  object.updatedAt=new Date().toISOString();
  notebookFunctionPickMode=null;
  activeSpatialTableSelection={objectId:object.id,start:{...mode.target},end:{...mode.target}};
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
  save();
  renderAll();
  return true;
}

function functionSourceKeysFromCurrentSelection(object) {
  const selection=(typeof activeSpatialTableSelection!=='undefined') ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId!==object?.id) return [];
  const cells=selectedSpatialTableCells?.(object) || [];
  const keys=[];
  const seen=new Set();
  cells.forEach(({r,c})=>{
    const merge=spatialMergeCovering?.(object,r,c);
    const key=notebookFunctionCellKey(merge?.r ?? r,merge?.c ?? c);
    if (!seen.has(key)) { seen.add(key); keys.push(key); }
  });
  return keys;
}

function applyNotebookFunctionSourceSelection(object,{toggle=false}={}) {
  const mode=notebookFunctionPickMode;
  if (!mode || mode.objectId!==object?.id) return;
  const targetKey=notebookFunctionCellKey(mode.target.r,mode.target.c);
  const keys=functionSourceKeysFromCurrentSelection(object).filter(key=>key!==targetKey);
  if (!keys.length) return;
  if (!toggle) mode.sources=new Set(keys);
  else keys.forEach(key=>mode.sources.has(key) ? mode.sources.delete(key) : mode.sources.add(key));
  syncNotebookFunctionModeUi();
}

function syncNotebookFunctionModeUi(root=$('#notebookDock')) {
  if (!root) return;
  $$('.spatial-table td.notebook-function-source,.spatial-table td.notebook-function-target',root).forEach(td=>{
    td.classList.remove('notebook-function-source','notebook-function-target');
  });
  $$('.spatial-function-control.function-picking',root).forEach(control=>control.classList.remove('function-picking'));
  if (!notebookFunctionPickMode) return;
  const mode=notebookFunctionPickMode;
  const wrap=root.querySelector(`[data-spatial-object-id="${mode.objectId}"]`);
  if (!wrap) return;
  const target=wrap.querySelector(`td[data-spatial-row="${mode.target.r}"][data-spatial-col="${mode.target.c}"]`);
  target?.classList.add('notebook-function-target');
  mode.sources.forEach(key=>{
    const {r,c}=notebookFunctionCellCoords(key);
    wrap.querySelector(`td[data-spatial-row="${r}"][data-spatial-col="${c}"]`)?.classList.add('notebook-function-source');
  });
  const control=$('.spatial-function-control',wrap);
  if (control) {
    control.classList.add('function-picking');
    control.dataset.functionType=mode.type;
    const trigger=$('.spatial-function-trigger',control);
    if (trigger) {
      trigger.textContent='✓';
      trigger.title=`Apply ${mode.type}`;
      trigger.setAttribute('aria-label',`Apply ${mode.type}`);
      trigger.onclick=event=>{event.preventDefault();event.stopPropagation();commitNotebookFunctionPick();};
    }
  }
}

/* Replace quick-function behavior with result-cell -> function -> source-selection mode. */
notebookFunctionControl=function(object) {
  const control=document.createElement('span');
  control.className='spatial-function-control';
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='spatial-function-trigger';
  trigger.dataset.compactFlyoutTrigger='';
  trigger.title='Functions';
  trigger.setAttribute('aria-label','Functions');
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
      event.preventDefault();event.stopPropagation();
      beginNotebookFunctionPick(object,type);
      control.classList.remove('flyout-open');
    };
    panel.appendChild(button);
  });
  control.append(trigger,panel);
  bindCompactFlyout?.(control);
  return control;
};

/* Table source selection is finalized by the table's own pointerup handler before this document
   listener runs. Ctrl/Cmd keeps the prior source set and toggles the newly selected cells. */
document.addEventListener('pointerup',event=>{
  const mode=notebookFunctionPickMode;
  if (!mode) return;
  const wrap=event.target?.closest?.('.spatial-object-table');
  if (!wrap || wrap.dataset.spatialObjectId!==mode.objectId) return;
  if (!event.target.closest('td')) return;
  const object=spatialObjectById?.(mode.objectId);
  if (!object) return;
  setTimeout(()=>applyNotebookFunctionSourceSelection(object,{toggle:event.ctrlKey||event.metaKey}),0);
});

document.addEventListener('keydown',event=>{
  if (!notebookFunctionPickMode) return;
  if (event.key==='Escape') {
    event.preventDefault();
    cancelNotebookFunctionPick();
  } else if (event.key==='Enter' && !event.shiftKey) {
    event.preventDefault();
    commitNotebookFunctionPick();
  }
},true);

/* Shapes resize in notebook-grid increments from four quiet side handles. */
function installShapeResizeHandles(object,wrap) {
  if (!object || !wrap || !['box','cloud'].includes(object.type)) return;
  if ($('.spatial-resize-handle',wrap)) return;
  const editable=typeof isCurrentNotebookPageEditable!=='function' || isCurrentNotebookPageEditable();
  if (!editable) return;
  ['n','e','s','w'].forEach(direction=>{
    const handle=document.createElement('button');
    handle.type='button';
    handle.className=`spatial-resize-handle spatial-resize-${direction}`;
    handle.dataset.resizeDirection=direction;
    handle.title='Drag to resize';
    handle.setAttribute('aria-label',`Resize ${direction}`);
    handle.addEventListener('pointerdown',event=>{
      if (event.button!==0) return;
      event.preventDefault();event.stopPropagation();
      closeActiveGridWritingMode?.();
      const step=spatialStep?.() || 28;
      const startX=event.clientX,startY=event.clientY;
      const start={
        col:Math.max(0,Number(object.col)||0),row:Math.max(0,Number(object.row)||0),
        cols:Math.max(1,Number(object.cols)||1),rows:Math.max(1,Number(object.rows)||1)
      };
      let next={...start};
      let checkpointed=false;
      handle.setPointerCapture?.(event.pointerId);
      selectedSpatialObjectId=object.id;
      wrap.classList.add('is-selected','is-resizing');
      const onMove=ev=>{
        const dc=Math.round((ev.clientX-startX)/step);
        const dr=Math.round((ev.clientY-startY)/step);
        next={...start};
        if (direction==='e') next.cols=Math.max(1,start.cols+dc);
        if (direction==='s') next.rows=Math.max(1,start.rows+dr);
        if (direction==='w') {
          const right=start.col+start.cols;
          next.col=Math.max(0,Math.min(right-1,start.col+dc));
          next.cols=right-next.col;
        }
        if (direction==='n') {
          const bottom=start.row+start.rows;
          next.row=Math.max(0,Math.min(bottom-1,start.row+dr));
          next.rows=bottom-next.row;
        }
        if (!checkpointed && (next.col!==start.col||next.row!==start.row||next.cols!==start.cols||next.rows!==start.rows)) {
          checkpointed=true;
          notebookPushUndoCheckpoint?.();
        }
        wrap.style.setProperty('--object-col',next.col);
        wrap.style.setProperty('--object-row',next.row);
        wrap.style.setProperty('--object-cols',next.cols);
        wrap.style.setProperty('--object-rows',next.rows);
      };
      const onUp=()=>{
        document.removeEventListener('pointermove',onMove);
        document.removeEventListener('pointerup',onUp);
        document.removeEventListener('pointercancel',onUp);
        wrap.classList.remove('is-resizing');
        if (!checkpointed) return;
        Object.assign(object,next,{updatedAt:new Date().toISOString()});
        save();
        renderAll();
      };
      document.addEventListener('pointermove',onMove,{passive:false});
      document.addEventListener('pointerup',onUp,{once:true});
      document.addEventListener('pointercancel',onUp,{once:true});
    });
    wrap.appendChild(handle);
  });
}

/* Shape and text delete only exist inside their opened toolbar. */
if (typeof spatialShapeToolbar==='function' && !window.__salesShopFinalShapeToolbarDelete) {
  window.__salesShopFinalShapeToolbarDelete=true;
  const _finalShapeToolbar=spatialShapeToolbar;
  spatialShapeToolbar=function(object) {
    const toolbar=_finalShapeToolbar(object);
    const del=$('[data-shape-delete]',toolbar);
    if (del) {
      del.textContent='×';
      del.classList.add('notebook-toolbar-delete');
      del.title='Delete shape';
      del.setAttribute('aria-label','Delete shape');
    }
    return toolbar;
  };
}

if (typeof gridTextObjectToolbar==='function' && !window.__salesShopFinalTextToolbarDelete) {
  window.__salesShopFinalTextToolbarDelete=true;
  const _finalGridTextToolbar=gridTextObjectToolbar;
  gridTextObjectToolbar=function(note,entry,text) {
    const toolbar=_finalGridTextToolbar(note,entry,text);
    if (!$('[data-grid-toolbar-delete]',toolbar)) {
      const sep=document.createElement('span');
      sep.className='grid-text-toolbar-separator';
      const del=document.createElement('button');
      del.type='button';
      del.dataset.gridToolbarDelete='';
      del.className='notebook-toolbar-delete';
      del.textContent='×';
      del.title='Delete text box';
      del.setAttribute('aria-label','Delete text box');
      del.onclick=event=>{event.preventDefault();event.stopPropagation();removeNotebookEntry?.(entry.id);};
      toolbar.append(sep,del);
    }
    return toolbar;
  };
}

function anchorTableToolbarToSelection(toolbar) {
  const wrap=toolbar?.closest?.('.spatial-object-table');
  if (!wrap) return;
  const wrapRect=wrap.getBoundingClientRect();
  let cells=$$('.spatial-table-cell-selected',wrap);
  const focused=document.activeElement?.closest?.('.spatial-object-table td');
  if (!cells.length && focused && wrap.contains(focused)) cells=[focused];
  let local=wrapRect.width/2;
  if (cells.length) {
    const rects=cells.map(cell=>cell.getBoundingClientRect());
    const left=Math.min(...rects.map(rect=>rect.left));
    const right=Math.max(...rects.map(rect=>rect.right));
    local=((left+right)/2)-wrapRect.left;
  }
  toolbar.style.setProperty('--toolbar-anchor-x',`${Math.round(local)}px`);
}

/* Re-clamp from the selected-cell anchor, not from the center of a very large table. */
clampNotebookFloatingToolbar=function(toolbar) {
  if (!toolbar?.isConnected) return;
  anchorTableToolbarToSelection(toolbar);
  const page=toolbar.closest('.notebook-page');
  const dock=toolbar.closest('#notebookDock');
  if (!page) return;
  toolbar.style.setProperty('--toolbar-edge-shift','0px');
  const pageRect=page.getBoundingClientRect();
  const dockRect=dock?.getBoundingClientRect() || pageRect;
  const left=Math.max(pageRect.left,dockRect.left)+7;
  const right=Math.min(pageRect.right,dockRect.right)-7;
  const rect=toolbar.getBoundingClientRect();
  if (!rect.width || right<=left) return;
  let shift=0;
  if (rect.width >= right-left) shift=((left+right)/2)-(rect.left+rect.width/2);
  else {
    if (rect.left<left) shift+=left-rect.left;
    if (rect.right+shift>right) shift-=rect.right+shift-right;
  }
  toolbar.style.setProperty('--toolbar-edge-shift',`${Math.round(shift)}px`);
};

function installFinalTableBehavior(root=$('#notebookDock')) {
  if (!root) return;
  $$('.spatial-table-controls',root).forEach(controls=>{
    anchorTableToolbarToSelection(controls);
    $('[data-table-delete]',controls)?.classList.add('notebook-toolbar-delete');
    clampNotebookFloatingToolbar(controls);
  });
  $$('.notebook-spatial-object',root).forEach(wrap=>{
    const object=spatialObjectById?.(wrap.dataset.spatialObjectId);
    if (!object) return;
    installShapeResizeHandles(object,wrap);
  });
  syncNotebookFunctionModeUi(root);
}

/* Keep lightweight formulas fresh as source cells are edited. */
if (typeof renderSpatialTable==='function' && !window.__salesShopFinalFormulaRender) {
  window.__salesShopFinalFormulaRender=true;
  const _finalFormulaRenderTable=renderSpatialTable;
  renderSpatialTable=function(object,wrap) {
    const changed=recalcNotebookTableFormulas(object);
    if (changed) save();
    _finalFormulaRenderTable(object,wrap);
    const table=$('.spatial-table',wrap);
    if (!table || table.dataset.formulaRefreshBound) return;
    table.dataset.formulaRefreshBound='1';
    table.addEventListener('input',event=>{
      const td=event.target.closest('td');
      if (!td) return;
      const key=notebookFunctionCellKey(Number(td.dataset.spatialRow)||0,Number(td.dataset.spatialCol)||0);
      if (object.cellFormulas?.[key]) delete object.cellFormulas[key];
      if (!recalcNotebookTableFormulas(object)) return;
      Object.keys(object.cellFormulas||{}).forEach(targetKey=>{
        const {r,c}=notebookFunctionCellCoords(targetKey);
        const target=table.querySelector(`td[data-spatial-row="${r}"][data-spatial-col="${c}"]`);
        if (!target || target===document.activeElement) return;
        const style=object.cellStyles?.[targetKey] || {};
        target.textContent=formatSpatialCellValue?.(object.cells?.[r]?.[c] ?? '',style.numberFormat||'none') ?? object.cells?.[r]?.[c] ?? '';
      });
      save();
    });
  };
}

if (typeof advancedSpatialTableControls==='function' && !window.__salesShopFinalAdvancedControls) {
  window.__salesShopFinalAdvancedControls=true;
  const _finalAdvancedControls=advancedSpatialTableControls;
  advancedSpatialTableControls=function(object) {
    const controls=_finalAdvancedControls(object);
    $('[data-table-delete]',controls)?.classList.add('notebook-toolbar-delete');
    requestAnimationFrame(()=>{
      anchorTableToolbarToSelection(controls);
      clampNotebookFloatingToolbar(controls);
      syncNotebookFunctionModeUi();
    });
    return controls;
  };
}

const _finalRenderSpatialObject=renderSpatialObject;
renderSpatialObject=function(object,canvas) {
  _finalRenderSpatialObject(object,canvas);
  const escaped=(window.CSS&&CSS.escape)?CSS.escape(object.id):object.id;
  const wrap=canvas?.querySelector?.(`[data-spatial-object-id="${escaped}"]`);
  if (wrap) installShapeResizeHandles(object,wrap);
};

const _finalNotebookRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _finalNotebookRender(root);
  if (!root) return;
  installFinalTableBehavior(root);
};
