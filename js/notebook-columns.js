/* Optional two-column Blank / Lines presentation.
   Two-column mode is a page layout, not a second notebook. Entries may carry an optional
   notebookColumn ('left' / 'right'); legacy/unassigned content naturally starts on the left. */

function notebookColumnMode() {
  return state.settings?.notebookColumnMode === 'two' ? 'two' : 'one';
}

function notebookColumnsEligible() {
  const style = notebookPaperView();
  return (style === 'blank' || style === 'lines') && notebookWidthMode() !== 'float';
}

function notebookColumnPageKey(key=currentNotebookDate,pageId=currentNotebookPageId) {
  return `${key || dateKey()}::${pageId || ensureNotebookPage(key || dateKey())}`;
}

function notebookActiveColumns() {
  state.settings ||= {};
  state.settings.notebookActiveColumnByPage ||= {};
  return state.settings.notebookActiveColumnByPage;
}

function notebookActiveColumn(key=currentNotebookDate,pageId=currentNotebookPageId) {
  const value = notebookActiveColumns()[notebookColumnPageKey(key,pageId)];
  return value === 'right' ? 'right' : 'left';
}

function setNotebookActiveColumn(column,{persist=true}={}) {
  const next = column === 'right' ? 'right' : 'left';
  notebookActiveColumns()[notebookColumnPageKey()] = next;
  const draft = notebookBufferedDraft();
  draft.notebookColumn = next;
  persistentNotebookDrafts()[notebookDraftKey()] = {...draft};
  if (persist) save();
  return next;
}

function notebookColumnGlyph(kind='two') {
  return `<span class="notebook-column-page-icon ${kind === 'two' ? 'two' : 'one'}" aria-hidden="true"></span>`;
}

function installNotebookColumnStyleToggles(root) {
  const menu = $('[data-notebook-view-menu]',root);
  if (!menu) return;

  ['blank','lines'].forEach(style=>{
    const row = $(`[data-paper-view="${style}"]`,menu);
    if (!row) return;
    $('.notebook-style-column-controls',row)?.remove();

    const controls = document.createElement('span');
    controls.className = 'notebook-style-column-controls';
    controls.dataset.styleColumns = style;
    controls.innerHTML = `
      <span class="notebook-style-column-choice" role="button" tabindex="0" data-style-column-choice="one" title="Single column" aria-label="Single column for ${style} notebook">${notebookColumnGlyph('one')}</span>
      <span class="notebook-style-column-choice" role="button" tabindex="0" data-style-column-choice="two" title="Two columns" aria-label="Two columns for ${style} notebook">${notebookColumnGlyph('two')}</span>`;
    row.appendChild(controls);

    $$('[data-style-column-choice]',controls).forEach(choice=>{
      const activate = e=>{
        e.preventDefault();
        e.stopPropagation();
        captureNotebookDraftBuffer(root);
        state.settings ||= {};
        state.settings.notebookPaperView = style;
        state.settings.notebookColumnMode = choice.dataset.styleColumnChoice === 'two' ? 'two' : 'one';
        save();
        renderAll();
      };
      choice.addEventListener('click',activate);
      choice.addEventListener('keydown',e=>{
        if (e.key === 'Enter' || e.key === ' ') activate(e);
      });
    });
  });

  updateNotebookColumnStyleToggles(root);
}

function updateNotebookColumnStyleToggles(root) {
  const mode = notebookColumnMode();
  const style = notebookPaperView();
  $$('[data-style-columns]',root).forEach(group=>{
    const groupStyle = group.dataset.styleColumns;
    $$('[data-style-column-choice]',group).forEach(choice=>{
      const active = style === groupStyle && mode === choice.dataset.styleColumnChoice && notebookWidthMode() !== 'float';
      choice.classList.toggle('active',active);
      choice.setAttribute('aria-pressed',String(active));
    });
  });
}

/* Anything created while two-column mode is active inherits the currently active side.
   This includes typed chunks, voice memos and attachments, so page objects stay where the user was working. */
const _salesShopColumnAppendNotebookEntry = appendNotebookEntry;
appendNotebookEntry = function(text,source='typed',key=dateKey(),pageId=null,extra={}) {
  const samePage = key === currentNotebookDate && (!pageId || pageId === currentNotebookPageId);
  const shouldTag = samePage && notebookColumnsEligible() && notebookColumnMode() === 'two' && !extra.notebookColumn;
  const nextExtra = shouldTag ? {...extra,notebookColumn:notebookActiveColumn(key,pageId || currentNotebookPageId)} : extra;
  return _salesShopColumnAppendNotebookEntry(text,source,key,pageId,nextExtra);
};

function clearNotebookColumnLayout(root) {
  const body = $('.notebook-page-body',root);
  const source = $('[data-notebook-entries]',root);
  const writing = $('.notebook-writing-zone',root);
  const layout = $('[data-notebook-column-layout]',root);
  if (!body || !layout) return;

  const entries = $$('.notebook-entry',layout);
  entries.forEach(entry=>source?.appendChild(entry));
  if (writing && writing.parentElement !== body) body.appendChild(writing);
  layout.remove();
  source?.classList.remove('notebook-column-source');
}

function currentColumnDraftData(root) {
  captureNotebookDraftBuffer(root);
  const draft = notebookBufferedDraft();
  return {
    draft,
    text:String(draft.text || ''),
    cue:String(draft.cue || ''),
    richHtml:draft.richHtml || ''
  };
}

