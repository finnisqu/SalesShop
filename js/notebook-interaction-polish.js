/* Notebook interaction polish: compact object chrome, direct unlocked Grid text editing,
   visible transient messages, page headers, and mutually exclusive writing/object modes. */

let openGridTextToolbarEntryId = null;

function notebookPageHeaderMap() {
  state.settings ||= {};
  state.settings.notebookPageHeaders ||= {};
  return state.settings.notebookPageHeaders;
}

function notebookPageHeader(key=currentNotebookDate,pageId=currentNotebookPageId) {
  const resolvedKey = `${key || dateKey()}::${pageId || ensureNotebookPage(key || dateKey())}`;
  return String(notebookPageHeaderMap()[resolvedKey] || '');
}

function setNotebookPageHeader(value,key=currentNotebookDate,pageId=currentNotebookPageId) {
  const resolvedKey = `${key || dateKey()}::${pageId || ensureNotebookPage(key || dateKey())}`;
  const text = String(value || '').replace(/\n+/g,' ').trimStart();
  if (text) notebookPageHeaderMap()[resolvedKey] = text;
  else delete notebookPageHeaderMap()[resolvedKey];
  save();
}

function installNotebookPageHeader(root) {
  const head = $('.notebook-paper-head',root);
  if (!head) return;
  let editor = $('[data-notebook-page-header]',head);
  if (!editor) {
    editor = document.createElement('div');
    editor.className = 'notebook-page-header';
    editor.dataset.notebookPageHeader = '';
    editor.contentEditable = (typeof isCurrentNotebookPageEditable !== 'function' || isCurrentNotebookPageEditable()) ? 'true' : 'false';
    editor.spellcheck = true;
    editor.setAttribute('role','textbox');
    editor.setAttribute('aria-label','Page header');
    head.appendChild(editor);
  }
  const stored = notebookPageHeader();
  if (document.activeElement !== editor && editor.textContent !== stored) editor.textContent = stored;
  editor.addEventListener('input',()=>setNotebookPageHeader(editor.textContent || ''));
  editor.addEventListener('keydown',event=>{
    if (event.key === 'Enter') {
      event.preventDefault();
      editor.blur();
    }
  });
}

openNotebookHistory = function() {
  const rows = notebookHistoryRows();
  openModal('Notebook','History',`
    <div class="history-list notebook-page-history-list">
      ${rows.map(row=>{
        const pageEntries = notebookEntriesForPage(row.key,row.pageId);
        const header = notebookPageHeader(row.key,row.pageId).trim();
        const preview = header || notebookHistoryPreview(pageEntries);
        const selected = row.key===currentNotebookDate && row.pageId===currentNotebookPageId;
        return `<button class="history-row notebook-page-history-row ${selected?'active':''}" data-history-date="${row.key}" data-history-page="${row.pageId}">
          <span class="notebook-history-page-label">${row.key===dateKey()?'Today':fmtDate(row.key,{weekday:'short',month:'short',day:'numeric',year:'numeric'})} · Page ${row.pageNumber}${row.active?' · current':''}</span>
          <span class="notebook-history-preview${header?' notebook-history-header-preview':''}">${escapeHtml(preview)}</span>
        </button>`;
      }).join('')}
    </div>`);
  $$('[data-history-page]').forEach(btn=>btn.onclick=()=>{
    currentNotebookDate=btn.dataset.historyDate;
    currentNotebookPageId=btn.dataset.historyPage;
    closeModal();
    renderAll();
  });
};

if (typeof notebookHistorySnapshot === 'function' && !window.__salesShopPageHeaderUndo) {
  window.__salesShopPageHeaderUndo = true;
  const _pageHeaderSnapshot = notebookHistorySnapshot;
  notebookHistorySnapshot = function() {
    const parsed = JSON.parse(_pageHeaderSnapshot());
    parsed.notebookPageHeaders = state.settings?.notebookPageHeaders || {};
    return JSON.stringify(parsed);
  };
  const _pageHeaderRestore = restoreNotebookHistorySnapshot;
  restoreNotebookHistorySnapshot = function(snapshot) {
    try {
      const parsed = JSON.parse(snapshot);
      state.settings ||= {};
      state.settings.notebookPageHeaders = parsed.notebookPageHeaders || {};
    } catch {}
    return _pageHeaderRestore(snapshot);
  };
}

