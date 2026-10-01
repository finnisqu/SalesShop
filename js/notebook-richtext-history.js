/* Saved notebook history interaction polish.
   Makes selection reliable, adds Cue semantics, and allows saved entries to be edited inline. */

let activeSavedNotebookEditor = null;
let savedSelectionTimer = null;

/* H1 is visual formatting. Cue is semantic Cornell structure. */
richToolbarHtml = function({actions=true}={}) {
  return `
    <button type="button" class="rich-tool rich-tool-text" data-rich-command="bold" title="Bold"><strong>B</strong></button>
    <button type="button" class="rich-tool rich-tool-text" data-rich-command="italic" title="Italic"><em>I</em></button>
    <button type="button" class="rich-tool rich-tool-text" data-rich-command="underline" title="Underline"><u>U</u></button>
    <span class="rich-tool-separator"></span>
    <button type="button" class="rich-tool rich-tool-heading" data-rich-command="h1" title="Header">H1</button>
    <button type="button" class="rich-tool rich-tool-cue" data-rich-cue title="Move selected text to Cornell cue">Cue</button>
    <span class="rich-tool-separator"></span>
    <button type="button" class="rich-tool rich-highlight rich-highlight-yellow" data-rich-highlight="yellow" title="Yellow highlight" aria-label="Yellow highlight"><span></span></button>
    <button type="button" class="rich-tool rich-highlight rich-highlight-mint" data-rich-highlight="mint" title="Green highlight" aria-label="Green highlight"><span></span></button>
    <button type="button" class="rich-tool rich-highlight rich-highlight-rose" data-rich-highlight="rose" title="Rose highlight" aria-label="Rose highlight"><span></span></button>
    ${actions ? '<span class="rich-tool-separator"></span><button type="button" class="rich-tool rich-tool-action" data-rich-promote>Promote</button><button type="button" class="rich-tool rich-tool-action" data-rich-link>Link</button>' : ''}
  `;
};

function notebookRootForRichContext(ctx) {
  return ctx?.root?.closest?.('.notebook-shell') || $('#notebookDock');
}

function deleteRichSelection(ctx) {
  if (!ctx?.range || !ctx?.root) return;
  try {
    ctx.range.deleteContents();
    ctx.root.normalize?.();
  } catch {}
}

function applyCueFromRichContext(ctx) {
  const cue = String(ctx?.text || '').trim();
  if (!cue || !ctx?.root) return;

  /* Saved entry: cue belongs to the entry; selected body text is removed. */
  if (ctx.entryId) {
    const entry = notebookEntryById(ctx.entryId);
    if (!entry) return;
    deleteRichSelection(ctx);
    entry.cue = cue;
    const cleanRoot = stripCueFromRichRoot(ctx.root);
    entry.text = richPlainTextFromNode(cleanRoot);
    entry.richHtml = sanitizeRichHtml(cleanRoot.innerHTML);
    save();
    removeSelectionPopover();
    renderAll();
    return;
  }

  /* Live grid editor may not have created its backing entry yet. */
  if (ctx.root.matches?.('.grid-rich-editor')) {
    deleteRichSelection(ctx);
    ctx.persist?.();
    let entry = activeGridEditor?.entry;
    if (!entry) {
      entry = appendNotebookEntry(richPlainTextFromNode(ctx.root),'typed',currentNotebookDate,currentNotebookPageId,{
        cue,
        richHtml:sanitizeRichHtml(ctx.root.innerHTML),
        layout:'grid',
        grid:{...(activeGridEditor?.placement || {col:0,row:0})}
      });
      if (activeGridEditor) activeGridEditor.entry = entry;
    } else {
      entry.cue = cue;
      entry.text = richPlainTextFromNode(ctx.root);
      entry.richHtml = sanitizeRichHtml(ctx.root.innerHTML);
    }
    save();
    renderAll();
    return;
  }

  /* Live normal/Cornell draft. */
  deleteRichSelection(ctx);
  const shell = notebookRootForRichContext(ctx);
  const draft = notebookBufferedDraft();
  draft.cue = cue;
  draft.text = richPlainTextFromNode(ctx.root);
  draft.richHtml = sanitizeRichHtml(ctx.root.innerHTML);
  persistentNotebookDrafts()[notebookDraftKey()] = {...draft};
  save();
  renderAll();
  setTimeout(()=>document.querySelector('[data-rich-draft-editor]')?.focus(),0);
}

const _salesShopBindRichToolbarHistory = bindRichToolbar;
bindRichToolbar = function(toolbar,getContext) {
  _salesShopBindRichToolbarHistory(toolbar,getContext);
  const cueButton = $('[data-rich-cue]',toolbar);
  if (!cueButton) return;
  cueButton.addEventListener('mousedown',e=>e.preventDefault());
  cueButton.addEventListener('click',()=>applyCueFromRichContext(getContext()));
};

function savedRichTargetFromSelection(selection=window.getSelection()) {
  if (!selection?.rangeCount || selection.isCollapsed) return null;
  const startNode = selection.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode?.parentElement;
  const endNode = selection.focusNode?.nodeType === Node.ELEMENT_NODE ? selection.focusNode : selection.focusNode?.parentElement;
  const startTarget = startNode?.closest?.('.entry-text,.grid-note-text,.grid-history-text');
  const endTarget = endNode?.closest?.('.entry-text,.grid-note-text,.grid-history-text');
  if (!startTarget || startTarget !== endTarget) return null;
  return startTarget;
}

