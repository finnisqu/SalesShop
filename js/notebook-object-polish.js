/* Notebook object polish: clean redocking, useful history previews,
   deletable page objects, and true play/pause voice controls. */

let selectedNotebookObjectId = null;
let activeVoiceAudioEntryId = null;

function resetNotebookDockInlineBox() {
  const dock = $('#notebookDock');
  if (!dock) return;
  ['left','top','right','bottom','width','height'].forEach(prop => { dock.style[prop] = ''; });
}

/* Floating stores inline geometry on the dock. Medium/Full must explicitly surrender it. */
const _salesShopObjectApplyNotebookWidth = applyNotebookWidthMode;
applyNotebookWidthMode = function(root) {
  const requested = state.settings?.notebookWidthMode;
  if (requested !== 'float') resetNotebookDockInlineBox();
  _salesShopObjectApplyNotebookWidth(root);
  if (notebookWidthMode() !== 'float') resetNotebookDockInlineBox();
};

function notebookHistoryPreview(pageEntries) {
  if (!pageEntries?.length) return 'Blank page';
  for (const entry of pageEntries) {
    const candidate = String(
      entry.cue ||
      entry.voiceMemo?.title ||
      entry.attachment?.name ||
      entry.text ||
      ''
    ).replace(/\s+/g,' ').trim();
    if (candidate) return candidate.length > 46 ? `${candidate.slice(0,46)}…` : candidate;
  }
  return 'Blank page';
}

/* History is page-oriented now; counts are no longer useful UI. */
openNotebookHistory = function() {
  const rows = notebookHistoryRows();
  openModal('Notebook','History',`
    <div class="history-list notebook-page-history-list">
      ${rows.map(row=>{
        const pageEntries = notebookEntriesForPage(row.key,row.pageId);
        const preview = notebookHistoryPreview(pageEntries);
        const selected = row.key===currentNotebookDate && row.pageId===currentNotebookPageId;
        return `<button class="history-row notebook-page-history-row ${selected?'active':''}" data-history-date="${row.key}" data-history-page="${row.pageId}">
          <span class="notebook-history-page-label">${row.key===dateKey()?'Today':fmtDate(row.key,{weekday:'short',month:'short',day:'numeric',year:'numeric'})} · Page ${row.pageNumber}${row.active?' · current':''}</span>
          <span class="notebook-history-preview">${escapeHtml(preview)}</span>
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

function notebookObjectEntry(entryId) {
  return notebookEntryById(entryId);
}

function removeNotebookEntry(entryId) {
  if (!entryId || !isCurrentNotebookPageEditable()) return;
  if (typeof notebookPushUndoCheckpoint === 'function') notebookPushUndoCheckpoint();

  if (activeVoiceAudioEntryId === entryId && activeVoiceAudio) {
    try { activeVoiceAudio.pause(); } catch {}
    try { if (activeVoiceAudioUrl) URL.revokeObjectURL(activeVoiceAudioUrl); } catch {}
    activeVoiceAudio = null;
    activeVoiceAudioUrl = '';
    activeVoiceAudioEntryId = null;
  }

  Object.keys(state.notebook || {}).some(key => {
    const entries = state.notebook[key] || [];
    const index = entries.findIndex(entry => entry.id === entryId);
    if (index < 0) return false;
    entries.splice(index,1);
    return true;
  });
  selectedNotebookObjectId = null;
  save();
  renderAll();
  toast('Removed');
}

function selectNotebookObject(entryId, element) {
  $$('.notebook-object-selected').forEach(el=>el.classList.remove('notebook-object-selected'));
  selectedNotebookObjectId = entryId || null;
  element?.classList.add('notebook-object-selected');
}

function notebookDeleteButton(entryId,label='Delete') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'notebook-object-delete';
  btn.dataset.deleteNotebookObject = entryId;
  btn.title = label;
  btn.setAttribute('aria-label',label);
  btn.textContent = '×';
  btn.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    removeNotebookEntry(entryId);
  };
  return btn;
}

