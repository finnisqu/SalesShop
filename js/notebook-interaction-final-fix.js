/* Small cleanup for staged function mode: always restore the normal fx trigger before applying
   the active-mode checkmark state. */
if (typeof syncNotebookFunctionModeUi === 'function' && !window.__salesShopFunctionTriggerReset) {
  window.__salesShopFunctionTriggerReset=true;
  const _functionModeUi=syncNotebookFunctionModeUi;
  syncNotebookFunctionModeUi=function(root=$('#notebookDock')) {
    if (root) {
      $$('.spatial-function-control',root).forEach(control=>{
        control.classList.remove('function-picking');
        delete control.dataset.functionType;
        const trigger=$('.spatial-function-trigger',control);
        if (!trigger) return;
        trigger.textContent='ƒx';
        trigger.title='Functions';
        trigger.setAttribute('aria-label','Functions');
        trigger.onclick=event=>{
          event.preventDefault();
          event.stopPropagation();
          const opening=!control.classList.contains('flyout-open');
          control.classList.toggle('flyout-open',opening);
          if (opening) orientUnifiedFlyout?.(control);
        };
      });
    }
    return _functionModeUi(root);
  };
}

/* Keep the main table toolbar stationary over the table midpoint. The edge clamp may still nudge
   it just enough to remain visible, but changing cells / ranges never changes its anchor. */
if (typeof anchorTableToolbarToSelection === 'function' && !window.__salesShopCenteredTableToolbar) {
  window.__salesShopCenteredTableToolbar=true;
  anchorTableToolbarToSelection=function(toolbar) {
    if (!toolbar?.closest?.('.spatial-object-table')) return;
    toolbar.style.setProperty('--toolbar-anchor-x','50%');
  };
}

/* A dragged table range stops pointerup bubbling inside the table range-selection layer. Track the
   gesture in capture phase, then read the finalized range on the next task. Plain clicks are left
   to the existing bubble listener so Ctrl/Cmd-click does not get toggled twice. */
if (!window.__salesShopFunctionDragRangeCapture) {
  window.__salesShopFunctionDragRangeCapture=true;
  let functionRangePointer=null;

  document.addEventListener('pointerdown',event=>{
    if (!notebookFunctionPickMode || event.button!==0) return;
    const td=event.target?.closest?.('.spatial-object-table td');
    const wrap=td?.closest?.('.spatial-object-table');
    if (!td || !wrap || wrap.dataset.spatialObjectId!==notebookFunctionPickMode.objectId) return;
    functionRangePointer={
      pointerId:event.pointerId,
      x:event.clientX,
      y:event.clientY,
      objectId:wrap.dataset.spatialObjectId
    };
  },true);

  document.addEventListener('pointerup',event=>{
    const start=functionRangePointer;
    functionRangePointer=null;
    if (!start || event.pointerId!==start.pointerId || !notebookFunctionPickMode) return;
    if (notebookFunctionPickMode.objectId!==start.objectId) return;
    const distance=Math.hypot(event.clientX-start.x,event.clientY-start.y);
    if (distance<4) return; // ordinary / Ctrl-click is already handled by the existing listener.
    setTimeout(()=>{
      const mode=notebookFunctionPickMode;
      if (!mode || mode.objectId!==start.objectId) return;
      const object=spatialObjectById?.(start.objectId);
      if (!object) return;
      applyNotebookFunctionSourceSelection?.(object,{toggle:false});
    },0);
  },true);

  document.addEventListener('pointercancel',()=>{ functionRangePointer=null; },true);
}

function removeCellFunctionPalette() {
  $$('.cell-function-palette').forEach(menu=>menu.remove());
}

function showCellFunctionPalette(td,object) {
  if (!td || !object) return;
  removeCellFunctionPalette();
  const wrap=td.closest('.spatial-object-table');
  if (!wrap) return;

  const r=Number(td.dataset.spatialRow)||0;
  const c=Number(td.dataset.spatialCol)||0;
  const merge=spatialMergeCovering?.(object,r,c);
  const target={r:merge?.r ?? r,c:merge?.c ?? c};
  activeSpatialTableSelection={objectId:object.id,start:{...target},end:{...target}};
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
  paintSpatialTableSelection?.($('.spatial-table',wrap),object);

  const palette=document.createElement('div');
  palette.className='cell-function-palette';
  palette.setAttribute('role','menu');
  palette.innerHTML=`
    <button type="button" data-cell-function="sum" title="Sum" aria-label="Sum">Σ</button>
    <button type="button" data-cell-function="average" title="Average" aria-label="Average">x̄</button>
    <button type="button" data-cell-function="product" title="Product" aria-label="Product">×</button>`;

  const wrapRect=wrap.getBoundingClientRect();
  const cellRect=td.getBoundingClientRect();
  const center=(cellRect.left+cellRect.right)/2-wrapRect.left;
  const page=wrap.closest('.notebook-page');
  const pageRect=page?.getBoundingClientRect();
  const flyDown=!!(pageRect && cellRect.top-pageRect.top<72);
  const top=(flyDown ? cellRect.bottom : cellRect.top)-wrapRect.top;
  palette.style.left=`${Math.round(center)}px`;
  palette.style.top=`${Math.round(top)}px`;
  palette.classList.toggle('flyout-down',flyDown);

  $$('[data-cell-function]',palette).forEach(button=>{
    button.addEventListener('mousedown',event=>event.preventDefault());
    button.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      activeSpatialTableSelection={objectId:object.id,start:{...target},end:{...target}};
      beginNotebookFunctionPick?.(object,button.dataset.cellFunction);
      removeCellFunctionPalette();
    };
  });
  wrap.appendChild(palette);
}

/* Typing = into an empty table cell is shorthand for “start a function here”. It opens the same
   three lightweight functions directly over that result cell rather than moving the table toolbar. */
if (!window.__salesShopEqualsFunctionPalette) {
  window.__salesShopEqualsFunctionPalette=true;
  document.addEventListener('keydown',event=>{
    if (event.defaultPrevented || event.isComposing || event.key!=='=' || event.altKey || event.ctrlKey || event.metaKey) return;
    const td=event.target?.closest?.('.spatial-object-table td');
    if (!td || td.getAttribute('contenteditable')==='false') return;
    if (String(td.textContent||'').trim()) return; // embedded '=' remains ordinary text.
    const wrap=td.closest('.spatial-object-table');
    const object=spatialObjectById?.(wrap?.dataset.spatialObjectId);
    if (!object) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelNotebookFunctionPick?.();
    showCellFunctionPalette(td,object);
  },true);

  document.addEventListener('pointerdown',event=>{
    if (event.target?.closest?.('.cell-function-palette')) return;
    removeCellFunctionPalette();
  },true);
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape') removeCellFunctionPalette();
  },true);
}
