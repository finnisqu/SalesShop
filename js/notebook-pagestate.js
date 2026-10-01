/* Notebook page-state layer.
   The current sheet is a set of editable objects with lightweight placement metadata.
   Normal paper uses paperRow (+ optional notebookColumn); Grid uses grid {col,row}.
   Changing styles reinterprets the same objects instead of copying them. */

function pageStateEntries() {
  const pageId = ensureNotebookPage(currentNotebookDate);
  return notebookEntriesForPage(currentNotebookDate,pageId);
}

function pageStateEntrySpan(entry) {
  const lines = Math.max(1,String(entry?.text || entry?.attachment?.name || '').split('\n').length);
  return Math.max(1,lines + (entry?.cue ? 1 : 0) + (entry?.voiceMemo ? 1 : 0) + (entry?.attachment ? 1 : 0));
}

function pageStateEnsureDraftId(draft=notebookBufferedDraft()) {
  if (!draft.draftId) draft.draftId = uid('draft');
  persistentNotebookDrafts()[notebookDraftKey()] = {...draft};
  return draft.draftId;
}

function pageStateSyncDraft(root) {
  const rich = $('[data-rich-draft-editor]',root);
  if (rich && typeof syncRichDraft === 'function') syncRichDraft(root,rich);
  else if (typeof captureNotebookDraftBuffer === 'function') captureNotebookDraftBuffer(root);
  const draft = notebookBufferedDraft();
  pageStateEnsureDraftId(draft);
  return draft;
}

function pageStateHasDraft(draft=notebookBufferedDraft()) {
  return !!String(draft?.text || '').trim() || !!String(draft?.cue || '').trim();
}

function pageStateColumn(entryOrDraft={}) {
  return entryOrDraft.notebookColumn === 'right' ? 'right' : 'left';
}

function pageStateNextPaperRow(column='left') {
  let next = 0;
  pageStateEntries().forEach(entry=>{
    if (pageStateColumn(entry) !== column) return;
    const row = Number.isFinite(Number(entry.paperRow)) ? Math.max(0,Number(entry.paperRow)) : 0;
    next = Math.max(next,row + pageStateEntrySpan(entry) + 1);
  });
  return next;
}

function ensureCurrentPaperPlacements() {
  const next = {left:0,right:0};
  let changed = false;
  pageStateEntries().forEach(entry=>{
    const column = pageStateColumn(entry);
    if (!Number.isFinite(Number(entry.paperRow))) {
      const gridRow = Number.isFinite(Number(entry.grid?.row)) ? Math.max(0,Number(entry.grid.row)) : null;
      entry.paperRow = gridRow == null ? next[column] : Math.max(next[column],gridRow);
      changed = true;
    }
    next[column] = Math.max(next[column],Number(entry.paperRow) + pageStateEntrySpan(entry) + 1);
  });
  if (changed) save();
}

/* Anything added while working on normal paper inherits the active paper row. */
const _salesShopPageStateAppend = appendNotebookEntry;
appendNotebookEntry = function(text,source='typed',key=dateKey(),pageId=null,extra={}) {
  const samePage = key === currentNotebookDate && (!pageId || pageId === currentNotebookPageId);
  const style = typeof notebookPaperView === 'function' ? notebookPaperView() : 'blank';
  if (samePage && style !== 'grid' && !Number.isFinite(Number(extra.paperRow))) {
    const draft = notebookBufferedDraft();
    const column = extra.notebookColumn === 'right' ? 'right' : pageStateColumn(draft);
    const row = Number.isFinite(Number(draft.paperRow)) ? Math.max(0,Number(draft.paperRow)) : pageStateNextPaperRow(column);
    extra = {...extra,paperRow:row,notebookColumn:extra.notebookColumn || column};
  }
  return _salesShopPageStateAppend(text,source,key,pageId,extra);
};