function showSavedRichSelectionPopover(force=false) {
  clearTimeout(savedSelectionTimer);
  savedSelectionTimer = setTimeout(()=>{
    const selection = window.getSelection();
    const target = savedRichTargetFromSelection(selection);
    const text = selection?.toString().trim();
    if (!target || !text || !selection.rangeCount) {
      if (!force) removeSelectionPopover();
      return;
    }

    const entryRow = target.closest('[data-entry-id]');
    const entryId = entryRow?.dataset.entryId;
    if (!entryId) return;

    removeSelectionPopover();
    const range = selection.getRangeAt(0).cloneRange();
    richSavedSelection = {
      range,
      root:target,
      entryId,
      text,
      persist:()=>persistSavedRichSelection(richSavedSelection)
    };
    selectedNotebookText = text;
    selectedNotebookEntryId = entryId;

    const selectionRect = range.getBoundingClientRect();
    const fallbackRect = target.getBoundingClientRect();
    const rect = selectionRect.width || selectionRect.height ? selectionRect : fallbackRect;
    const pop = document.createElement('div');
    pop.id = 'selectionPopover';
    pop.className = 'selection-popover rich-selection-popover notebook-paper-popover';
    pop.innerHTML = richToolbarHtml();
    document.body.appendChild(pop);
    const popWidth = Math.min(pop.offsetWidth || 420, window.innerWidth - 16);
    pop.style.left = `${Math.max(8,Math.min(window.innerWidth-popWidth-8,rect.left))}px`;
    pop.style.top = `${Math.max(8,rect.top-(pop.offsetHeight || 32)-6)}px`;
    bindRichToolbar(pop,()=>richSavedSelection);
  }, force ? 0 : 18);
}

/* Existing mouseup handlers still call handleSelection; route them through the reliable path. */
handleSelection = function(e,entryId,force=false) {
  showSavedRichSelectionPopover(force);
};

/* Triple-click and keyboard selection can finish without a useful mouseup target. */
if (!window.__salesShopSavedSelectionWatcher) {
  window.__salesShopSavedSelectionWatcher = true;
  document.addEventListener('selectionchange',()=>{
    const target = savedRichTargetFromSelection();
    if (target) showSavedRichSelectionPopover(false);
  });
  document.addEventListener('pointerup',()=>{
    if (savedRichTargetFromSelection()) showSavedRichSelectionPopover(false);
  },true);
}

function finishSavedNotebookEdit({cancel=false}={}) {
  const active = activeSavedNotebookEditor;
  if (!active) return;
  const {target,entry,originalText,originalHtml} = active;
  activeSavedNotebookEditor = null;

  target.removeAttribute('contenteditable');
  target.classList.remove('saved-note-editing');
  const cue = $('.entry-cue-inline',target);
  cue?.removeAttribute('contenteditable');

  if (cancel) {
    entry.text = originalText;
    entry.richHtml = originalHtml;
  } else {
    const clean = stripCueFromRichRoot(target);
    entry.text = richPlainTextFromNode(clean);
    entry.richHtml = sanitizeRichHtml(clean.innerHTML);
  }
  save();
  renderAll();
}

function beginSavedNotebookEdit(target) {
  const row = target?.closest?.('[data-entry-id]');
  const entry = notebookEntryById(row?.dataset.entryId);
  if (!target || !entry) return;

  if (activeSavedNotebookEditor?.target === target) return;
  if (activeSavedNotebookEditor) finishSavedNotebookEdit();

  activeSavedNotebookEditor = {
    target,
    entry,
    originalText:entry.text,
    originalHtml:entry.richHtml || ''
  };

  target.setAttribute('contenteditable','true');
  target.classList.add('saved-note-editing');
  $('.entry-cue-inline',target)?.setAttribute('contenteditable','false');
  target.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(target);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  const sync = ()=>{
    if (activeSavedNotebookEditor?.target !== target) return;
    const clean = stripCueFromRichRoot(target);
    entry.text = richPlainTextFromNode(clean);
    entry.richHtml = sanitizeRichHtml(clean.innerHTML);
    save();
  };

  target.oninput = sync;
  target.onkeydown = e=>{
    if (e.key === 'Escape') {
      e.preventDefault();
      finishSavedNotebookEdit({cancel:true});
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      finishSavedNotebookEdit();
    }
  };
  target.onblur = ()=>{
    setTimeout(()=>{
      if (activeSavedNotebookEditor?.target !== target) return;
      if ($('#selectionPopover')?.contains(document.activeElement)) return;
      finishSavedNotebookEdit();
    },160);
  };
}

function bindSavedNotebookEditors(root) {
  if (!root) return;
  $$('.entry-text,.grid-history-text,.grid-note-text',root).forEach(target=>{
    if (target.dataset.savedEditBound) return;
    target.dataset.savedEditBound='1';
    target.addEventListener('dblclick',e=>{
      if (window.getSelection()?.toString().trim()) return;
      e.preventDefault();
      e.stopPropagation();
      beginSavedNotebookEdit(target);
    });
  });
}

const _salesShopRenderNotebookSavedHistory = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopRenderNotebookSavedHistory(root);
  if (!root) return;
  bindSavedNotebookEditors(root);
};
