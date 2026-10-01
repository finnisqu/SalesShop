/* Notebook interaction polish: compact object chrome, direct unlocked Grid text editing,
   visible transient messages, and page headers used by History. */

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

/* History prefers the deliberate page header, then falls back to the existing content preview. */
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

/* Include page headers in the notebook undo snapshot without replacing the existing history stack. */
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

/* Unlocked Grid notes behave like text first. Their grab handle remains the object interaction. */
function bindDirectGridTextEditing(root) {
  if (!root) return;
  $$('.grid-note',root).forEach(note=>{
    const entryId = note.dataset.entryId;
    const entry = notebookEntryById?.(entryId);
    const text = $('.grid-note-text',note);
    if (!entry || !text || text.dataset.directGridEditBound) return;
    text.dataset.directGridEditBound = '1';

    const editable = (typeof isCurrentNotebookPageEditable !== 'function' || isCurrentNotebookPageEditable()) &&
      !(typeof notebookTextIsSoftLocked === 'function' && notebookTextIsSoftLocked(entry));
    text.contentEditable = editable ? 'true' : 'false';
    text.spellcheck = true;
    text.classList.toggle('grid-note-text-direct-edit',editable);

    if (!editable) return;

    /* Text interaction should not select the enclosing movable object. */
    text.addEventListener('pointerdown',event=>event.stopPropagation());
    text.addEventListener('click',event=>event.stopPropagation());
    text.addEventListener('beforeinput',()=>notebookBeginTypingCheckpoint?.());
    text.addEventListener('focus',()=>note.classList.add('is-text-editing'));
    text.addEventListener('blur',()=>note.classList.remove('is-text-editing'));
    text.addEventListener('input',()=>{
      entry.text = richPlainTextFromNode?.(text) ?? (text.textContent || '');
      entry.richHtml = '';
      touchNotebookText?.(entry,{saveNow:false});
      save();
    });
  });
}

/* Format toolbars should own the space above an object while open; Move must not show through. */
function syncSpatialChrome(root) {
  if (!root) return;
  $$('.notebook-spatial-object',root).forEach(wrap=>{
    const drag = $('.spatial-object-drag-handle',wrap);
    const del = $('.spatial-object-delete',wrap);
    if (drag) drag.title = 'Drag to move';
    if (del) {
      del.title = 'Delete';
      del.setAttribute('aria-label','Delete object');
    }
  });
}

const _salesShopInteractionPolishRender = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopInteractionPolishRender(root);
  if (!root) return;
  installNotebookPageHeader(root);
  bindDirectGridTextEditing(root);
  syncSpatialChrome(root);
};