/* Switching columns should never drag an existing live paragraph across the page.
   Quietly turn the current draft into a normal, still-editable entry, then open a fresh draft on the other side. */
function preserveColumnDraftBeforeSwitch(root) {
  const {draft,text,cue,richHtml} = currentColumnDraftData(root);
  if (!text.trim() && !cue.trim()) return false;

  const column = draft.notebookColumn === 'right' ? 'right' : notebookActiveColumn();
  _salesShopColumnAppendNotebookEntry(text,'typed',currentNotebookDate,currentNotebookPageId,{
    ...(cue.trim()?{cue:cue.trim()}:{}),
    ...(richHtml?{richHtml}:{}),
    notebookColumn:column
  });
  clearNotebookBufferedDraft();
  save();
  return true;
}

function columnClickIsWritingIntent(target,column) {
  if (!target?.closest) return false;
  if (target.closest('button,a,input,textarea,select,[contenteditable="true"]')) return false;
  if (target.closest('.notebook-entry,.notebook-attachment,.voice-memo-card,.selection-popover,.rich-selection-popover')) return false;
  if (window.getSelection()?.toString().trim()) return false;
  return !!target.closest(`[data-notebook-column="${column}"]`);
}

function focusActiveColumnDraft(root,column) {
  const writing = $('.notebook-writing-zone',root);
  const targetColumn = $(`[data-notebook-column="${column}"]`,root);
  if (writing && targetColumn && writing.parentElement !== targetColumn) targetColumn.appendChild(writing);
  const editor = $('[data-rich-draft-editor]',root) || $('[data-notebook-input]',root);
  requestAnimationFrame(()=>{
    placeCaretAtRichEnd(editor);
    ensureNotebookTargetVisible?.(root,writing || editor);
  });
}

function bindNotebookColumnWriting(root) {
  $$('[data-notebook-column]',root).forEach(columnEl=>{
    if (columnEl.dataset.columnWritingBound) return;
    columnEl.dataset.columnWritingBound = '1';
    const column = columnEl.dataset.notebookColumn;
    columnEl.addEventListener('click',e=>{
      if (!columnClickIsWritingIntent(e.target,column)) return;
      e.preventDefault();
      e.stopPropagation();

      const current = notebookActiveColumn();
      if (column !== current) preserveColumnDraftBeforeSwitch(root);
      setNotebookActiveColumn(column,{persist:true});

      if (column !== current) {
        renderAll();
        requestAnimationFrame(()=>focusActiveColumnDraft($('#notebookDock'),column));
      } else {
        focusActiveColumnDraft(root,column);
      }
    });
  });
}

function applyNotebookColumnLayout(root) {
  const shell = $('.notebook-shell',root);
  const body = $('.notebook-page-body',root);
  const source = $('[data-notebook-entries]',root);
  const writing = $('.notebook-writing-zone',root);
  if (!shell || !body || !source || !writing) return;

  clearNotebookColumnLayout(root);
  const active = notebookColumnsEligible() && notebookColumnMode() === 'two';
  shell.classList.toggle('notebook-columns-two',active);
  shell.classList.toggle('notebook-columns-one',!active);
  updateNotebookColumnStyleToggles(root);
  if (!active) return;

  const entryById = new Map(notebookEntriesForPage(currentNotebookDate,currentNotebookPageId).map(entry=>[entry.id,entry]));
  const entries = $$('.notebook-entry',source);
  const layout = document.createElement('div');
  layout.className = 'notebook-two-column-layout';
  layout.dataset.notebookColumnLayout = '';

  const left = document.createElement('div');
  left.className = 'notebook-page-column notebook-page-column-left';
  left.dataset.notebookColumn = 'left';
  const right = document.createElement('div');
  right.className = 'notebook-page-column notebook-page-column-right';
  right.dataset.notebookColumn = 'right';
  layout.append(left,right);

  /* Legacy entries have no column metadata; keep them predictably on the left rather than
     redistributing them based on window size or entry count. */
  entries.forEach(entryEl=>{
    const data = entryById.get(entryEl.dataset.entryId);
    (data?.notebookColumn === 'right' ? right : left).appendChild(entryEl);
  });

  const activeColumn = notebookActiveColumn();
  const draft = notebookBufferedDraft();
  if (draft.notebookColumn !== activeColumn) {
    draft.notebookColumn = activeColumn;
    persistentNotebookDrafts()[notebookDraftKey()] = {...draft};
  }
  (activeColumn === 'right' ? right : left).appendChild(writing);

  source.classList.add('notebook-column-source');
  source.insertAdjacentElement('afterend',layout);
  bindNotebookColumnWriting(root);
}

/* Width changes can happen without a global render. Float temporarily forces one-column,
   while the saved preference returns automatically when the sheet is redocked. */
const _salesShopColumnApplyWidth = applyNotebookWidthMode;
applyNotebookWidthMode = function(root) {
  _salesShopColumnApplyWidth(root);
  if (!root) return;
  applyNotebookColumnLayout(root);
  updateNotebookColumnStyleToggles(root);
};

const _salesShopColumnRenderNotebook = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopColumnRenderNotebook(root);
  if (!root) return;
  installNotebookColumnStyleToggles(root);
  applyNotebookColumnLayout(root);
};
