/* Notebook structural QC: grouped History, persistent blank-page ordering, lined-paper object fixes,
   and final presentation-control stabilization hooks. Loaded after all notebook interaction layers. */

const notebookHistoryExpandedDates = new Set();

function notebookPageOrderMap() {
  state.settings ||= {};
  state.settings.notebookPageOrderByDate ||= {};
  return state.settings.notebookPageOrderByDate;
}

function notebookPageIdsFromEntries(key) {
  const seen = new Set();
  const ids = [];
  (state.notebook?.[key] || []).forEach(entry=>{
    const id = entry?.pageId;
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  return ids;
}

function ensureNotebookPageOrderRegistry({persist=true}={}) {
  state.settings ||= {};
  const orderMap = notebookPageOrderMap();
  const activeByDate = notebookPageState();
  const keys = [...new Set([
    dateKey(),
    ...Object.keys(state.notebook || {}),
    ...Object.keys(activeByDate || {}),
    ...Object.keys(orderMap || {})
  ])];
  let changed = false;

  keys.forEach(key=>{
    const existing = Array.isArray(orderMap[key]) ? orderMap[key].filter(Boolean) : [];
    const entryIds = notebookPageIdsFromEntries(key);
    const active = activeByDate[key] || null;
    const next = [];
    const seen = new Set();
    [...existing,...entryIds,...(active?[active]:[])].forEach(id=>{
      if (!id || seen.has(id)) return;
      seen.add(id);
      next.push(id);
    });
    if (!next.length) {
      const id = active || uid('page');
      next.push(id);
      activeByDate[key] = id;
    }
    if (JSON.stringify(existing)!==JSON.stringify(next)) {
      orderMap[key] = next;
      changed = true;
    }
  });

  if (changed && persist) save();
  return orderMap;
}

function notebookPageOrderForDate(key) {
  ensureNotebookPageOrderRegistry({persist:false});
  const map = notebookPageOrderMap();
  map[key] ||= [];
  return map[key];
}

function notebookPageStorageKey(key,pageId) {
  return `${key}::${pageId}`;
}

function notebookPageDraftFor(key,pageId) {
  const drafts = state.settings?.notebookDrafts || {};
  const exact = drafts[notebookPageStorageKey(key,pageId)];
  if (exact) return exact;
  const match = Object.entries(drafts).find(([storageKey])=>storageKey.includes(key) && storageKey.includes(pageId));
  return match?.[1] || null;
}

function notebookDraftHasContent(draft) {
  if (!draft) return false;
  return !!String(draft.text || '').trim() || !!String(draft.cue || '').trim() || !!String(draft.richHtml || '').replace(/<[^>]+>/g,'').trim();
}

function notebookPageIsTrulyBlank(key,pageId) {
  const entries = notebookEntriesForPage(key,pageId);
  if (entries.length) return false;
  if (typeof notebookPageHeader === 'function' && notebookPageHeader(key,pageId).trim()) return false;
  if (notebookDraftHasContent(notebookPageDraftFor(key,pageId))) return false;
  const spatial = state.settings?.notebookSpatialObjectsByPage?.[notebookPageStorageKey(key,pageId)] || [];
  if (spatial.length) return false;
  return true;
}

function notebookPagePreviewForHistory(key,pageId) {
  const header = typeof notebookPageHeader === 'function' ? notebookPageHeader(key,pageId).trim() : '';
  if (header) return header;
  const entries = notebookEntriesForPage(key,pageId);
  if (typeof notebookHistoryPreview === 'function') {
    const preview = notebookHistoryPreview(entries);
    if (preview) return preview;
  }
  const first = entries.find(entry=>String(entry?.text || entry?.attachment?.name || '').trim());
  return String(first?.text || first?.attachment?.name || '').trim() || 'Blank page';
}

function notebookHistoryDateLabel(key) {
  return key===dateKey() ? 'Today' : fmtDate(key,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}

function groupedNotebookHistoryData() {
  ensureNotebookPageOrderRegistry();
  const activeByDate = notebookPageState();
  const orderMap = notebookPageOrderMap();
  const keys = [...new Set([
    dateKey(),
    ...Object.keys(state.notebook || {}),
    ...Object.keys(activeByDate || {}),
    ...Object.keys(orderMap || {})
  ])].sort().reverse();

  return keys.map(key=>{
    const pages = notebookPageOrderForDate(key).map((pageId,index)=>{
      const entries = notebookEntriesForPage(key,pageId);
      return {
        key,
        pageId,
        pageNumber:index+1,
        count:entries.length,
        preview:notebookPagePreviewForHistory(key,pageId),
        blank:notebookPageIsTrulyBlank(key,pageId),
        active:activeByDate[key]===pageId,
        selected:key===currentNotebookDate && pageId===currentNotebookPageId,
        lastAt:entries.at(-1)?.createdAt || ''
      };
    });
    return {key,label:notebookHistoryDateLabel(key),pages};
  }).filter(group=>group.pages.length);
}

function deleteBlankNotebookPage(key,pageId) {
  ensureNotebookPageOrderRegistry({persist:false});
  const order = notebookPageOrderForDate(key);
  if (order.length<=1) return toast('Keep at least one notebook page for this date.');
  if (!notebookPageIsTrulyBlank(key,pageId)) return toast('Only a blank page can be deleted here.');

  notebookPushUndoCheckpoint?.();
  const index = order.indexOf(pageId);
  if (index<0) return;
  const replacement = order[index-1] || order[index+1] || null;
  order.splice(index,1);

  if (state.notebook?.[key]) state.notebook[key] = state.notebook[key].filter(entry=>entry.pageId!==pageId);
  const storageKey = notebookPageStorageKey(key,pageId);
  delete state.settings?.notebookSpatialObjectsByPage?.[storageKey];
  delete state.settings?.notebookPageHeaders?.[storageKey];
  const drafts = state.settings?.notebookDrafts || {};
  Object.keys(drafts).forEach(draftKey=>{
    if (draftKey===storageKey || (draftKey.includes(key) && draftKey.includes(pageId))) delete drafts[draftKey];
  });

  const activeByDate = notebookPageState();
  if (activeByDate[key]===pageId) activeByDate[key] = replacement;
  if (currentNotebookDate===key && currentNotebookPageId===pageId) currentNotebookPageId = replacement;
  if (typeof unlockedNotebookHistoryPages !== 'undefined') unlockedNotebookHistoryPages.delete?.(storageKey);

  save();
  closeModal?.();
  renderAll();
  setTimeout(()=>openNotebookHistory(),0);
  toast('Blank page deleted');
}

/* Keep blank pages as first-class page identities instead of losing them when they have no entries. */
if (typeof startFreshNotebookPage === 'function' && !window.__salesShopPageOrderRegistry) {
  window.__salesShopPageOrderRegistry = true;
  const _structuralFreshPage = startFreshNotebookPage;
  startFreshNotebookPage = function(root) {
    const beforeDate = currentNotebookDate;
    const beforePage = currentNotebookPageId || ensureNotebookPage(beforeDate);
    ensureNotebookPageOrderRegistry({persist:false});
    const beforeOrder = notebookPageOrderForDate(beforeDate);
    if (beforePage && !beforeOrder.includes(beforePage)) beforeOrder.push(beforePage);

    const result = _structuralFreshPage(root);
    const afterOrder = notebookPageOrderForDate(currentNotebookDate);
    if (currentNotebookPageId && !afterOrder.includes(currentNotebookPageId)) afterOrder.push(currentNotebookPageId);
    save();
    return result;
  };
}

/* History is date-first. Dates expand to their page/note list; truly blank pages get a quiet X. */
openNotebookHistory = function() {
  const groups = groupedNotebookHistoryData();
  if (!notebookHistoryExpandedDates.size) notebookHistoryExpandedDates.add(currentNotebookDate || dateKey());
  if (groups.some(group=>group.key===currentNotebookDate)) notebookHistoryExpandedDates.add(currentNotebookDate);

  openModal('Notebook','History',`
    <div class="notebook-history-grouped">
      ${groups.map(group=>{
        const open = notebookHistoryExpandedDates.has(group.key);
        return `<section class="notebook-history-date-group${open?' open':''}" data-history-date-group="${group.key}">
          <button type="button" class="notebook-history-date-toggle" data-history-date-toggle="${group.key}" aria-expanded="${open?'true':'false'}">
            <span class="notebook-history-date-chevron" aria-hidden="true">›</span>
            <span>${escapeHtml(group.label)}</span>
            <span class="notebook-history-date-count">${group.pages.length}</span>
          </button>
          <div class="notebook-history-date-pages" ${open?'':'hidden'}>
            ${group.pages.map(page=>{
              const canDelete = page.blank && group.pages.length>1;
              const meta = `${page.active?'Current · ':''}Page ${page.pageNumber}${page.count?` · ${page.count} item${page.count===1?'':'s'}`:''}`;
              return `<div class="notebook-history-page-item${page.selected?' active':''}${page.blank?' blank-page':''}">
                <button type="button" class="notebook-history-page-open" data-history-date="${page.key}" data-history-page="${page.pageId}">
                  <span class="notebook-history-page-meta">${escapeHtml(meta)}</span>
                  <span class="notebook-history-page-preview">${escapeHtml(page.preview)}</span>
                </button>
                ${canDelete?`<button type="button" class="notebook-history-page-delete" data-history-delete-date="${page.key}" data-history-delete-page="${page.pageId}" title="Delete blank page" aria-label="Delete blank page">×</button>`:''}
              </div>`;
            }).join('')}
          </div>
        </section>`;
      }).join('')}
    </div>`);

  $$('[data-history-date-toggle]').forEach(button=>button.onclick=()=>{
    const key = button.dataset.historyDateToggle;
    const group = button.closest('[data-history-date-group]');
    const pages = $('.notebook-history-date-pages',group);
    const opening = !notebookHistoryExpandedDates.has(key);
    if (opening) notebookHistoryExpandedDates.add(key);
    else notebookHistoryExpandedDates.delete(key);
    group?.classList.toggle('open',opening);
    if (pages) pages.hidden = !opening;
    button.setAttribute('aria-expanded',String(opening));
  });

  $$('[data-history-page]').forEach(button=>button.onclick=()=>{
    currentNotebookDate = button.dataset.historyDate;
    currentNotebookPageId = button.dataset.historyPage;
    closeModal();
    renderAll();
  });

  $$('[data-history-delete-page]').forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    deleteBlankNotebookPage(button.dataset.historyDeleteDate,button.dataset.historyDeletePage);
  });
};

/* Include the page registry in notebook Undo/Redo now that blank pages are meaningful state. */
if (typeof notebookHistorySnapshot === 'function' && !window.__salesShopPageOrderUndo) {
  window.__salesShopPageOrderUndo = true;
  const _structuralHistorySnapshot = notebookHistorySnapshot;
  notebookHistorySnapshot = function() {
    const parsed = JSON.parse(_structuralHistorySnapshot());
    parsed.notebookPageOrderByDate = state.settings?.notebookPageOrderByDate || {};
    return JSON.stringify(parsed);
  };
  const _structuralHistoryRestore = restoreNotebookHistorySnapshot;
  restoreNotebookHistorySnapshot = function(snapshot) {
    try {
      const parsed = JSON.parse(snapshot);
      state.settings ||= {};
      state.settings.notebookPageOrderByDate = parsed.notebookPageOrderByDate || {};
    } catch {}
    return _structuralHistoryRestore(snapshot);
  };
}

/* Lined paper: clicking a floating object is never a request to reposition the writing draft. */
if (typeof pageStateClickCanWrite === 'function' && !window.__salesShopLinedObjectClickGuard) {
  window.__salesShopLinedObjectClickGuard = true;
  const _structuralClickCanWrite = pageStateClickCanWrite;
  pageStateClickCanWrite = function(target) {
    if (target?.closest?.('.notebook-spatial-object,.notebook-page-object-layer')) return false;
    return _structuralClickCanWrite(target);
  };
}

/* If a lined page has only floating objects and no writing yet, its first text row is still row 0.
   A click far down the sheet should focus that first row instead of moving the entire writing flow. */
if (typeof pageStateStartDraftAt === 'function' && !window.__salesShopLinedFirstRowGuard) {
  window.__salesShopLinedFirstRowGuard = true;
  const _structuralStartDraftAt = pageStateStartDraftAt;
  pageStateStartDraftAt = function(root,row,column) {
    const style = notebookPaperView?.();
    if (style==='lines' || style==='cornell') {
      const entries = typeof pageStateEntries==='function' ? pageStateEntries() : [];
      const draft = typeof notebookBufferedDraft==='function' ? notebookBufferedDraft() : null;
      const hasWrittenContent = entries.length>0 || notebookDraftHasContent(draft);
      const hasFloatingObjects = typeof spatialObjects==='function' && spatialObjects().length>0;
      if (!hasWrittenContent && hasFloatingObjects) row = 0;
    }
    return _structuralStartDraftAt(root,row,column);
  };
}

function stabilizeNotebookPresentationControl(root=$('#notebookDock')) {
  if (!root) return;
  const control = $('[data-notebook-width-controls]',root);
  if (!control) return;
  control.classList.add('notebook-position-control','notebook-position-geometry-fixed');
  if (typeof stableNotebookPositionOrder==='function') stableNotebookPositionOrder(root);
}

const _structuralNotebookRender = renderNotebookSurface;
renderNotebookSurface = function(root) {
  ensureNotebookPageOrderRegistry({persist:false});
  _structuralNotebookRender(root);
  if (!root) return;
  stabilizeNotebookPresentationControl(root);
};
