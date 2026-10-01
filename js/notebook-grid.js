/* Spatial Grid notebook experiment.
   Grid entries remain ordinary notebook entries with optional {grid:{col,row}} placement metadata. */

const NOTEBOOK_GRID_SIZE = 28;
let activeGridEditor = null;
let activeGridSelectionText = '';

function gridPageEntries() {
  const pageId = ensureNotebookPage(currentNotebookDate);
  return notebookEntriesForPage(currentNotebookDate,pageId);
}

function gridWorkspaceLeft(canvas) {
  const value = parseFloat(getComputedStyle(canvas).getPropertyValue('--grid-workspace-left'));
  return Number.isFinite(value) ? value : 252;
}

function renderGridHistoryEntry(entry) {
  const row = document.createElement('div');
  row.className = 'grid-history-entry';
  row.dataset.entryId = entry.id;
  if (entry.cue) row.insertAdjacentHTML('beforeend',`<span class="grid-history-cue">${escapeHtml(entry.cue)}</span>`);
  row.insertAdjacentHTML('beforeend',`<span class="grid-history-text">${escapeHtml(entry.text || entry.attachment?.name || '')}</span>`);
  return row;
}

function renderGridNotebook(root) {
  if (notebookPaperView() !== 'grid') return;
  const body = $('.notebook-page-body',root);
  if (!body) return;

  body.classList.add('grid-spatial-active');
  const entries = gridPageEntries();
  const draft = notebookBufferedDraft();

  const canvas = document.createElement('div');
  canvas.className = 'grid-notebook-canvas';
  canvas.dataset.gridCanvas = '';

  const historyRail = document.createElement('div');
  historyRail.className = 'grid-history-rail';
  historyRail.dataset.gridHistory = '';

  entries.filter(entry=>!entry.grid).forEach(entry=>{
    historyRail.appendChild(renderGridHistoryEntry(entry));
  });
  canvas.appendChild(historyRail);

  entries.filter(entry=>entry.grid).forEach(entry=>{
    const placement = {col:Number(entry.grid.col)||0,row:Number(entry.grid.row)||0};
    const note = document.createElement('div');
    note.className = 'grid-note grid-note-placed';
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
    hint.textContent = 'Unplaced draft · double-click a square';
    canvas.appendChild(hint);
  }

  body.appendChild(canvas);
  bindGridNotebook(root,canvas);
}

function bindGridNotebook(root,canvas) {
  /* Single click is intentionally passive. Double-click means “write here.” */
  canvas.addEventListener('dblclick',e=>{
    if (e.target.closest('.grid-note') || e.target.closest('.grid-editor-wrap') || e.target.closest('.grid-history-rail')) return;
    const rect = canvas.getBoundingClientRect();
    const workspaceLeft = gridWorkspaceLeft(canvas);
    const x = e.clientX - rect.left - workspaceLeft;
    if (x < 0) return;
    const col = Math.max(0,Math.floor(x / NOTEBOOK_GRID_SIZE));
    const row = Math.max(0,Math.floor((e.clientY - rect.top) / NOTEBOOK_GRID_SIZE));
    openGridEditor(root,canvas,{col,row});
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
  });

  $$('.grid-history-entry',canvas).forEach(row=>bindSavedGridTextSelection(row));
}

function bindSavedGridTextSelection(container) {
  const text = $('.grid-note-text',container) || $('.grid-history-text',container);
  if (!text) return;
  text.onmouseup = e => handleSelection(e,container.dataset.entryId);
  text.oncontextmenu = e => {
    const selection = window.getSelection()?.toString().trim();
    if (!selection) return;
    e.preventDefault();
    handleSelection(e,container.dataset.entryId,true);
  };
}

function closeGridEditor({rerender=false}={}) {
  if (!activeGridEditor) return;
  const {wrap} = activeGridEditor;
  activeGridEditor = null;
  activeGridSelectionText = '';
  wrap?.remove();
  if (rerender) renderAll();
}

function updateGridEditorSelectionTools(editorState,force=false) {
  const {textarea,tools} = editorState;
  if (!textarea || !tools) return;
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  activeGridSelectionText = start !== end ? textarea.value.slice(start,end).trim() : '';
  tools.classList.toggle('visible',!!activeGridSelectionText);
  if (force && activeGridSelectionText) tools.classList.add('visible');
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

  const tools = document.createElement('div');
  tools.className = 'grid-editor-selection-tools';
  tools.innerHTML = '<button type="button" data-grid-promote>Promote</button><button type="button" data-grid-link>Link</button>';
  wrap.appendChild(tools);

  const textarea = document.createElement('textarea');
  textarea.className = 'grid-editor';
  textarea.placeholder = 'Type here…';
  textarea.value = seededText;
  wrap.appendChild(textarea);
  canvas.appendChild(wrap);
  activeGridEditor = {wrap,textarea,tools,entry,placement};

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

  const openSelectedAction = type=>{
    updateGridEditorSelectionTools(activeGridEditor,true);
    if (!activeGridSelectionText) return;
    persist();
    const entryId = entry?.id || null;
    if (type==='promote') openPromoteModal(activeGridSelectionText,entryId);
    else openLinkModal(activeGridSelectionText,entryId);
  };

  $('[data-grid-promote]',tools).addEventListener('mousedown',e=>e.preventDefault());
  $('[data-grid-link]',tools).addEventListener('mousedown',e=>e.preventDefault());
  $('[data-grid-promote]',tools).onclick=()=>openSelectedAction('promote');
  $('[data-grid-link]',tools).onclick=()=>openSelectedAction('link');

  textarea.addEventListener('input',()=>{
    resize();
    persist();
    updateGridEditorSelectionTools(activeGridEditor);
  });
  ['select','mouseup','keyup'].forEach(eventName=>textarea.addEventListener(eventName,()=>{
    updateGridEditorSelectionTools(activeGridEditor);
  }));
  textarea.addEventListener('contextmenu',e=>{
    updateGridEditorSelectionTools(activeGridEditor,true);
    if (!activeGridSelectionText) return;
    e.preventDefault();
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
    },100);
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