function closeActiveGridWritingMode() {
  if (typeof activeGridEditor === 'undefined' || !activeGridEditor) return;
  if (typeof closeGridEditor === 'function') closeGridEditor({rerender:false});
  else {
    try { activeGridEditor.wrap?.remove(); } catch {}
    activeGridEditor = null;
  }
}

function clearNotebookCellSelectionMode(root=$('#notebookDock')) {
  if (typeof activeSpatialSelection !== 'undefined') activeSpatialSelection = null;
  if (typeof activeSpatialTableSelection !== 'undefined') activeSpatialTableSelection = null;
  const canvas = root ? $('.grid-notebook-canvas',root) : null;
  if (canvas && typeof clearSpatialSelection === 'function') clearSpatialSelection(canvas);
  if (root) $$('.spatial-table-cell-selected',root).forEach(cell=>cell.classList.remove('spatial-table-cell-selected'));
}

function clearNotebookObjectMode(root=$('#notebookDock')) {
  openGridTextToolbarEntryId = null;
  if (!root) return;
  $$('.grid-note.is-selected,.grid-note.text-format-open',root).forEach(el=>{
    el.classList.remove('is-selected','text-format-open','text-hover-controls-visible');
  });
  $$('.notebook-spatial-object.is-selected,.notebook-spatial-object.format-open',root).forEach(el=>{
    el.classList.remove('is-selected','format-open','hover-controls-visible');
  });
  if (typeof selectedGridEntryId !== 'undefined') selectedGridEntryId = null;
  if (typeof selectedSpatialObjectId !== 'undefined') selectedSpatialObjectId = null;
  if (typeof openSpatialFormatObjectId !== 'undefined') openSpatialFormatObjectId = null;
  clearNotebookCellSelectionMode(root);
}

if (typeof openGridEditor === 'function' && !window.__salesShopExclusiveGridWritingMode) {
  window.__salesShopExclusiveGridWritingMode = true;
  const _exclusiveModeOpenGridEditor = openGridEditor;
  openGridEditor = function(root,canvas,placement,existingEntry=null) {
    clearNotebookObjectMode(root || $('#notebookDock'));
    return _exclusiveModeOpenGridEditor(root,canvas,placement,existingEntry);
  };
}

function gridTextObjectSelectedText(text,entry) {
  const selection = window.getSelection();
  if (selection?.rangeCount && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    if (text.contains(range.commonAncestorContainer)) {
      const selected = selection.toString().trim();
      if (selected) return selected;
    }
  }
  return String(entry?.text || text?.textContent || '').trim();
}

function gridTextObjectFormat(entry,text,command) {
  if (!entry || !text || !['bold','italic','underline'].includes(command)) return;
  if (typeof notebookTextIsSoftLocked === 'function' && notebookTextIsSoftLocked(entry)) return;
  if (typeof notebookPushUndoCheckpoint === 'function') notebookPushUndoCheckpoint();
  const selection = window.getSelection();
  let range = null;
  if (selection?.rangeCount) {
    const candidate = selection.getRangeAt(0);
    if (!candidate.collapsed && text.contains(candidate.commonAncestorContainer)) range = candidate.cloneRange();
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(text);
  }
  if (typeof applyRichFormat === 'function') applyRichFormat(range,text,command);
  entry.text = typeof richPlainTextFromNode === 'function' ? richPlainTextFromNode(text) : (text.textContent || '');
  entry.richHtml = typeof sanitizeRichHtml === 'function' ? sanitizeRichHtml(text.innerHTML) : '';
  if (typeof touchNotebookText === 'function') touchNotebookText(entry,{saveNow:false});
  save();
}

