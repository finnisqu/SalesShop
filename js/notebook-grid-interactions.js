/* Grid interaction polish: select, stable drag, double-click edit, minimal inline editor. */

let selectedGridEntryId = null;

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
  note.addEventListener('click', e => {
    if (e.detail > 1) return;
    if (window.getSelection()?.toString().trim()) return;
    e.stopPropagation();
    selectGridNote(note, canvas);
  });

  note.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    /* First click only selects. A note must already be selected before it can move. */
    if (selectedGridEntryId !== note.dataset.entryId) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startCol = Number(note.dataset.gridCol) || 0;
    const startRow = Number(note.dataset.gridRow) || 0;
    let dragging = false;
    let nextCol = startCol;
    let nextRow = startRow;

    const onMove = ev => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < 9) return;

      if (!dragging) {
        dragging = true;
        note.classList.add('is-dragging');
        note.style.userSelect = 'none';
        window.getSelection()?.removeAllRanges();
      }

      ev.preventDefault();
      nextCol = Math.max(0, startCol + Math.round(dx / NOTEBOOK_GRID_SIZE));
      nextRow = Math.max(0, startRow + Math.round(dy / NOTEBOOK_GRID_SIZE));
      note.style.setProperty('--grid-col', nextCol);
      note.style.setProperty('--grid-row', nextRow);
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);

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
