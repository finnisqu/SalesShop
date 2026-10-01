/* Soft-lock settled notebook text without turning the current page into a form.
   Text remains readable/searchable; a tiny lock makes the state explicit and reversible. */

const NOTEBOOK_TEXT_SOFT_LOCK_MS = 5 * 60 * 1000;
let notebookSoftLockTimer = null;

function notebookEntryTextLockDeadline(entry) {
  if (!entry) return 0;
  const explicit = Number(entry.textLockAt);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const base = Date.parse(entry.lastTextEditAt || entry.createdAt || '') || Date.now();
  return base + NOTEBOOK_TEXT_SOFT_LOCK_MS;
}

function notebookTextIsSoftLocked(entry) {
  if (!entry || !String(entry.text || '').trim()) return false;
  if (typeof isCurrentNotebookPageEditable === 'function' && !isCurrentNotebookPageEditable()) return false;
  return Date.now() >= notebookEntryTextLockDeadline(entry);
}

function touchNotebookText(entry,{saveNow=true}={}) {
  if (!entry) return;
  const now = Date.now();
  entry.lastTextEditAt = new Date(now).toISOString();
  entry.textLockAt = now + NOTEBOOK_TEXT_SOFT_LOCK_MS;
  if (saveNow) save();
}

/* New text gets a fluid editing window before it settles. */
const _salesShopSoftLockAppendNotebookEntry = appendNotebookEntry;
appendNotebookEntry = function(text,source='typed',key=dateKey(),pageId=null,extra={}) {
  const entry = _salesShopSoftLockAppendNotebookEntry(text,source,key,pageId,extra);
  if (entry && String(entry.text || '').trim() && !Number.isFinite(Number(entry.textLockAt))) {
    touchNotebookText(entry,{saveNow:false});
  }
  return entry;
};

function notebookTextTargetForRow(row) {
  return $('.entry-text',row) || $('.grid-note-text',row) || $('.grid-history-text',row);
}

function notebookTextRowForEntry(root,entryId) {
  if (!root || !entryId) return null;
  const escaped = (window.CSS && CSS.escape) ? CSS.escape(entryId) : entryId;
  return root.querySelector(`[data-entry-id="${escaped}"]`);
}

function notebookSoftLockButton(entry) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'notebook-text-lock';
  btn.dataset.unlockNotebookText = entry.id;
  btn.title = 'Unlock text';
  btn.setAttribute('aria-label','Unlock text');
  btn.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    if (typeof isCurrentNotebookPageEditable === 'function' && !isCurrentNotebookPageEditable()) return;
    if (typeof notebookPushUndoCheckpoint === 'function') notebookPushUndoCheckpoint();
    touchNotebookText(entry);
    renderAll();
    requestAnimationFrame(()=>{
      const root = $('#notebookDock');
      const row = notebookTextRowForEntry(root,entry.id);
      const target = notebookTextTargetForRow(row);
      if (target && typeof beginSavedNotebookEdit === 'function') beginSavedNotebookEdit(target);
    });
  });
  return btn;
}

function notebookTextDeleteButton(entry) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'notebook-text-delete';
  btn.dataset.deleteNotebookText = entry.id;
  btn.title = 'Delete text block';
  btn.setAttribute('aria-label','Delete text block');
  btn.textContent = '×';
  btn.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    if (notebookTextIsSoftLocked(entry)) return;
    removeNotebookEntry?.(entry.id);
  });
  return btn;
}

function decorateNotebookTextLocks(root) {
  if (!root) return;
  const pageEditable = typeof isCurrentNotebookPageEditable !== 'function' || isCurrentNotebookPageEditable();
  const pageEntries = typeof gridPageEntries === 'function' ? gridPageEntries() : [];

  pageEntries.forEach(entry=>{
    if (!String(entry.text || '').trim()) return;
    const row = notebookTextRowForEntry(root,entry.id);
    const target = notebookTextTargetForRow(row);
    if (!row || !target) return;

    row.classList.add('notebook-text-object');
    const locked = pageEditable && notebookTextIsSoftLocked(entry);
    row.classList.toggle('notebook-text-softlocked',locked);
    row.classList.toggle('notebook-text-softunlocked',pageEditable && !locked);

    $('.notebook-text-lock',row)?.remove();
    $('.notebook-text-delete',row)?.remove();

    if (!pageEditable) return;
    if (locked) {
      row.appendChild(notebookSoftLockButton(entry));
      return;
    }

    /* Typed text blocks can be removed as whole page objects while unlocked.
       Voice/attachment rows keep their own existing object controls. */
    if (!entry.voiceMemo && !entry.attachment) row.appendChild(notebookTextDeleteButton(entry));
  });
}

/* A soft-locked block should not silently enter edit mode on double-click.
   Unlocking through the visible lock is the deliberate transition back to fluid editing. */
const _salesShopSoftLockBeginSavedNotebookEdit = beginSavedNotebookEdit;
beginSavedNotebookEdit = function(target) {
  const row = target?.closest?.('[data-entry-id]');
  const entry = notebookEntryById(row?.dataset.entryId);
  if (entry && notebookTextIsSoftLocked(entry)) {
    row?.classList.add('notebook-text-lock-nudge');
    setTimeout(()=>row?.classList.remove('notebook-text-lock-nudge'),220);
    return;
  }

  const result = _salesShopSoftLockBeginSavedNotebookEdit(target);
  if (entry && target) {
    touchNotebookText(entry);
    const keepFluid = ()=>touchNotebookText(entry);
    target.addEventListener('input',keepFluid);
  }
  return result;
};

function scheduleNotebookSoftLocks(root) {
  clearTimeout(notebookSoftLockTimer);
  notebookSoftLockTimer = null;
  if (!root || (typeof isCurrentNotebookPageEditable === 'function' && !isCurrentNotebookPageEditable())) return;

  const now = Date.now();
  let nearest = Infinity;
  (typeof gridPageEntries === 'function' ? gridPageEntries() : []).forEach(entry=>{
    if (!String(entry.text || '').trim() || notebookTextIsSoftLocked(entry)) return;
    /* Do not interrupt a block that is actively being edited. Its input events keep extending the deadline. */
    if (activeSavedNotebookEditor?.entry?.id === entry.id) return;
    nearest = Math.min(nearest,notebookEntryTextLockDeadline(entry));
  });

  if (Number.isFinite(nearest)) {
    notebookSoftLockTimer = setTimeout(()=>{
      if (activeSavedNotebookEditor) {
        scheduleNotebookSoftLocks($('#notebookDock'));
        return;
      }
      renderAll();
    },Math.max(120,nearest-now+40));
  }
}

const _salesShopSoftLockRenderNotebookSurface = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopSoftLockRenderNotebookSurface(root);
  if (!root) return;
  decorateNotebookTextLocks(root);
  scheduleNotebookSoftLocks(root);
};
