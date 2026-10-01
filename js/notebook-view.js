/* Notebook paper views + adaptive writing focus.
   Loaded after notebook.js so these enhancements can stay isolated while the prototype evolves. */

let notebookDraftBuffer = Object.create(null);

function notebookPaperView() {
  const allowed = new Set(['blank','lines','grid','cornell']);
  const current = state.settings.notebookPaperView || 'blank';
  return allowed.has(current) ? current : 'blank';
}

function notebookDraftKey(key=currentNotebookDate, pageId=currentNotebookPageId) {
  return `${key}::${pageId || 'page'}`;
}

function notebookBufferedDraft(key=currentNotebookDate, pageId=currentNotebookPageId) {
  const id = notebookDraftKey(key,pageId);
  notebookDraftBuffer[id] ||= {text:'', cue:''};
  return notebookDraftBuffer[id];
}

function clearNotebookBufferedDraft(key=currentNotebookDate, pageId=currentNotebookPageId) {
  delete notebookDraftBuffer[notebookDraftKey(key,pageId)];
}

function captureNotebookDraftBuffer(root) {
  if (!root) return;
  const draft = notebookBufferedDraft();
  const input = $('[data-notebook-input]', root);
  const cue = $('[data-cornell-cue]', root);
  if (input) draft.text = input.value;
  if (cue) draft.cue = cue.value;
}

function renderNotebookViewMenu(root) {
  const actions = $('.notebook-toolbar-actions', root);
  if (!actions || $('[data-notebook-view-wrap]', actions)) return;
  const view = notebookPaperView();
  const labels = {blank:'Blank',lines:'Lines',grid:'Grid',cornell:'Cornell'};
  actions.insertAdjacentHTML('afterbegin', `
    <div class="notebook-view-wrap" data-notebook-view-wrap>
      <button class="notebook-tool notebook-view-button" data-notebook-view-button>View ▾</button>
      <div class="notebook-view-menu" data-notebook-view-menu>
        ${Object.entries(labels).map(([key,label])=>`<button type="button" class="notebook-view-option ${view===key?'active':''}" data-paper-view="${key}"><span>${view===key?'✓':''}</span>${label}</button>`).join('')}
      </div>
    </div>`);

  const wrap = $('[data-notebook-view-wrap]', actions);
  const menu = $('[data-notebook-view-menu]', wrap);
  $('[data-notebook-view-button]', wrap).onclick = e => {
    e.stopPropagation();
    captureNotebookDraftBuffer(root);
    menu.classList.toggle('open');
  };
  $$('[data-paper-view]', wrap).forEach(btn=>btn.onclick=e=>{
    e.stopPropagation();
    captureNotebookDraftBuffer(root);
    state.settings.notebookPaperView = btn.dataset.paperView;
    save();
    renderAll();
  });
}

function applyNotebookPaperView(root) {
  const page = $('.notebook-page', root);
  const view = notebookPaperView();
  if (!page) return;
  page.classList.remove('paper-blank','paper-lines','paper-grid','paper-cornell');
  page.classList.add(`paper-${view}`);
  page.dataset.paperView = view;

  const pageId = ensureNotebookPage(currentNotebookDate);
  const entryMap = new Map(notebookEntriesForPage(currentNotebookDate,pageId).map(entry=>[entry.id,entry]));

  $$('.notebook-entry', root).forEach(row=>{
    const entry = entryMap.get(row.dataset.entryId);
    const text = $('.entry-text', row);
    if (!entry || !text) return;

    row.classList.toggle('cornell-entry', view === 'cornell');
    text.classList.toggle('cornell-entry-body', view === 'cornell');

    if (view === 'cornell') {
      if (!$('.cornell-entry-cue', row)) {
        const cue = document.createElement('div');
        cue.className = 'cornell-entry-cue';
        cue.textContent = entry.cue || '';
        row.insertBefore(cue,text);
      }
    } else if (entry.cue) {
      const cue = document.createElement('span');
      cue.className = 'entry-cue-inline';
      cue.textContent = `${entry.cue} — `;
      text.prepend(cue);
    }
  });

  const zone = $('.notebook-writing-zone', root);
  const input = $('[data-notebook-input]', root);
  if (view === 'cornell' && zone && input && !$('.cornell-draft-row', zone)) {
    const row = document.createElement('div');
    row.className = 'cornell-draft-row';
    const cue = document.createElement('input');
    cue.type = 'text';
    cue.className = 'cornell-cue-input';
    cue.dataset.cornellCue = '';
    cue.placeholder = 'Cue / heading';
    const body = document.createElement('div');
    body.className = 'cornell-draft-body';
    input.placeholder = 'Note / bullet…';
    zone.insertBefore(row,input);
    row.appendChild(cue);
    row.appendChild(body);
    body.appendChild(input);
  }
}

