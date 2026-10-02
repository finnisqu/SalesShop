/* Small spreadsheet behavior hardening loaded after notebook-spreadsheet-core.js. */

/* Never let a stale table-cell selection steal a normal text copy elsewhere in the notebook. */
spreadsheetSelectionHasDomText=function() {
  const selection=window.getSelection();
  return !!(selection?.rangeCount && !selection.isCollapsed && selection.toString());
};

/* Once the user continues typing a direct formula after '=', the suggestion palette has done its
   job and should get out of the way. */
if (!window.__salesShopDirectFormulaPaletteDismiss) {
  window.__salesShopDirectFormulaPaletteDismiss=true;
  document.addEventListener('input',event=>{
    const td=event.target?.closest?.('.spatial-object-table td');
    if (!td) return;
    const text=String(td.textContent||'').trim();
    if (text.startsWith('=') && text.length>1) removeCellFunctionPalette?.();
  },true);
}

/* Clicking another cell after typing a valid formula should commit the formula without losing the
   destination focus when renderAll rebuilds the table. */
if (typeof spreadsheetCommitTypedFormulaCell==='function' && !window.__salesShopFormulaBlurFocusRestore) {
  window.__salesShopFormulaBlurFocusRestore=true;
  const _spreadsheetCommitTypedFormulaCell=spreadsheetCommitTypedFormulaCell;
  spreadsheetCommitTypedFormulaCell=function(td,object,options={}) {
    let restore=null;
    if (options?.silent && !options?.moveDown) {
      const active=document.activeElement?.closest?.('.spatial-object-table td');
      const activeWrap=active?.closest?.('.spatial-object-table');
      if (active && active!==td && activeWrap?.dataset?.spatialObjectId) {
        restore={
          objectId:activeWrap.dataset.spatialObjectId,
          r:Number(active.dataset.spatialRow)||0,
          c:Number(active.dataset.spatialCol)||0
        };
      }
    }
    const result=_spreadsheetCommitTypedFormulaCell(td,object,options);
    if (result && restore) {
      setTimeout(()=>{
        const wrap=$(`#notebookDock [data-spatial-object-id="${restore.objectId}"]`);
        const table=wrap ? $('.spatial-table',wrap) : null;
        const cell=table ? notebookTableCellAt?.(table,restore.r,restore.c) : null;
        if (cell) notebookPlaceCaretInCell?.(cell,'end');
      },0);
    }
    return result;
  };
}
