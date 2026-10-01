/* Notebook QOL layer.
   Keeps spatial Grid deliberate, defaults the notebook to medium width,
   and adds lightweight notebook-only undo / redo. */

/* Medium is the default, but preserve an explicit Full choice. */
notebookWidthMode = function() {
  return state.settings?.notebookWidthMode === 'full' ? 'full' : 'medium';
};

/* Grid remains spatial: single-click is passive and the original canvas
   double-click listener chooses the exact square. The layout layer added a
   page-level grid double-click override; removing this marker after render
   lets that override stand down while leaving the canvas listener intact. */
const _salesShopQolNotebookClickShouldWrite = notebookClickShouldWrite;
notebookClickShouldWrite = function(target) {
  if (notebookPaperView() === 'grid') return false;
  return _salesShopQolNotebookClickShouldWrite(target);
};

const NOTEBOOK_UNDO_LIMIT = 30;
const notebookUndoStack = [];
const notebookRedoStack = [];
let notebookTypingBurstOpen = false;
let notebookTypingBurstTimer = null;
let notebookHistoryRestoring = false;

function notebookHistorySnapshot() {
  return JSON.stringify({
    notebook: state.notebook || {},
    activeNotebookPageByDate: state.settings?.activeNotebookPageByDate || {},
    notebookDrafts: state.settings?.notebookDrafts || {},
    currentNotebookDate,
    currentNotebookPageId
  });
}

function notebookPushUndoCheckpoint() {
  if (notebookHistoryRestoring) return;
  const snapshot = notebookHistorySnapshot();
  if (notebookUndoStack[notebookUndoStack.length - 1] !== snapshot) {
    notebookUndoStack.push(snapshot);
    if (notebookUndoStack.length > NOTEBOOK_UNDO_LIMIT) notebookUndoStack.shift();
  }
  notebookRedoStack.length = 0;
  updateNotebookUndoButtons();
}

function restoreNotebookHistorySnapshot(snapshot) {
  if (!snapshot) return;
  const parsed = JSON.parse(snapshot);
  notebookHistoryRestoring = true;
  try {
    state.notebook = parsed.notebook || {};
    state.settings ||= {};
    state.settings.activeNotebookPageByDate = parsed.activeNotebookPageByDate || {};
    state.settings.notebookDrafts = parsed.notebookDrafts || {};
    currentNotebookDate = parsed.currentNotebookDate || dateKey();
    currentNotebookPageId = parsed.currentNotebookPageId || null;
    if (typeof notebookDraftBuffer !== 'undefined') notebookDraftBuffer = Object.create(null);
    if (typeof activeGridEditor !== 'undefined' && activeGridEditor) {
      try { activeGridEditor.wrap?.remove(); } catch {}
      activeGridEditor = null;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  } finally {
    notebookHistoryRestoring = false;
    updateNotebookUndoButtons();
  }
}

function notebookUndo() {
  const current = notebookHistorySnapshot();
  let target = null;
  while (notebookUndoStack.length) {
    const candidate = notebookUndoStack.pop();
    if (candidate !== current) {
      target = candidate;
      break;
    }
  }
  if (!target) {
    updateNotebookUndoButtons();
    return;
  }
  notebookRedoStack.push(current);
  restoreNotebookHistorySnapshot(target);
}

function notebookRedo() {
  if (!notebookRedoStack.length) return;
  const current = notebookHistorySnapshot();
  const target = notebookRedoStack.pop();
  if (notebookUndoStack[notebookUndoStack.length - 1] !== current) {
    notebookUndoStack.push(current);
    if (notebookUndoStack.length > NOTEBOOK_UNDO_LIMIT) notebookUndoStack.shift();
  }
  restoreNotebookHistorySnapshot(target);
}

function notebookBeginTypingCheckpoint() {
  if (!notebookTypingBurstOpen) {
    notebookPushUndoCheckpoint();
    notebookTypingBurstOpen = true;
  }
  clearTimeout(notebookTypingBurstTimer);
  notebookTypingBurstTimer = setTimeout(() => {
    notebookTypingBurstOpen = false;
  }, 700);
}

function notebookUndoButtonHtml(type) {
  const undo = type === 'undo';
  return `<button type="button" class="notebook-history-button" data-notebook-${type} title="${undo ? 'Undo' : 'Redo'} (${undo ? 'Ctrl/Cmd+Z' : 'Ctrl/Cmd+Shift+Z'})" aria-label="${undo ? 'Undo' : 'Redo'}">
    <span aria-hidden="true">${undo ? '↶' : '↷'}</span>
  </button>`;
}

function installNotebookUndoControls(root) {
  const toolbar = $('.notebook-toolbar', root);
  const left = $('.notebook-toolbar-left', root);
  if (!toolbar || !left) return;

  let controls = $('[data-notebook-history-controls]', toolbar);
  if (!controls) {
    controls = document.createElement('div');
    controls.className = 'notebook-history-controls';
    controls.dataset.notebookHistoryControls = '';
    controls.innerHTML = notebookUndoButtonHtml('undo') + notebookUndoButtonHtml('redo');
    left.appendChild(controls);
  }
  $('[data-notebook-undo]', controls).onclick = notebookUndo;
  $('[data-notebook-redo]', controls).onclick = notebookRedo;
  updateNotebookUndoButtons(root);
}

function updateNotebookUndoButtons(root = $('#notebookDock')) {
  if (!root) return;
  const undo = $('[data-notebook-undo]', root);
  const redo = $('[data-notebook-redo]', root);
  if (undo) undo.disabled = notebookUndoStack.length === 0;
  if (redo) redo.disabled = notebookRedoStack.length === 0;
}

function polishNotebookToolbar(root) {
  const styleButton = $('[data-notebook-view-button]', root);
  if (styleButton) {
    styleButton.textContent = 'Style ▾';
    styleButton.title = 'Notebook style';
    styleButton.setAttribute('aria-label', 'Notebook style');
  }
  installNotebookUndoControls(root);

  /* Restore exact-position Grid behavior. See note above. */
  if (notebookPaperView() === 'grid') {
    $('.grid-notebook-canvas', root)?.removeAttribute('data-grid-canvas');
  }
}

const _salesShopQolRenderNotebookSurface = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopQolRenderNotebookSurface(root);
  if (!root) return;
  polishNotebookToolbar(root);
};

/* Capture a single pre-edit snapshot for each natural typing burst. */
if (!window.__salesShopNotebookUndoEvents) {
  window.__salesShopNotebookUndoEvents = true;

  document.addEventListener('beforeinput', e => {
    if (!e.target?.closest?.('.notebook-shell')) return;
    notebookBeginTypingCheckpoint();
  }, true);

  /* Structural notebook edits do not emit beforeinput. Capture before them. */
  document.addEventListener('pointerdown', e => {
    const target = e.target?.closest?.(
      '.rich-tool, [data-new-page], .grid-grab-handle'
    );
    if (!target) return;
    notebookTypingBurstOpen = false;
    clearTimeout(notebookTypingBurstTimer);
    notebookPushUndoCheckpoint();
  }, true);

  document.addEventListener('change', e => {
    if (!e.target?.matches?.('[data-file-input]')) return;
    notebookPushUndoCheckpoint();
  }, true);

  document.addEventListener('keydown', e => {
    const inNotebook = !!e.target?.closest?.('.notebook-shell');
    if (!inNotebook || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'z') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.shiftKey) notebookRedo();
      else notebookUndo();
    } else if (key === 'y') {
      e.preventDefault();
      e.stopImmediatePropagation();
      notebookRedo();
    }
  }, true);
}