function attachmentObjectForEntry(entry) {
  const attachment = entry.attachment;
  if (!attachment) return null;
  const wrap = document.createElement('div');
  wrap.className = 'notebook-attachment notebook-page-object';
  wrap.dataset.notebookObjectId = entry.id;

  if (attachment.dataUrl && attachment.type?.startsWith('image/')) {
    const img = document.createElement('img');
    img.className='notebook-attachment-image';
    img.src=attachment.dataUrl;
    img.alt=attachment.name || 'Attachment';
    wrap.appendChild(img);
  }
  const label = attachment.dataUrl && !attachment.type?.startsWith('image/') ? document.createElement('a') : document.createElement('span');
  label.className='notebook-attachment-file';
  label.textContent=`📎 ${attachment.name || 'Attachment'}`;
  if (label.tagName === 'A') {
    label.href=attachment.dataUrl;
    label.download=attachment.name || 'attachment';
  }
  wrap.appendChild(label);
  if (isCurrentNotebookPageEditable()) wrap.appendChild(notebookDeleteButton(entry.id,'Delete attachment'));
  wrap.onclick = e => {
    if (e.target.closest('a,button')) return;
    selectNotebookObject(entry.id,wrap);
  };
  return wrap;
}

function decorateNotebookAttachments(root) {
  gridPageEntries().forEach(entry => {
    if (!entry.attachment) return;
    const escaped = (window.CSS&&CSS.escape) ? CSS.escape(entry.id) : entry.id;
    const row = root.querySelector(`[data-entry-id="${escaped}"]`);
    if (!row) return;

    /* Normal notebook rendering already has an attachment object; just add controls. */
    let attachment = $('.notebook-attachment',row);
    if (!attachment) {
      attachment = attachmentObjectForEntry(entry);
      const text = $('.grid-note-text,.entry-text',row);
      if (text) {
        text.style.display='none';
        row.insertBefore(attachment,text);
      } else row.appendChild(attachment);
    } else {
      attachment.classList.add('notebook-page-object');
      attachment.dataset.notebookObjectId=entry.id;
      if (isCurrentNotebookPageEditable() && !$('.notebook-object-delete',attachment)) {
        attachment.appendChild(notebookDeleteButton(entry.id,'Delete attachment'));
      }
      attachment.onclick = e => {
        if (e.target.closest('a,button')) return;
        selectNotebookObject(entry.id,attachment);
      };
    }
  });
}

function setVoiceMemoButtonState(entryId,playing) {
  const escaped = (window.CSS&&CSS.escape) ? CSS.escape(entryId) : entryId;
  document.querySelectorAll(`[data-voice-memo="${escaped}"]`).forEach(chip=>{
    const btn=$('.voice-memo-play',chip);
    if (!btn) return;
    btn.innerHTML = `<span aria-hidden="true">${playing?'Ⅱ':'▶'}</span>`;
    btn.setAttribute('aria-label',playing?'Pause voice memo':'Play voice memo');
    btn.title=playing?'Pause voice memo':'Play voice memo';
    chip.classList.toggle('playing',playing);
    chip.dataset.playing=playing?'true':'false';
  });
}

function stopActiveVoicePlayback({revoke=true}={}) {
  if (!activeVoiceAudio) return;
  try { activeVoiceAudio.pause(); } catch {}
  if (activeVoiceAudioEntryId) setVoiceMemoButtonState(activeVoiceAudioEntryId,false);
  if (revoke && activeVoiceAudioUrl) {
    try { URL.revokeObjectURL(activeVoiceAudioUrl); } catch {}
    activeVoiceAudioUrl='';
    activeVoiceAudio=null;
    activeVoiceAudioEntryId=null;
  }
}