function pageStateMaterializeDraft(root) {
  const draft = pageStateSyncDraft(root);
  if (!pageStateHasDraft(draft)) return null;
  const draftId = pageStateEnsureDraftId(draft);

  /* A previously materialized draft may survive in an older buffer after a style change.
     Reuse that object rather than producing a second copy. */
  const already = pageStateEntries().find(entry=>entry.originDraftId === draftId);
  if (already) {
    clearNotebookBufferedDraft();
    save();
    return already;
  }

  const column = pageStateColumn(draft);
  const row = Number.isFinite(Number(draft.paperRow)) ? Math.max(0,Number(draft.paperRow)) : pageStateNextPaperRow(column);
  const entry = _salesShopPageStateAppend(String(draft.text || '').trimEnd(),'typed',currentNotebookDate,currentNotebookPageId,{
    ...(String(draft.cue || '').trim()?{cue:String(draft.cue).trim()}:{}),
    ...(draft.richHtml?{richHtml:sanitizeRichHtml(draft.richHtml)}:{}),
    notebookColumn:column,
    paperRow:row,
    originDraftId:draftId
  });
  clearNotebookBufferedDraft();
  save();
  return entry;
}

/* Every existing page object gets a Grid position before Grid renders. Normal-paper rows are
   reused as the preferred row, so there is never a hidden 'unplaced previous text' waiting for
   the next double-click. */
ensureCurrentGridPlacements = function() {
  migrateGridToFullSheetOnce?.();
  const entries = pageStateEntries();
  const occupied = [];
  let changed = false;

  entries.filter(entry=>entry.grid).forEach(entry=>occupied.push({
    col:Math.max(0,Number(entry.grid.col)||0),
    row:Math.max(0,Number(entry.grid.row)||0),
    span:pageStateEntrySpan(entry)
  }));

  const collides = (col,row,span)=>occupied.some(item=>
    item.col === col && row < item.row + item.span + 1 && item.row < row + span + 1
  );
  let fallback = occupied.reduce((max,item)=>Math.max(max,item.row+item.span+1),0);

  entries.filter(entry=>!entry.grid).forEach(entry=>{
    const span = pageStateEntrySpan(entry);
    const col = pageStateColumn(entry) === 'right' ? 12 : 0;
    let row = Number.isFinite(Number(entry.paperRow)) ? Math.max(0,Number(entry.paperRow)) : fallback;
    while (collides(col,row,span)) row += 1;
    entry.layout = 'grid';
    entry.grid = {col,row};
    occupied.push({col,row,span});
    fallback = Math.max(fallback,row+span+1);
    changed = true;
  });
  if (changed) save();
};

const _salesShopPageStateRenderGrid = renderGridNotebook;
renderGridNotebook = function(root) {
  if (notebookPaperView() === 'grid') ensureCurrentGridPlacements();
  return _salesShopPageStateRenderGrid(root);
};

/* ---- Style switching -------------------------------------------------- */
function pageStateSwitchStyle(style,root) {
  if (!['blank','lines','grid','cornell'].includes(style)) return;
  pageStateSyncDraft(root);
  if (style === 'grid') {
    pageStateMaterializeDraft(root);
    ensureCurrentGridPlacements();
  } else {
    ensureCurrentPaperPlacements();
  }
  state.settings ||= {};
  state.settings.notebookPaperView = style;
  save();
  renderAll();
}

