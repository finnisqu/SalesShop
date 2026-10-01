/* Notebook live-page interaction layer.
   Current page stays editable until New Page; history is locked by default.
   Also stabilizes Grid rich editing and adds Medium / Full / Float presentation modes. */

const unlockedNotebookHistoryPages = new Set();
let notebookFloatDrag = null;
let notebookFloatResizeTimer = null;

function notebookPageIdentity(date=currentNotebookDate,pageId=currentNotebookPageId) {
  return `${date || dateKey()}::${pageId || ''}`;
}

function currentLiveNotebookPageId() {
  return notebookPageState()[dateKey()] || null;
}

function isCurrentLiveNotebookPage() {
  return currentNotebookDate === dateKey() && currentNotebookPageId === currentLiveNotebookPageId();
}

function isCurrentNotebookPageEditable() {
  return isCurrentLiveNotebookPage() || unlockedNotebookHistoryPages.has(notebookPageIdentity());
}

/* Clicking the main Notebook tab always returns to the actual live page. */
const _salesShopLiveShowView = showView;
showView = function(name) {
  if (name === 'notebook') {
    currentNotebookDate = dateKey();
    currentNotebookPageId = notebookPageState()[currentNotebookDate] || null;
  }
  return _salesShopLiveShowView(name);
};

function moveNotebookCaptureToolsToToolbar(root) {
  const left = $('.notebook-toolbar-left',root);
  if (!left) return;
  let capture = $('.notebook-capture-tools',left);
  if (!capture) {
    capture = document.createElement('div');
    capture.className = 'notebook-capture-tools';
    left.appendChild(capture);
  }
  const mic = $('[data-mic]',root);
  const attach = $('[data-attach]',root);
  const file = $('[data-file-input]',root);
  if (mic) capture.appendChild(mic);
  if (attach) capture.appendChild(attach);
  if (file) capture.appendChild(file);
}

function installHistoryEditControl(root) {
  const actions = $('.notebook-toolbar-actions',root);
  if (!actions) return;
  $('[data-history-edit]',actions)?.remove();
  if (isCurrentLiveNotebookPage()) return;

  const editable = isCurrentNotebookPageEditable();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'notebook-toolbar-button notebook-history-edit';
  btn.dataset.historyEdit = '';
  btn.title = editable ? 'Lock this history page' : 'Edit this history page';
  btn.setAttribute('aria-label',btn.title);
  btn.textContent = editable ? '🔒' : '✎';
  actions.insertBefore(btn,actions.firstChild);
  btn.onclick = () => {
    const key = notebookPageIdentity();
    if (unlockedNotebookHistoryPages.has(key)) unlockedNotebookHistoryPages.delete(key);
    else unlockedNotebookHistoryPages.add(key);
    renderAll();
  };
}

function applyNotebookEditState(root) {
  const shell = $('.notebook-shell',root);
  if (!shell) return;
  const editable = isCurrentNotebookPageEditable();
  shell.classList.toggle('notebook-readonly',!editable);
  shell.dataset.notebookEditable = editable ? 'true' : 'false';

  $$('[data-mic],[data-attach]',root).forEach(btn => {
    btn.disabled = !editable;
    if (!editable) btn.title = 'Unlock this history page to add content';
  });
  $$('.voice-memo-title',root).forEach(title => {
    if (!editable) title.setAttribute('contenteditable','false');
  });
}

/* History selection can still be copied, but formatting/edit actions stay locked. */
if (typeof showSavedRichSelectionPopover === 'function') {
  const _salesShopLiveSavedPopover = showSavedRichSelectionPopover;
  showSavedRichSelectionPopover = function(force=false) {
    if (!isCurrentNotebookPageEditable()) {
      removeSelectionPopover();
      return;
    }
    return _salesShopLiveSavedPopover(force);
  };
}

