/* Grid interaction polish: select, hold-to-drag, grab handles, double-click edit, minimal inline editor. */

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
    if (window.getSelection()?.toString().trim()) return;
    e.stopPropagation();
    selectGridNote(note, canvas);
  });

  note.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.grid-editor-selection-tools')) return;

    const fromHandle = !!e.target.closest('.grid-grab-handle');
    const wasSelected = selectedGridEntryId === note.dataset.entryId;
    selectGridNote(note, canvas);

    const startX = e.clientX;
    const startY = e.clientY;
    const startCol = Number(note.dataset.gridCol) || 0;
    const startRow = Number(note.dataset.gridRow) || 0;
    let dragging = false;
    let armed = fromHandle;
    let nextCol = startCol;
    let nextRow = startRow;
    let holdTimer = null;

    const armDrag = () => {
      armed = true;
      note.classList.add('is-drag-ready');
    };

    /* The handle is immediate. The note body becomes drag-intent after a short, deliberate hold.
       This leaves a normal quick mouse sweep available for selecting text. */
    if (!fromHandle) holdTimer = setTimeout(armDrag, wasSelected ? 120 : 165);

    const beginDragging = () => {
      if (dragging) return;
      dragging = true;
      note.classList.remove('is-drag-ready');
      note.classList.add('is-dragging');
      note.style.userSelect = 'none';
      window.getSelection()?.removeAllRanges();
      try { note.setPointerCapture?.(e.pointerId); } catch {}
    };

    const onMove = ev => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const distance = Math.hypot(dx, dy);

      /* Handle is intentionally easy. Body drag is easy once hold-intent is established,
         but a quick body movement still needs a stronger threshold so clicks/text selection stay stable. */
      if (!armed) {
        if (distance < 10) return;
        if (!wasSelected) return;
        armed = true;
      }
      if (!dragging && distance < (fromHandle ? 3 : 4)) return;
      beginDragging();

      ev.preventDefault();
      /* Actual position stays snapped. You have to travel roughly half a square before a note
         leaves its home square, even though drag intent itself now feels immediate. */
      nextCol = Math.max(0, startCol + Math.round(dx / NOTEBOOK_GRID_SIZE));
      nextRow = Math.max(0, startRow + Math.round(dy / NOTEBOOK_GRID_SIZE));
      note.style.setProperty('--grid-col', nextCol);
      note.style.setProperty('--grid-row', nextRow);
    };

    const onUp = () => {
      if (holdTimer) clearTimeout(holdTimer);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      note.classList.remove('is-drag-ready');

      if (!dragging) return;
      note.classList.remove('is-dragging');
      note.style.userSelect = '';
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

  /* Prevent the handle itself from triggering edit selection/double-click behavior. */
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