if (!window.__salesShopPageStateStyleSwitch) {
  window.__salesShopPageStateStyleSwitch = true;
  document.addEventListener('click',event=>{
    if (event.target?.closest?.('[data-style-column-choice],[data-style-grid-choice]')) return;
    const option = event.target?.closest?.('[data-paper-view]');
    if (!option?.closest?.('.notebook-view-menu')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pageStateSwitchStyle(option.dataset.paperView,$('#notebookDock'));
  },true);
}

/* ---- Normal-paper row placement ------------------------------------- */
function pageStatePointerRow(root,event) {
  const body = $('.notebook-page-body',root);
  if (!body) return 0;
  const rect = body.getBoundingClientRect();
  const step = notebookPaperRhythm?.() || 28;
  return Math.max(0,Math.floor((event.clientY - rect.top) / step));
}

function pageStatePointerColumn(root,event) {
  if (!(notebookColumnsEligible?.() && notebookColumnMode?.() === 'two')) return 'left';
  const body = $('.notebook-page-body',root);
  const rect = body?.getBoundingClientRect();
  return rect && event.clientX >= rect.left + rect.width/2 ? 'right' : 'left';
}

function pageStateClickCanWrite(target) {
  if (!target?.closest) return false;
  if (target.closest('button,a,input,textarea,select,[contenteditable="true"]')) return false;
  if (target.closest('.notebook-entry,.notebook-attachment,.voice-memo-chip,.selection-popover,.rich-selection-popover')) return false;
  if (target.closest('.grid-note,.grid-editor-wrap,.grid-grab-handle')) return false;
  if (window.getSelection()?.toString().trim()) return false;
  return true;
}

function pageStateStartDraftAt(root,row,column) {
  let draft = pageStateSyncDraft(root);
  const oldRow = Number.isFinite(Number(draft.paperRow)) ? Number(draft.paperRow) : null;
  const oldColumn = pageStateColumn(draft);

  if (pageStateHasDraft(draft) && (oldRow !== row || oldColumn !== column)) {
    pageStateMaterializeDraft(root);
    draft = notebookBufferedDraft();
    pageStateEnsureDraftId(draft);
  }

  draft.paperRow = row;
  draft.notebookColumn = column;
  persistentNotebookDrafts()[notebookDraftKey()] = {...draft};
  if (typeof setNotebookActiveColumn === 'function') setNotebookActiveColumn(column,{persist:false});
  save();
  renderAll();

  requestAnimationFrame(()=>{
    const fresh = $('#notebookDock');
    const editor = notebookPaperView()==='cornell'
      ? ($('[data-cornell-cue]',fresh) || $('[data-rich-draft-editor]',fresh))
      : ($('[data-rich-draft-editor]',fresh) || $('[data-notebook-input]',fresh));
    placeCaretAtRichEnd?.(editor);
    ensureNotebookTargetVisible?.(fresh,$('.notebook-writing-zone',fresh) || editor);
  });
}

function bindPageStateClickRows(root) {
  const page = $('.notebook-page',root);
  if (!page || page.dataset.pageStateRowsBound) return;
  page.dataset.pageStateRowsBound = '1';
  page.addEventListener('click',event=>{
    const style = notebookPaperView();
    if (style === 'grid' || !pageStateClickCanWrite(event.target)) return;
    if (typeof isCurrentNotebookPageEditable === 'function' && !isCurrentNotebookPageEditable()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pageStateStartDraftAt(root,pageStatePointerRow(root,event),pageStatePointerColumn(root,event));
  },true);
}

function pageStateItems(container,root,column=null) {
  const items = $$('.notebook-entry',container).map(el=>{
    const entry = notebookEntryById(el.dataset.entryId);
    return {el,row:Math.max(0,Number(entry?.paperRow)||0),span:pageStateEntrySpan(entry),type:'entry'};
  });
  const writing = $('.notebook-writing-zone',root);
  const draft = notebookBufferedDraft();
  if (writing && (!column || pageStateColumn(draft) === column)) {
    const row = Number.isFinite(Number(draft.paperRow)) ? Math.max(0,Number(draft.paperRow)) : pageStateNextPaperRow(pageStateColumn(draft));
    items.push({el:writing,row,span:Math.max(1,String(draft.text||'').split('\n').length),type:'draft'});
  }
  return items.sort((a,b)=>a.row-b.row || (a.type==='entry'?-1:1));
}

function pageStateFlow(container,items) {
  if (!container) return;
  const step = notebookPaperRhythm?.() || 28;
  let cursor = 0;
  items.forEach(item=>{
    container.appendChild(item.el);
    const gap = Math.max(0,item.row-cursor);
    item.el.style.marginTop = `${gap*step}px`;
    item.el.dataset.paperRow = String(item.row);
    cursor = Math.max(cursor,item.row+item.span);
  });
  container.style.minHeight = `${Math.max(520,(cursor+10)*step)}px`;
}

function applyPageStatePaperLayout(root) {
  const style = notebookPaperView();
  if (!['blank','lines','cornell'].includes(style)) return;
  ensureCurrentPaperPlacements();

  const two = notebookColumnsEligible?.() && notebookColumnMode?.() === 'two';
  if (two) {
    const left = $('[data-notebook-column="left"]',root);
    const right = $('[data-notebook-column="right"]',root);
    if (left && right) {
      const allRows = $$('[data-entry-id]',root);
      allRows.forEach(el=>{
        const entry = notebookEntryById(el.dataset.entryId);
        (pageStateColumn(entry)==='right'?right:left).appendChild(el);
      });
      pageStateFlow(left,pageStateItems(left,root,'left'));
      pageStateFlow(right,pageStateItems(right,root,'right'));
    }
    return;
  }

  const source = $('[data-notebook-entries]',root);
  const writing = $('.notebook-writing-zone',root);
  if (!source) return;
  if (writing && writing.parentElement !== source) source.appendChild(writing);
  source.classList.add('notebook-page-state-flow');
  pageStateFlow(source,pageStateItems(source,root));
}

/* One Enter = one visible line. The older rich handler inserts a raw newline text node;
   using the browser's line-break command gives the caret a real next visual row immediately. */
function bindSingleEnter(root) {
  const editor = $('[data-rich-draft-editor]',root);
  if (!editor || editor.dataset.singleEnterBound) return;
  editor.dataset.singleEnterBound='1';
  editor.addEventListener('keydown',event=>{
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try { document.execCommand('insertLineBreak',false,null); }
    catch { insertRichPlainText('\n'); }
    syncRichDraft(root,editor);
  },true);
}

/* New Page remains the meaningful page boundary. Materialize the live object with its row first. */
const _salesShopPageStateFreshPage = startFreshNotebookPage;
startFreshNotebookPage = function(root) {
  pageStateMaterializeDraft(root);
  return _salesShopPageStateFreshPage(root);
};

/* ---- Grid / Dots paper choice --------------------------------------- */
function notebookGridPaper() {
  return state.settings?.notebookGridPaper === 'dots' ? 'dots' : 'grid';
}

function pageStatePaperIcon(kind) {
  return `<span class="notebook-paper-choice-icon ${kind}" aria-hidden="true"></span>`;
}

function installGridPaperChoices(root) {
  const menu = $('[data-notebook-view-menu]',root);
  const row = $('[data-paper-view="grid"]',menu);
  if (!row) return;
  let group = $('[data-style-grid-controls]',row);
  if (!group) {
    group = document.createElement('span');
    group.className='notebook-style-grid-controls';
    group.dataset.styleGridControls='';
    group.innerHTML = `
      <span class="notebook-style-grid-choice" role="button" tabindex="0" data-style-grid-choice="grid" title="Grid paper" aria-label="Grid paper">${pageStatePaperIcon('grid')}</span>
      <span class="notebook-style-grid-choice" role="button" tabindex="0" data-style-grid-choice="dots" title="Dot paper" aria-label="Dot paper">${pageStatePaperIcon('dots')}</span>`;
    row.appendChild(group);
  }
  $$('[data-style-grid-choice]',group).forEach(choice=>{
    choice.classList.toggle('active',notebookPaperView()==='grid' && notebookGridPaper()===choice.dataset.styleGridChoice);
    const activate = event=>{
      event.preventDefault();
      event.stopPropagation();
      pageStateMaterializeDraft(root);
      state.settings ||= {};
      state.settings.notebookPaperView='grid';
      state.settings.notebookGridPaper=choice.dataset.styleGridChoice==='dots'?'dots':'grid';
      ensureCurrentGridPlacements();
      save();
      renderAll();
    };
    choice.onclick=activate;
    choice.onkeydown=event=>{ if(event.key==='Enter'||event.key===' ') activate(event); };
  });
}

function polishPageStateStyleMenu(root) {
  const menu = $('[data-notebook-view-menu]',root);
  if (!menu) return;
  const lined = $('[data-paper-view="lines"]',menu);
  if (lined) {
    [...lined.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>{
      if (node.nodeValue?.trim()==='Lines') node.nodeValue='Lined';
    });
  }
  installGridPaperChoices(root);
}

function applyGridPaper(root) {
  const page = $('.notebook-page',root);
  if (page) page.dataset.gridPaper = notebookGridPaper();
}

const _salesShopPageStateRender = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopPageStateRender(root);
  if (!root) return;
  polishPageStateStyleMenu(root);
  applyGridPaper(root);
  applyPageStatePaperLayout(root);
  bindPageStateClickRows(root);
  bindSingleEnter(root);
};