function gridTextObjectToolbar(note,entry,text) {
  const toolbar = document.createElement('div');
  toolbar.className = 'grid-text-object-toolbar';
  toolbar.dataset.gridTextToolbar = entry.id;
  toolbar.innerHTML = `
    <button type="button" data-grid-text-format="bold" title="Bold"><strong>B</strong></button>
    <button type="button" data-grid-text-format="italic" title="Italic"><em>I</em></button>
    <button type="button" data-grid-text-format="underline" title="Underline"><u>U</u></button>
    <span class="grid-text-toolbar-separator"></span>
    <button type="button" data-grid-text-promote>Promote</button>
    <button type="button" data-grid-text-link>Link</button>`;
  $$('button',toolbar).forEach(button=>button.addEventListener('mousedown',event=>event.preventDefault()));
  $$('[data-grid-text-format]',toolbar).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    gridTextObjectFormat(entry,text,button.dataset.gridTextFormat);
  });
  $('[data-grid-text-promote]',toolbar).onclick=event=>{
    event.preventDefault(); event.stopPropagation();
    const value = gridTextObjectSelectedText(text,entry);
    if (value) openPromoteModal(value,entry.id);
  };
  $('[data-grid-text-link]',toolbar).onclick=event=>{
    event.preventDefault(); event.stopPropagation();
    const value = gridTextObjectSelectedText(text,entry);
    if (value) openLinkModal(value,entry.id);
  };
  return toolbar;
}

function gridTextObjectFormatToggle(note,entry) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'grid-text-format-toggle';
  button.title = 'Text tools';
  button.setAttribute('aria-label','Open text tools');
  button.innerHTML = typeof spatialFormatGlyph === 'function'
    ? spatialFormatGlyph()
    : '<span class="spatial-format-glyph" aria-hidden="true"><i></i><i></i><i></i></span>';
  button.onclick = event=>{
    event.preventDefault(); event.stopPropagation();
    closeActiveGridWritingMode();
    clearNotebookCellSelectionMode($('#notebookDock'));
    const opening = !note.classList.contains('text-format-open');
    $$('.grid-note.text-format-open').forEach(el=>el.classList.remove('text-format-open'));
    note.classList.toggle('text-format-open',opening);
    note.classList.toggle('is-selected',opening || note.classList.contains('is-selected'));
    openGridTextToolbarEntryId = opening ? entry.id : null;
  };
  return button;
}

function gridTextObjectDeleteButton(entry) {
  const existing = document.createElement('button');
  existing.type = 'button';
  existing.className = 'grid-text-object-delete';
  existing.title = 'Delete text box';
  existing.setAttribute('aria-label','Delete text box');
  existing.textContent = '×';
  existing.onclick = event=>{
    event.preventDefault(); event.stopPropagation();
    if (typeof notebookTextIsSoftLocked === 'function' && notebookTextIsSoftLocked(entry)) return;
    if (typeof removeNotebookEntry === 'function') removeNotebookEntry(entry.id);
  };
  return existing;
}

function bindGridTextHoverChrome(note) {
  if (!note || note.dataset.textHoverChromeBound) return;
  note.dataset.textHoverChromeBound = '1';
  let timer = null;
  const show = ()=>{ clearTimeout(timer); note.classList.add('text-hover-controls-visible'); };
  const hide = ()=>{
    clearTimeout(timer);
    timer = setTimeout(()=>{
      if (note.matches(':hover') || note.classList.contains('text-format-open') || note.classList.contains('is-selected')) return;
      note.classList.remove('text-hover-controls-visible');
    },500);
  };
  note.addEventListener('pointerenter',show);
  note.addEventListener('pointerleave',hide);
  $$('.grid-text-format-toggle,.grid-text-object-delete,.grid-grab-handle,.grid-text-object-toolbar',note).forEach(el=>{
    el.addEventListener('pointerenter',show);
    el.addEventListener('pointerleave',hide);
  });
}

