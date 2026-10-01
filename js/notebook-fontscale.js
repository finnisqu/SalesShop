/* Global notebook text scale.
   One setting controls normal notebook text and the physical paper rhythm beneath it. */

const NOTEBOOK_FONT_SIZES = [8,9,10,11,12,13,14,16,18];

function notebookFontSize() {
  const requested = Number(state.settings?.notebookFontSize);
  return NOTEBOOK_FONT_SIZES.includes(requested) ? requested : 13;
}

function notebookPaperRhythm() {
  /* Preserve the original 13px -> 28px relationship while scaling noticeably at small sizes. */
  return Math.round(notebookFontSize() * 2 + 2);
}

function applyNotebookFontScale(root) {
  const shell = $('.notebook-shell',root);
  if (!shell) return;
  const size = notebookFontSize();
  const rhythm = notebookPaperRhythm();
  shell.style.setProperty('--notebook-font-size',`${size}px`);
  shell.style.setProperty('--notebook-row-size',`${rhythm}px`);
  shell.dataset.notebookFontSize = String(size);
}

function installNotebookFontControl(root) {
  const left = $('.notebook-toolbar-left',root);
  if (!left) return;

  let control = $('[data-notebook-font-control]',left);
  if (!control) {
    control = document.createElement('label');
    control.className = 'notebook-font-control';
    control.dataset.notebookFontControl = '';
    control.title = 'Notebook font size';
    control.innerHTML = `
      <span class="notebook-font-a" aria-hidden="true">A</span>
      <select data-notebook-font-size aria-label="Notebook font size">
        ${NOTEBOOK_FONT_SIZES.map(size=>`<option value="${size}">${size}</option>`).join('')}
      </select>`;

    const history = $('[data-notebook-history-controls]',left);
    const capture = $('.notebook-capture-tools',left);
    if (capture) left.insertBefore(control,capture);
    else if (history?.nextSibling) left.insertBefore(control,history.nextSibling);
    else left.appendChild(control);
  }

  const select = $('[data-notebook-font-size]',control);
  select.value = String(notebookFontSize());
  select.onchange = ()=>{
    const value = Number(select.value);
    if (!NOTEBOOK_FONT_SIZES.includes(value)) return;
    state.settings ||= {};
    state.settings.notebookFontSize = value;
    save();
    renderAll();
  };
}

/* Grid coordinates are logical row/column positions. Their physical size follows the paper rhythm. */
function bindScaledGridNoteDrag(note,canvas) {
  const handle = ensureGridGrabHandle(note);

  note.addEventListener('click',e=>{
    if (e.detail > 1) return;
    if (e.target.closest('.grid-grab-handle')) return;
    if (window.getSelection()?.toString().trim()) return;
    e.stopPropagation();
    selectGridNote(note,canvas);
  });

  handle.addEventListener('pointerdown',e=>{
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    selectGridNote(note,canvas);

    const step = notebookPaperRhythm();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCol = Number(note.dataset.gridCol) || 0;
    const startRow = Number(note.dataset.gridRow) || 0;
    let dragging = false;
    let nextCol = startCol;
    let nextRow = startRow;

    handle.setPointerCapture?.(e.pointerId);
    const onMove = ev=>{
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx,dy) < 2) return;
      dragging = true;
      note.classList.add('is-dragging');
      window.getSelection()?.removeAllRanges();
      ev.preventDefault();
      nextCol = Math.max(0,startCol + Math.round(dx / step));
      nextRow = Math.max(0,startRow + Math.round(dy / step));
      note.style.setProperty('--grid-col',nextCol);
      note.style.setProperty('--grid-row',nextRow);
    };
    const onUp = ()=>{
      document.removeEventListener('pointermove',onMove);
      document.removeEventListener('pointerup',onUp);
      document.removeEventListener('pointercancel',onUp);
      note.classList.remove('is-dragging');
      if (!dragging) return;
      note.dataset.gridCol = String(nextCol);
      note.dataset.gridRow = String(nextRow);
      const entry = gridPageEntries().find(x=>x.id===note.dataset.entryId);
      if (entry) {
        entry.layout = 'grid';
        entry.grid = {col:nextCol,row:nextRow};
        save();
      }
      setTimeout(()=>sizeGridCanvasToContent($('#notebookDock')),0);
    };
    document.addEventListener('pointermove',onMove,{passive:false});
    document.addEventListener('pointerup',onUp,{once:true});
    document.addEventListener('pointercancel',onUp,{once:true});
  });

  handle.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    selectGridNote(note,canvas);
  });
  handle.addEventListener('dblclick',e=>{
    e.preventDefault();
    e.stopPropagation();
  });
}