function restoreNotebookDraft(root) {
  const draft = notebookBufferedDraft();
  const input = $('[data-notebook-input]', root);
  const cue = $('[data-cornell-cue]', root);
  if (input && draft.text) input.value = draft.text;
  if (cue && draft.cue) cue.value = draft.cue;
}

function updateNotebookDraftFocus(root) {
  const input = $('[data-notebook-input]', root);
  const entries = $('[data-notebook-entries]', root);
  if (!input || !entries) return;

  input.style.height = 'auto';
  const baseDraftHeight = 110;
  const naturalHeight = Math.max(baseDraftHeight, input.scrollHeight);
  input.style.height = `${naturalHeight}px`;

  const extraDraft = Math.max(0, naturalHeight - baseDraftHeight);
  const historyMax = Math.max(0, 84 - extraDraft);
  entries.style.setProperty('--notebook-history-max', `${historyMax}px`);
  entries.classList.toggle('draft-hides-history', historyMax < 8);
  entries.classList.toggle('has-scrollback', entries.scrollHeight > historyMax + 2);
  if (historyMax > 0) entries.scrollTop = entries.scrollHeight;
}

function bindNotebookViewEnhancements(root) {
  renderNotebookViewMenu(root);
  const input = $('[data-notebook-input]', root);
  const cue = $('[data-cornell-cue]', root);

  const sync = ()=>{
    captureNotebookDraftBuffer(root);
    updateNotebookDraftFocus(root);
  };
  input?.addEventListener('input', sync);
  cue?.addEventListener('input', captureNotebookDraftBuffer.bind(null,root));
  cue?.addEventListener('keydown', e=>{
    if (e.key === 'Enter') {
      e.preventDefault();
      input?.focus();
    }
  });

  requestAnimationFrame(()=>{
    restoreNotebookDraft(root);
    updateNotebookDraftFocus(root);
  });
}

const _salesShopRenderNotebookSurface = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopRenderNotebookSurface(root);
  if (!root) return;
  applyNotebookPaperView(root);
  bindNotebookViewEnhancements(root);
};

const _salesShopSaveNotebookDraft = saveNotebookDraft;
saveNotebookDraft = function(root) {
  if (notebookPaperView() !== 'cornell') {
    clearNotebookBufferedDraft();
    return _salesShopSaveNotebookDraft(root);
  }

  const input = $('[data-notebook-input]', root);
  const cueInput = $('[data-cornell-cue]', root);
  const text = input?.value.trim() || '';
  const cue = cueInput?.value.trim() || '';
  if (!text && !cue) return;

  appendNotebookEntry(text,'typed',currentNotebookDate,currentNotebookPageId,cue ? {cue} : {});
  clearNotebookBufferedDraft();
  save();
  renderAll();
  toast('Added');
};

startFreshNotebookPage = function(root) {
  captureNotebookDraftBuffer(root);
  const draft = notebookBufferedDraft();
  const text = draft.text.trim();
  const cue = draft.cue.trim();
  if (text || cue) appendNotebookEntry(text,'typed',currentNotebookDate,currentNotebookPageId,cue ? {cue} : {});
  clearNotebookBufferedDraft();

  currentNotebookDate = dateKey();
  state.notebook[currentNotebookDate] ||= [];
  const newPageId = uid('page');
  notebookPageState()[currentNotebookDate] = newPageId;
  currentNotebookPageId = newPageId;
  save();
  renderAll();
  setTimeout(()=>document.querySelector('[data-notebook-input]')?.focus(),0);
  toast('Fresh page');
};
