/* Grid interaction polish: select, grab-handle drag, double-click edit, minimal inline editor. */

let selectedGridEntryId = null;

function ensureGridGrabHandle(note) {
  let handle = $('.grid-grab-handle', note);
  if (handle) return handle;
  handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'grid-grab-handle';
  handle.setAttribute('aria-label','Move note');
  handle.setAttribute('title','Drag to move');
  handle.innerHTML = '<span></span><span></span><span></span>';
  note.appendChild(handle);
  return handle;
}

function selectGridNote(note, canvas) {
  $$('.grid-note.is-selected', canvas).forEach(el => el.classList.remove('is-selected'));
  selectedGridEntryId = note?.dataset.entryId || null;
  note?.classList.add('is-selected');
}

function clearGridNoteSelection(canvas) {
  selectedGridEntryId = null;
  $$('.grid-note.is-selected', canvas).forEach(el => el.classList.remove('is-selected'));
}

function bindGridNoteDrag(note, canvas) {
  const handle = ensureGridGrabHandle(note);

  note.addEventListener('click', e => {
    if (e.detail > 1) return;
    if (e.target.closest('.grid-grab-handle')) return;
    if (window.getSelection()?.toString().trim()) return;
    e.stopPropagation();
    selectGridNote(note, canvas);
  });

  /* Movement is grab-handle-only. The note body is now purely for selection / reading / editing. */
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    selectGridNote(note, canvas);

    const startX = e.clientX;
    const startY = e.clientY;
    const startCol = Number(note.dataset.gridCol) || 0;
    const startRow = Number(note.dataset.gridRow) || 0;
    let dragging = false;
    let nextCol = startCol;
    let nextRow = startRow;

    note.classList.add('is-drag-ready');
    handle.setPointerCapture?.(e.pointerId);

    const beginDragging = () => {
      if (dragging) return;
      dragging = true;
      note.classList.remove('is-drag-ready');
      note.classList.add('is-dragging');
      window.getSelection()?.removeAllRanges();
    };

    const onMove = ev => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const distance = Math.hypot(dx, dy);
      if (!dragging && distance < 2) return;
      beginDragging();
      ev.preventDefault();

      /* Intent is easy, but coordinates stay sticky to the current home square until the pointer
         travels roughly half a grid square. */
      nextCol = Math.max(0, startCol + Math.round(dx / NOTEBOOK_GRID_SIZE));
      nextRow = Math.max(0, startRow + Math.round(dy / NOTEBOOK_GRID_SIZE));
      note.style.setProperty('--grid-col', nextCol);
      note.style.setProperty('--grid-row', nextRow);
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      note.classList.remove('is-drag-ready');

      if (!dragging) return;
      note.classList.remove('is-dragging');
      note.dataset.gridCol = String(nextCol);
      note.dataset.gridRow = String(nextRow);

      const entry = gridPageEntries().find(x => x.id === note.dataset.entryId);
      if (entry) {
        entry.layout = 'grid';
        entry.grid = {col: nextCol, row: nextRow};
        save();
      }
    };

    document.addEventListener('pointermove', onMove, {passive:false});
    document.addEventListener('pointerup', onUp, {once:true});
    document.addEventListener('pointercancel', onUp, {once:true});
  });

  handle.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    selectGridNote(note, canvas);
  });
  handle.addEventListener('dblclick', e => {
    e.preventDefault();
    e.stopPropagation();
  });
}

const _salesShopBindGridNotebook = bindGridNotebook;
bindGridNotebook = function(root, canvas) {
  _salesShopBindGridNotebook(root, canvas);

  canvas.addEventListener('click', e => {
    if (e.target.closest('.grid-note') || e.target.closest('.grid-editor-wrap') || e.target.closest('.grid-history-rail')) return;
    clearGridNoteSelection(canvas);
  });

  $$('.grid-note', canvas).forEach(note => bindGridNoteDrag(note, canvas));
};

const _salesShopOpenGridEditor = openGridEditor;
openGridEditor = function(root, canvas, placement, existingEntry=null) {
  _salesShopOpenGridEditor(root, canvas, placement, existingEntry);
  if (!activeGridEditor) return;
  activeGridEditor.wrap.classList.add('grid-editor-minimal');
  activeGridEditor.textarea.placeholder = '';
  activeGridEditor.textarea.setAttribute('aria-label', existingEntry ? 'Edit grid note' : 'New grid note');
};