/* True play/pause: clicking the active memo pauses without throwing away its position. */
toggleVoicePlayback = async function(entry,chip) {
  if (!entry.voiceMemo?.audioKey) return;

  if (activeVoiceAudio && activeVoiceAudioEntryId === entry.id) {
    if (!activeVoiceAudio.paused) {
      activeVoiceAudio.pause();
      setVoiceMemoButtonState(entry.id,false);
      return;
    }
    try {
      await activeVoiceAudio.play();
      setVoiceMemoButtonState(entry.id,true);
    } catch { toast('Could not play this voice memo.'); }
    return;
  }

  stopActiveVoicePlayback({revoke:true});
  try {
    const blob = await getVoiceBlob(entry.voiceMemo.audioKey);
    if (!blob) return toast('Voice memo audio is not available in this browser.');
    activeVoiceAudioUrl=URL.createObjectURL(blob);
    activeVoiceAudio=new Audio(activeVoiceAudioUrl);
    activeVoiceAudioEntryId=entry.id;
    activeVoiceAudio.onended=()=>{
      setVoiceMemoButtonState(entry.id,false);
      if (activeVoiceAudioUrl) URL.revokeObjectURL(activeVoiceAudioUrl);
      activeVoiceAudioUrl=''; activeVoiceAudio=null; activeVoiceAudioEntryId=null;
    };
    activeVoiceAudio.onerror=()=>{
      setVoiceMemoButtonState(entry.id,false);
      toast('Could not play this voice memo.');
    };
    await activeVoiceAudio.play();
    setVoiceMemoButtonState(entry.id,true);
  } catch {
    stopActiveVoicePlayback({revoke:true});
    toast('Could not play this voice memo.');
  }
};

function decorateVoiceMemoObjectControls(root) {
  gridPageEntries().forEach(entry=>{
    if (!entry.voiceMemo) return;
    const escaped=(window.CSS&&CSS.escape)?CSS.escape(entry.id):entry.id;
    const row=root.querySelector(`[data-entry-id="${escaped}"]`);
    const chip=row?.querySelector('.voice-memo-chip');
    if (!chip) return;
    chip.classList.add('notebook-page-object');
    chip.dataset.notebookObjectId=entry.id;
    if (isCurrentNotebookPageEditable() && !$('.notebook-object-delete',chip)) {
      chip.appendChild(notebookDeleteButton(entry.id,'Delete voice memo and transcript'));
    }
    chip.onclick=e=>{
      if (e.target.closest('button,[contenteditable="true"]')) return;
      selectNotebookObject(entry.id,chip);
    };
    const playing = activeVoiceAudioEntryId===entry.id && activeVoiceAudio && !activeVoiceAudio.paused;
    setVoiceMemoButtonState(entry.id,!!playing);
  });
}

if (!window.__salesShopNotebookObjectKeys) {
  window.__salesShopNotebookObjectKeys=true;
  document.addEventListener('pointerdown',e=>{
    if (e.target.closest('.notebook-page-object,[data-delete-notebook-object]')) return;
    selectedNotebookObjectId=null;
    $$('.notebook-object-selected').forEach(el=>el.classList.remove('notebook-object-selected'));
  });
  document.addEventListener('keydown',e=>{
    if (!selectedNotebookObjectId || !isCurrentNotebookPageEditable()) return;
    if (!['Delete','Backspace'].includes(e.key)) return;
    const active=document.activeElement;
    if (active?.matches?.('input,textarea,[contenteditable="true"]')) return;
    e.preventDefault();
    removeNotebookEntry(selectedNotebookObjectId);
  });
}

function installNotebookObjectPolish(root) {
  decorateNotebookAttachments(root);
  decorateVoiceMemoObjectControls(root);
}

const _salesShopObjectRenderNotebookSurface=renderNotebookSurface;
renderNotebookSurface=function(root){
  _salesShopObjectRenderNotebookSurface(root);
  if (!root) return;
  installNotebookObjectPolish(root);
};
