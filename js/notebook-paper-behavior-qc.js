/* Paper behavior QC: preserve drag-selection as the primary gesture while keeping writing effortless.
   A finished selection can become text by typing immediately, or by a true click inside it. Dragging
   again always stays a selection gesture. Rotation controls live at the lower-right corner so they
   never compete with the top object toolbar/delete controls. */

let paperBehaviorSelectedClickGesture = null;
let paperBehaviorConsumeClickUntil = 0;

function paperBehaviorCellInsideSelection(cell,selection) {
  if (!cell || !selection) return false;
  return cell.col >= selection.col &&
    cell.col < selection.col + selection.cols &&
    cell.row >= selection.row &&
    cell.row < selection.row + selection.rows;
}

function paperBehaviorGridSelectionPointerTarget(event) {
  const canvas=event.target?.closest?.('.grid-notebook-canvas');
  if (!canvas) return null;
  if (event.target.closest('.grid-cell-selection-toolbar,.notebook-spatial-object,.grid-note,.grid-editor-wrap,.grid-grab-handle')) return null;
  return canvas;
}

/* Capture the intent before the canvas' normal selection listener runs. We do not prevent anything
   here: movement still belongs entirely to the existing drag-selection system. */
document.addEventListener('pointerdown',event=>{
  if (event.button!==0) return;
  if (typeof activeSpatialSelection==='undefined' || !activeSpatialSelection) {
    paperBehaviorSelectedClickGesture=null;
    return;
  }
  const canvas=paperBehaviorGridSelectionPointerTarget(event);
  if (!canvas) {
    paperBehaviorSelectedClickGesture=null;
    return;
  }
  const cell=spatialPointerCell(canvas,event);
  const inside=paperBehaviorCellInsideSelection(cell,activeSpatialSelection);
  paperBehaviorSelectedClickGesture=inside ? {
    canvas,
    cell,
    pointerId:event.pointerId,
    x:event.clientX,
    y:event.clientY,
    moved:false
  } : null;

  /* Neutralize the older broad click-to-write shortcut for this pointer sequence. */
  if (typeof paperBehaviorSelectionFinishedAt!=='undefined') paperBehaviorSelectionFinishedAt=Date.now();
},true);

document.addEventListener('pointermove',event=>{
  const gesture=paperBehaviorSelectedClickGesture;
  if (!gesture || gesture.pointerId!==event.pointerId || gesture.moved) return;
  if (Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>=5) gesture.moved=true;
},true);

document.addEventListener('pointerup',event=>{
  const gesture=paperBehaviorSelectedClickGesture;
  if (typeof activeSpatialSelection!=='undefined' && activeSpatialSelection && typeof paperBehaviorSelectionFinishedAt!=='undefined') {
    /* A click event follows pointerup; keep the retired broad shortcut asleep for that click. */
    paperBehaviorSelectionFinishedAt=Date.now();
  }
  if (!gesture || gesture.pointerId!==event.pointerId) return;
  paperBehaviorSelectedClickGesture=null;
  if (gesture.moved) return;
  if (typeof activeSpatialSelection==='undefined' || !activeSpatialSelection) return;
  if (!paperBehaviorCellInsideSelection(gesture.cell,activeSpatialSelection)) return;
  if (typeof isCurrentNotebookPageEditable==='function' && !isCurrentNotebookPageEditable()) return;

  const root=$('#notebookDock');
  if (!root || notebookPaperView()!=='grid') return;
  clearSpatialSelection?.(gesture.canvas);
  openGridEditor?.(root,gesture.canvas,gesture.cell);
  paperBehaviorConsumeClickUntil=Date.now()+180;
},true);

document.addEventListener('pointercancel',event=>{
  if (paperBehaviorSelectedClickGesture?.pointerId===event.pointerId) paperBehaviorSelectedClickGesture=null;
},true);

/* Prevent the synthetic click after a selection->writing click from bubbling back into the canvas
   and immediately clearing/changing the editor we just opened. */
document.addEventListener('click',event=>{
  if (Date.now()>=paperBehaviorConsumeClickUntil) return;
  if (!event.target?.closest?.('.grid-notebook-canvas')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
},true);

/* Rotation is a corner transform affordance, not part of the top toolbar. */
const paperBehaviorQcStyle=document.createElement('style');
paperBehaviorQcStyle.dataset.paperBehaviorQc='';
paperBehaviorQcStyle.textContent=`
#notebookDock .paper-object-rotate-handle {
  top:auto !important;
  right:-17px !important;
  bottom:-17px !important;
}
#notebookDock .grid-note.notebook-spatial-image-object > .paper-object-rotate-handle {
  top:auto !important;
  right:-17px !important;
  bottom:-17px !important;
}
`;
document.head.appendChild(paperBehaviorQcStyle);
