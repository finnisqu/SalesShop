/* Spatial Grid notebook experiment.
   Grid entries remain ordinary notebook entries with optional {grid:{col,row}} placement metadata. */

const NOTEBOOK_GRID_SIZE = 28;
let activeGridEditor = null;

function gridPageEntries() {
  const pageId = ensureNotebookPage(currentNotebookDate);
  return notebookEntriesForPage(currentNotebookDate,pageId);
}

function estimatedGridPlacement(entry,index,cursor) {
  if (entry.grid && Number.isFinite(entry.grid.col) && Number.isFinite(entry.grid.row)) {
    return {col:entry.grid.col,row:entry.grid.row};
  }
  const lineCount = Math.max(1,String(entry.text || '').split('\n').length);
  const placement = {col:0,row:cursor.row};
  cursor.row += lineCount + 1;
  return placement;
}

function renderGridNotebook(root) {
  if (notebookPaperView() !== 'grid') return;
  const body = $('.notebook-page-body',root);
  if (!body) return;

  body.classList.add('grid-spatial-active');
  const entries = gridPageEntries();
  const cursor = {row:0};
  const draft = notebookBufferedDraft();

  const canvas = document.createElement('div');
  canvas.className = 'grid-notebook-canvas';
  canvas.dataset.gridCanvas = '';

  entries.forEach((entry,index)=>{
    const placement = estimatedGridPlacement(entry,index,cursor);
    const note = document.createElement('div');
    note.className = `grid-note ${entry.grid ? 'grid-note-placed' : 'grid-note-auto'}`;
    note.dataset.entryId = entry.id;
    note.dataset.gridCol = placement.col;
    note.dataset.gridRow = placement.row;
    note.style.setProperty('--grid-col',placement.col);
    note.style.setProperty('--grid-row',placement.row);
    if (entry.cue) note.insertAdjacentHTML('beforeend',`<span class="grid-note-cue">${escapeHtml(entry.cue)}</span>`);
    note.insertAdjacentHTML('beforeend',`<span class="grid-note-text">${escapeHtml(entry.text || entry.attachment?.name || '')}</span>`);
    canvas.appendChild(note);
  });

  if (draft.text || draft.cue) {
    const hint = document.createElement('div');
    hint.className = 'grid-unplaced-draft';
    hint.textContent = 'Unplaced draft · click a square';
    canvas.appendChild(hint);
  }

  body.appendChild(canvas);
  bindGridNotebook(root,canvas);
}

function bindGridNotebook(root,canvas) {
  canvas.addEventListener('click',e=>{
    if (e.target.closest('.grid-note') || e.target.closest('.grid-editor-wrap')) return;
    const rect = canvas.getBoundingClientRect();
    const col = Math.max(0,Math.floor((e.clientX - rect.left) / NOTEBOOK_GRID_SIZE));
    const row = Math.max(0,Math.floor((e.clientY - rect.top) / NOTEBOOK_GRID_SIZE));
    openGridEditor(root,canvas,{col,row});
  });

  $$('.grid-note',canvas).forEach(note=>{
    note.ondblclick = e=>{
      e.preventDefault();
      const entry = gridPageEntries().find(x=>x.id===note.dataset.entryId);
      if (!entry) return;
      openGridEditor(root,canvas,{
        col:Number(note.dataset.gridCol)||0,
        row:Number(note.dataset.gridRow)||0
      },entry);
    };
    const text = $('.grid-note-text',note);
    if (text) {
      text.onmouseup = e => handleSelection(e,note.dataset.entryId);
      text.oncontextmenu = e => { e.preventDefault(); handleSelection(e,note.dataset.entryId,true); };
    }
  });
}

function closeGridEditor({rerender=false}={}) {
  if (!activeGridEditor) return;
  const {wrap} = activeGridEditor;
  activeGridEditor = null;
  wrap?.remove();
  if (rerender) renderAll();
}

function openGridEditor(root,canvas,placement,existingEntry=null) {
  closeGridEditor();

  let entry = existingEntry;
  let seededCue = entry?.cue || '';
  let seededText = entry?.text || '';

  if (!entry) {
    const draft = notebookBufferedDraft();
    if (draft.text || draft.cue) {
      seededText = draft.text;
      seededCue = draft.cue;
      entry = appendNotebookEntry(seededText,'typed',currentNotebookDate,currentNotebookPageId,{
        ...(seededCue ? {cue:seededCue} : {}),
        layout:'grid',
        grid:{...placement}
      });
      clearNotebookBufferedDraft();
      save();
      $('.grid-unplaced-draft',canvas)?.remove();
    }
  }

  const wrap = document.createElement('div');
  wrap.className = 'grid-editor-wrap';
  wrap.style.setProperty('--grid-col',placement.col);
  wrap.style.setProperty('--grid-row',placement.row);
  if (seededCue) wrap.insertAdjacentHTML('beforeend',`<span class="grid-editor-cue">${escapeHtml(seededCue)}</span>`);

  const textarea = document.createElement('textarea');
  textarea.className = 'grid-editor';
  textarea.placeholder = 'Type here…';
  textarea.value = seededText;
  wrap.appendChild(textarea);
  canvas.appendChild(wrap);
  activeGridEditor = {wrap,textarea,entry,placement};

  const resize = ()=>{
    textarea.style.height = '28px';
    const rows = Math.max(1,Math.ceil(textarea.scrollHeight / NOTEBOOK_GRID_SIZE));
    textarea.style.height = `${rows * NOTEBOOK_GRID_SIZE}px`;
  };

  const persist = ()=>{
    const text = textarea.value;
    if (!entry && !text.trim()) return;
    if (!entry) {
      entry = appendNotebookEntry(text,'typed',currentNotebookDate,currentNotebookPageId,{
        layout:'grid',
        grid:{...placement}
      });
      activeGridEditor.entry = entry;
    } else {
      entry.text = text;
      entry.layout = 'grid';
      entry.grid = {...placement};
    }
    save();
  };

  textarea.addEventListener('input',()=>{
    resize();
    persist();
  });
  textarea.addEventListener('keydown',e=>{
    if (e.key==='Escape') {
      e.preventDefault();
      closeGridEditor({rerender:true});
      return;
    }
    if (e.key==='Enter' && e.shiftKey) {
      e.preventDefault();
      persist();
      closeGridEditor({rerender:true});
    }
  });
  textarea.addEventListener('blur',()=>{
    setTimeout(()=>{
      if (!activeGridEditor || activeGridEditor.textarea !== textarea) return;
      persist();
      closeGridEditor({rerender:true});
    },80);
  });

  resize();
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length,textarea.value.length);
}

function renderNonCornellDraftCue(root) {
  if (notebookPaperView()==='cornell' || notebookPaperView()==='grid') return;
  const draft = notebookBufferedDraft();
  if (!draft.cue) return;
  const zone = $('.notebook-writing-zone',root);
  if (!zone || $('.draft-cue-tag',zone)) return;
  const tag = document.createElement('div');
  tag.className = 'draft-cue-tag';
  tag.textContent = draft.cue;
  zone.insertBefore(tag,zone.firstChild);
}

const _salesShopRenderNotebookWithViews = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopRenderNotebookWithViews(root);
  if (!root) return;
  renderNonCornellDraftCue(root);
  renderGridNotebook(root);
};