function bindDirectGridTextEditing(root) {
  if (!root) return;
  $$('.grid-note',root).forEach(note=>{
    const entryId = note.dataset.entryId;
    const entry = typeof notebookEntryById === 'function' ? notebookEntryById(entryId) : null;
    const text = $('.grid-note-text',note);
    if (!entry || !text) return;
    note.classList.add('grid-text-box-object');
    const editable = (typeof isCurrentNotebookPageEditable !== 'function' || isCurrentNotebookPageEditable()) &&
      !(typeof notebookTextIsSoftLocked === 'function' && notebookTextIsSoftLocked(entry));
    text.contentEditable = editable ? 'true' : 'false';
    text.spellcheck = true;
    text.classList.toggle('grid-note-text-direct-edit',editable);
    if (!$('.grid-text-format-toggle',note)) note.appendChild(gridTextObjectFormatToggle(note,entry));
    if (!$('.grid-text-object-toolbar',note)) note.appendChild(gridTextObjectToolbar(note,entry,text));
    const oldSoftDelete = $('.notebook-text-delete',note);
    if (oldSoftDelete) oldSoftDelete.style.display = 'none';
    if (editable && !$('.grid-text-object-delete',note)) note.appendChild(gridTextObjectDeleteButton(entry));
    if (openGridTextToolbarEntryId === entry.id) note.classList.add('text-format-open','is-selected');
    bindGridTextHoverChrome(note);
    if (!editable || text.dataset.directGridEditBound) return;
    text.dataset.directGridEditBound = '1';
    ['pointerdown','click','dblclick'].forEach(type=>text.addEventListener(type,event=>event.stopPropagation()));
    text.addEventListener('beforeinput',()=>{ if (typeof notebookBeginTypingCheckpoint === 'function') notebookBeginTypingCheckpoint(); });
    text.addEventListener('focus',()=>{
      closeActiveGridWritingMode();
      clearNotebookCellSelectionMode(root);
      note.classList.add('is-text-editing');
      note.classList.remove('is-selected');
    });
    text.addEventListener('blur',()=>note.classList.remove('is-text-editing'));
    text.addEventListener('input',()=>{
      entry.text = typeof richPlainTextFromNode === 'function' ? richPlainTextFromNode(text) : (text.textContent || '');
      entry.richHtml = typeof sanitizeRichHtml === 'function' ? sanitizeRichHtml(text.innerHTML) : '';
      if (typeof touchNotebookText === 'function') touchNotebookText(entry,{saveNow:false});
      save();
    });
  });
}

function syncSpatialChrome(root) {
  if (!root) return;
  $$('.notebook-spatial-object',root).forEach(wrap=>{
    const drag = $('.spatial-object-drag-handle',wrap);
    const del = $('.spatial-object-delete',wrap);
    if (drag) drag.title = 'Drag to move';
    if (del) { del.title = 'Delete'; del.setAttribute('aria-label','Delete object'); }
  });
}

if (!window.__salesShopExclusiveObjectMode) {
  window.__salesShopExclusiveObjectMode = true;
  document.addEventListener('pointerdown',event=>{
    const objectTarget = event.target?.closest?.('.notebook-spatial-object,.grid-note');
    if (!objectTarget || event.target.closest('.grid-editor-wrap')) return;
    closeActiveGridWritingMode();
    clearNotebookCellSelectionMode($('#notebookDock'));
    const root = $('#notebookDock');
    if (!root) return;
    if (objectTarget.classList.contains('notebook-spatial-object')) {
      openGridTextToolbarEntryId = null;
      $$('.grid-note.is-selected,.grid-note.text-format-open',root).forEach(el=>el.classList.remove('is-selected','text-format-open'));
      if (typeof selectedGridEntryId !== 'undefined') selectedGridEntryId = null;
    } else if (objectTarget.classList.contains('grid-note') && !event.target.closest('.grid-note-text')) {
      if (typeof selectedSpatialObjectId !== 'undefined') selectedSpatialObjectId = null;
      if (typeof openSpatialFormatObjectId !== 'undefined') openSpatialFormatObjectId = null;
      $$('.notebook-spatial-object.is-selected,.notebook-spatial-object.format-open',root).forEach(el=>el.classList.remove('is-selected','format-open'));
    }
  },true);
  document.addEventListener('pointerdown',event=>{
    if (event.target?.closest?.('.grid-note,.notebook-spatial-object')) return;
    openGridTextToolbarEntryId = null;
    $$('.grid-note.text-format-open').forEach(el=>el.classList.remove('text-format-open'));
  },true);
}

const _salesShopInteractionPolishRender = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopInteractionPolishRender(root);
  if (!root) return;
  installNotebookPageHeader(root);
  bindDirectGridTextEditing(root);
  syncSpatialChrome(root);
};
