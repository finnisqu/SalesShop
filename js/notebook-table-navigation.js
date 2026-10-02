/* Spreadsheet-like keyboard navigation for notebook tables.
   Arrow keys move between cells without sacrificing ordinary left/right text editing. */

function notebookTableCellAt(table,row,col) {
  if (!table || row < 0 || col < 0) return null;
  for (const td of $$('td',table)) {
    const r=Number(td.dataset.spatialRow)||0;
    const c=Number(td.dataset.spatialCol)||0;
    const rows=Math.max(1,Number(td.rowSpan)||1);
    const cols=Math.max(1,Number(td.colSpan)||1);
    if (row>=r && row<r+rows && col>=c && col<c+cols) return td;
  }
  return null;
}

function notebookCaretAtCellBoundary(cell,side) {
  const selection=window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return false;
  const range=selection.getRangeAt(0);
  if (!cell.contains(range.startContainer) && range.startContainer!==cell) return false;

  try {
    const probe=document.createRange();
    probe.selectNodeContents(cell);
    if (side==='start') {
      probe.setEnd(range.startContainer,range.startOffset);
      return probe.toString().length===0;
    }
    probe.setStart(range.startContainer,range.startOffset);
    return probe.toString().length===0;
  } catch {
    return false;
  }
}

function notebookPlaceCaretInCell(cell,edge='end') {
  if (!cell) return;
  cell.focus({preventScroll:true});
  try {
    const range=document.createRange();
    range.selectNodeContents(cell);
    range.collapse(edge==='start');
    const selection=window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {}
}

function notebookMoveTableCell(table,cell,direction) {
  if (!table || !cell) return false;
  const r=Number(cell.dataset.spatialRow)||0;
  const c=Number(cell.dataset.spatialCol)||0;
  const rows=Math.max(1,Number(cell.rowSpan)||1);
  const cols=Math.max(1,Number(cell.colSpan)||1);

  let targetRow=r;
  let targetCol=c;
  let caretEdge='end';

  if (direction==='left') {
    targetCol=c-1;
    caretEdge='end';
  } else if (direction==='right') {
    targetCol=c+cols;
    caretEdge='start';
  } else if (direction==='up') {
    targetRow=r-1;
  } else if (direction==='down') {
    targetRow=r+rows;
  } else return false;

  const target=notebookTableCellAt(table,targetRow,targetCol);
  if (!target || target===cell) return false;
  notebookPlaceCaretInCell(target,caretEdge);
  return true;
}

function bindNotebookTableArrowNavigation(table) {
  if (!table || table.dataset.arrowNavBound) return;
  table.dataset.arrowNavBound='1';

  table.addEventListener('keydown',event=>{
    if (event.defaultPrevented || event.isComposing) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const cell=event.target.closest('td');
    if (!cell || !table.contains(cell)) return;

    let direction='';
    if (event.key==='ArrowUp') direction='up';
    else if (event.key==='ArrowDown') direction='down';
    else if (event.key==='ArrowLeft') {
      if (!notebookCaretAtCellBoundary(cell,'start')) return;
      direction='left';
    } else if (event.key==='ArrowRight') {
      if (!notebookCaretAtCellBoundary(cell,'end')) return;
      direction='right';
    } else if (event.key==='Enter' && !event.shiftKey) {
      /* Enter is reserved for committing an active notebook function selection. */
      if (typeof notebookFunctionPickMode!=='undefined' && notebookFunctionPickMode) return;
      direction='down';
    } else return;

    if (!notebookMoveTableCell(table,cell,direction)) return;
    event.preventDefault();
    event.stopPropagation();
  });
}

if (typeof bindSpatialTableNavigation==='function' && !window.__salesShopTableArrowNavigation) {
  window.__salesShopTableArrowNavigation=true;
  const _tableNavWithArrows=bindSpatialTableNavigation;
  bindSpatialTableNavigation=function(table) {
    const result=_tableNavWithArrows(table);
    bindNotebookTableArrowNavigation(table);
    return result;
  };
}

/* Existing tables on the first render are covered too, and later renders continue through the
   wrapped bindSpatialTableNavigation function above. */
function installNotebookTableArrowNavigation(root=$('#notebookDock')) {
  if (!root) return;
  $$('.spatial-table',root).forEach(bindNotebookTableArrowNavigation);
}

const _tableArrowNavigationRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _tableArrowNavigationRender(root);
  if (!root) return;
  installNotebookTableArrowNavigation(root);
};