if (!window.__salesShopHistoryEditGuard) {
  window.__salesShopHistoryEditGuard = true;
  document.addEventListener('dblclick',e=>{
    const shell = e.target?.closest?.('.notebook-shell.notebook-readonly');
    if (!shell) return;
    if (e.target.closest('.entry-text,.grid-note-text,.voice-memo-title,.grid-grab-handle')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },true);
  document.addEventListener('pointerdown',e=>{
    const shell = e.target?.closest?.('.notebook-shell.notebook-readonly');
    if (!shell) return;
    if (e.target.closest('.grid-grab-handle,.rich-tool,[data-mic],[data-attach]')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },true);
}

function insertTextareaNewline(textarea) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  textarea.value = `${textarea.value.slice(0,start)}\n${textarea.value.slice(end)}`;
  textarea.setSelectionRange(start+1,start+1);
  textarea.dispatchEvent(new Event('input',{bubbles:true}));
}

/* Shift+Enter is no longer a commit gesture anywhere on the live notebook. */
if (!window.__salesShopPlainEnterNotebook) {
  window.__salesShopPlainEnterNotebook = true;
  document.addEventListener('keydown',e=>{
    if (e.key !== 'Enter' || !e.shiftKey || e.isComposing) return;
    const shell = e.target?.closest?.('.notebook-shell');
    if (!shell || !isCurrentNotebookPageEditable()) return;

    if (e.target.matches?.('[data-rich-draft-editor],[data-grid-rich-editor]')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      insertRichPlainText('\n');
      e.target.dispatchEvent(new Event('input',{bubbles:true}));
      return;
    }
    if (e.target.matches?.('.grid-editor,[data-notebook-input]')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      insertTextareaNewline(e.target);
      return;
    }
    if (e.target.matches?.('[data-cornell-cue]')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const body = $('[data-rich-draft-editor]',shell) || $('[data-notebook-input]',shell);
      placeCaretAtRichEnd(body);
    }
  },true);
}

function ensureNotebookTargetVisible(root,target) {
  const page = $('.notebook-page',root);
  if (!page || !target) return;
  const pageRect = page.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const margin = 18;
  const verticallyVisible = rect.top >= pageRect.top + margin && rect.bottom <= pageRect.bottom - margin;
  const horizontallyVisible = rect.left >= pageRect.left + 6 && rect.right <= pageRect.right - 6;
  if (verticallyVisible && horizontallyVisible) return;
  try { target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'}); }
  catch { target.scrollIntoView(false); }
}

const _salesShopLiveFocusNotebook = focusNotebookAtNextAvailableRow;
focusNotebookAtNextAvailableRow = function(root) {
  _salesShopLiveFocusNotebook(root);
  requestAnimationFrame(()=>{
    const target = notebookPaperView()==='cornell'
      ? ($('[data-cornell-cue]',root) || $('[data-rich-draft-editor]',root))
      : ($('[data-rich-draft-editor]',root) || $('[data-notebook-input]',root));
    ensureNotebookTargetVisible(root,target);
  });
};

/* Rich Grid used to focus a second editor and trigger the legacy textarea blur-close.
   Point activeGridEditor at the visible rich editor before that blur timer runs. */
const _salesShopLiveOpenGridEditor = openGridEditor;
openGridEditor = function(root,canvas,placement,existingEntry=null) {
  _salesShopLiveOpenGridEditor(root,canvas,placement,existingEntry);
  if (!activeGridEditor) return;
  const rich = $('[data-grid-rich-editor]',activeGridEditor.wrap);
  if (rich && activeGridEditor.textarea !== rich) {
    activeGridEditor.legacyTextarea = activeGridEditor.textarea;
    activeGridEditor.textarea = rich;
  }
  requestAnimationFrame(()=>{
    if (!activeGridEditor) return;
    const editor = $('[data-grid-rich-editor]',activeGridEditor.wrap) || activeGridEditor.textarea;
    placeCaretAtRichEnd(editor);
    ensureNotebookTargetVisible(root,activeGridEditor.wrap);
  });
};

function sizeGridCanvasToContent(root) {
  if (notebookPaperView() !== 'grid') return;
  const canvas = $('.grid-notebook-canvas',root);
  const page = $('.notebook-page',root);
  if (!canvas || !page) return;
  requestAnimationFrame(()=>{
    const visibleWidth = Math.max(280,page.clientWidth - 42);
    let right = 0;
    $$('.grid-note,.grid-editor-wrap',canvas).forEach(el=>{
      right = Math.max(right,el.offsetLeft + Math.max(el.offsetWidth,el.scrollWidth || 0));
    });
    const needed = Math.max(visibleWidth,right ? right + 56 : 0);
    canvas.style.width = `${Math.ceil(needed / NOTEBOOK_GRID_SIZE) * NOTEBOOK_GRID_SIZE}px`;
  });
}

/* ---- Floating notebook presentation ------------------------------------ */
const _salesShopPreFloatWidthMode = notebookWidthMode;
notebookWidthMode = function() {
  return state.settings?.notebookWidthMode === 'float' ? 'float' : _salesShopPreFloatWidthMode();
};

const _salesShopPreFloatApplyWidth = applyNotebookWidthMode;
applyNotebookWidthMode = function(root) {
  _salesShopPreFloatApplyWidth(root);
  const mode = notebookWidthMode();
  const shell = $('.notebook-shell',root);
  shell?.classList.toggle('notebook-width-float',mode==='float');
  document.body.classList.toggle('notebook-floating-mode',mode==='float');
  $('#workspaceBody')?.classList.toggle('notebook-floating-workspace',mode==='float');
  $$('[data-notebook-width]',root).forEach(btn=>{
    const active = btn.dataset.notebookWidth === mode;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  });
  if (mode === 'float') restoreFloatingNotebookBox(root);
  sizeGridCanvasToContent(root);
};

function installFloatWidthButton(root) {
  const controls = $('[data-notebook-width-controls]',root);
  if (!controls) return;
  let btn = $('[data-notebook-width="float"]',controls);
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'notebook-width-button';
    btn.dataset.notebookWidth = 'float';
    btn.title = 'Float notebook';
    btn.setAttribute('aria-label','Float notebook');
    btn.innerHTML = '<span class="notebook-width-glyph float"></span>';
    controls.appendChild(btn);
  }
  btn.onclick = ()=>{
    state.settings.notebookWidthMode = 'float';
    save();
    if (currentView === 'notebook') showView('board');
    else applyNotebookWidthMode(root);
  };
  applyNotebookWidthMode(root);
}

function restoreFloatingNotebookBox(root) {
  const dock = root.closest?.('#notebookDock') || $('#notebookDock');
  if (!dock || notebookWidthMode() !== 'float') return;
  const pos = state.settings?.notebookFloatBox || {};
  if (Number.isFinite(pos.left)) {
    dock.style.left = `${pos.left}px`;
    dock.style.top = `${pos.top || 70}px`;
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
  }
  if (Number.isFinite(pos.width)) dock.style.width = `${pos.width}px`;
  if (Number.isFinite(pos.height)) dock.style.height = `${pos.height}px`;
}

function saveFloatingNotebookBox(dock) {
  if (!dock || notebookWidthMode() !== 'float') return;
  const rect = dock.getBoundingClientRect();
  state.settings ||= {};
  state.settings.notebookFloatBox = {
    left:Math.max(4,Math.round(rect.left)),
    top:Math.max(54,Math.round(rect.top)),
    width:Math.round(rect.width),
    height:Math.round(rect.height)
  };
  save();
}

function installFloatingNotebookChrome(root) {
  const toolbar = $('.notebook-toolbar',root);
  const left = $('.notebook-toolbar-left',root);
  const dock = $('#notebookDock');
  if (!toolbar || !left || !dock) return;
  let handle = $('.notebook-float-grab',toolbar);
  if (!handle) {
    handle = document.createElement('button');
    handle.type='button';
    handle.className='notebook-float-grab';
    handle.title='Move floating notebook';
    handle.setAttribute('aria-label','Move floating notebook');
    handle.innerHTML='<span></span><span></span><span></span><span></span><span></span><span></span>';
    left.prepend(handle);
  }

  if (!handle.dataset.dragBound) {
    handle.dataset.dragBound='1';
    handle.addEventListener('pointerdown',e=>{
      if (notebookWidthMode() !== 'float' || e.button !== 0) return;
      e.preventDefault();
      const rect=dock.getBoundingClientRect();
      notebookFloatDrag={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,left:rect.left,top:rect.top};
      handle.setPointerCapture?.(e.pointerId);
      document.body.classList.add('notebook-float-moving');
    });
  }

  if (!dock.dataset.floatMoveBound) {
    dock.dataset.floatMoveBound='1';
    document.addEventListener('pointermove',e=>{
      if (!notebookFloatDrag || notebookWidthMode()!=='float') return;
      const left=Math.max(4,Math.min(window.innerWidth-dock.offsetWidth-4,notebookFloatDrag.left+(e.clientX-notebookFloatDrag.startX)));
      const top=Math.max(54,Math.min(window.innerHeight-dock.offsetHeight-4,notebookFloatDrag.top+(e.clientY-notebookFloatDrag.startY)));
      dock.style.left=`${left}px`; dock.style.top=`${top}px`; dock.style.right='auto'; dock.style.bottom='auto';
    },{passive:true});
    document.addEventListener('pointerup',()=>{
      if (!notebookFloatDrag) return;
      notebookFloatDrag=null;
      document.body.classList.remove('notebook-float-moving');
      saveFloatingNotebookBox(dock);
    });
  }

  if (!dock.__salesShopFloatObserver && window.ResizeObserver) {
    dock.__salesShopFloatObserver = new ResizeObserver(()=>{
      if (notebookWidthMode()!=='float') return;
      clearTimeout(notebookFloatResizeTimer);
      notebookFloatResizeTimer=setTimeout(()=>saveFloatingNotebookBox(dock),220);
    });
    dock.__salesShopFloatObserver.observe(dock);
  }
}

/* Clicking Notebook while floating means "bring the notebook forward" — return to Medium. */
if (!window.__salesShopFloatNotebookTab) {
  window.__salesShopFloatNotebookTab=true;
  document.addEventListener('click',e=>{
    const tab=e.target?.closest?.('.top-tab[data-view="notebook"]');
    if (!tab || notebookWidthMode()!=='float') return;
    state.settings.notebookWidthMode='medium';
    save();
  },true);
}

function installNotebookLiveLayer(root) {
  moveNotebookCaptureToolsToToolbar(root);
  installFloatWidthButton(root);
  installFloatingNotebookChrome(root);
  installHistoryEditControl(root);
  applyNotebookEditState(root);
  sizeGridCanvasToContent(root);
}

const _salesShopLiveRenderNotebookSurface = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopLiveRenderNotebookSurface(root);
  if (!root) return;
  installNotebookLiveLayer(root);
};

/* Grid drag can expand the elastic canvas if a note is moved farther right. */
if (!window.__salesShopGridElasticBounds) {
  window.__salesShopGridElasticBounds=true;
  document.addEventListener('pointerup',e=>{
    if (!e.target?.closest?.('.grid-grab-handle')) return;
    setTimeout(()=>sizeGridCanvasToContent($('#notebookDock')),0);
  },true);
}