/* Replace the fixed-28px Grid binding with the same behavior using the current paper rhythm. */
bindGridNotebook = function(root,canvas) {
  canvas.addEventListener('dblclick',e=>{
    if (e.target.closest('.grid-note') || e.target.closest('.grid-editor-wrap') || e.target.closest('.grid-history-rail')) return;
    const rect = canvas.getBoundingClientRect();
    const workspaceLeft = gridWorkspaceLeft(canvas);
    const step = notebookPaperRhythm();
    const x = e.clientX - rect.left - workspaceLeft;
    if (x < 0) return;
    const col = Math.max(0,Math.floor(x / step));
    const row = Math.max(0,Math.floor((e.clientY - rect.top) / step));
    openGridEditor(root,canvas,{col,row});
  });

  canvas.addEventListener('click',e=>{
    if (e.target.closest('.grid-note') || e.target.closest('.grid-editor-wrap') || e.target.closest('.grid-history-rail')) return;
    clearGridNoteSelection(canvas);
  });

  $$('.grid-note',canvas).forEach(note=>{
    note.ondblclick = e=>{
      e.preventDefault();
      e.stopPropagation();
      const entry = gridPageEntries().find(x=>x.id===note.dataset.entryId);
      if (!entry) return;
      openGridEditor(root,canvas,{
        col:Number(note.dataset.gridCol)||0,
        row:Number(note.dataset.gridRow)||0
      },entry);
    };
    bindSavedGridTextSelection(note);
    bindScaledGridNoteDrag(note,canvas);
  });

  $$('.grid-history-entry',canvas).forEach(row=>bindSavedGridTextSelection(row));
};

/* The elastic Grid canvas should grow by scaled squares, not the original fixed 28px. */
sizeGridCanvasToContent = function(root) {
  if (notebookPaperView() !== 'grid') return;
  const canvas = $('.grid-notebook-canvas',root);
  const page = $('.notebook-page',root);
  if (!canvas || !page) return;
  requestAnimationFrame(()=>{
    const visibleWidth = Math.max(280,page.clientWidth - 42);
    let right = 0;
    $$('.grid-note,.grid-editor-wrap',canvas).forEach(el=>{
      right = Math.max(right,el.offsetLeft + Math.max(el.offsetWidth,el.scrollWidth || 0));
    });
    const step = notebookPaperRhythm();
    const needed = Math.max(visibleWidth,right ? right + step * 2 : 0);
    canvas.style.width = `${Math.ceil(needed / step) * step}px`;
  });
};

/* The legacy editor still calculates hidden textarea rows at 28px. The visible rich editor is
   CSS-driven, but keep the hidden backing editor aligned too so its measurements stay sane. */
const _salesShopFontOpenGridEditor = openGridEditor;
openGridEditor = function(root,canvas,placement,existingEntry=null) {
  _salesShopFontOpenGridEditor(root,canvas,placement,existingEntry);
  if (!activeGridEditor) return;
  const step = notebookPaperRhythm();
  const source = activeGridEditor.legacyTextarea || activeGridEditor.textarea;
  if (source?.tagName === 'TEXTAREA') {
    const resize = ()=>{
      source.style.height = `${step}px`;
      const rows = Math.max(1,Math.ceil(source.scrollHeight / step));
      source.style.height = `${rows * step}px`;
    };
    source.addEventListener('input',resize);
    resize();
  }
};

const _salesShopFontRenderNotebook = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopFontRenderNotebook(root);
  if (!root) return;
  applyNotebookFontScale(root);
  installNotebookFontControl(root);
  sizeGridCanvasToContent(root);
};
