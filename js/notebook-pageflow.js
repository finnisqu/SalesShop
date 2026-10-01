/* Current-page notebook flow: no visible short-term history, spatial grid migration,
   persistent voice memos + live dictation. Loaded after notebook QOL. */

const VOICE_DB_NAME = 'salesshop-media-v1';
const VOICE_DB_STORE = 'voice';
let activeVoiceMemo = null;
let activeVoiceAudio = null;
let activeVoiceAudioUrl = '';

function migrateGridToFullSheetOnce() {
  state.settings ||= {};
  if (state.settings.gridLayoutVersion === 2) return;

  /* The old grid reserved 252px (9 squares) for the history rail. Shift existing
     placed notes by 9 columns so they keep roughly the same on-screen x position
     when the rail disappears. */
  Object.values(state.notebook || {}).forEach(entries => {
    (entries || []).forEach(entry => {
      if (!entry.grid) return;
      entry.grid = {
        col: Math.max(0, (Number(entry.grid.col) || 0) + 9),
        row: Math.max(0, Number(entry.grid.row) || 0)
      };
    });
  });
  state.settings.gridLayoutVersion = 2;
  save();
}

function gridEntryRowSpan(entry) {
  const textLines = Math.max(1, String(entry.text || entry.attachment?.name || '').split('\n').length);
  const cueRows = entry.cue ? 1 : 0;
  const voiceRows = entry.voiceMemo ? 1 : 0;
  const attachmentRows = entry.attachment ? 1 : 0;
  return Math.max(1, textLines + cueRows + voiceRows + attachmentRows);
}

function ensureCurrentGridPlacements() {
  migrateGridToFullSheetOnce();
  const entries = gridPageEntries();
  let nextRow = 0;

  entries.filter(entry => entry.grid).forEach(entry => {
    nextRow = Math.max(nextRow, (Number(entry.grid.row) || 0) + gridEntryRowSpan(entry) + 1);
  });

  let changed = false;
  entries.filter(entry => !entry.grid).forEach(entry => {
    entry.layout = 'grid';
    entry.grid = {col: 0, row: nextRow};
    nextRow += gridEntryRowSpan(entry) + 1;
    changed = true;
  });
  if (changed) save();
}

/* With the history rail gone, Grid uses the whole sheet. */
gridWorkspaceLeft = function() { return 0; };

nextAvailableGridPlacement = function() {
  ensureCurrentGridPlacements();
  let nextRow = 0;
  gridPageEntries().forEach(entry => {
    if (!entry.grid) return;
    nextRow = Math.max(nextRow, (Number(entry.grid.row) || 0) + gridEntryRowSpan(entry) + 1);
  });
  return {col:0,row:nextRow};
};

renderGridNotebook = function(root) {
  if (notebookPaperView() !== 'grid') return;
  const body = $('.notebook-page-body',root);
  if (!body) return;

  ensureCurrentGridPlacements();
  body.classList.add('grid-spatial-active','grid-full-sheet');
  const entries = gridPageEntries();
  const draft = notebookBufferedDraft();

  const canvas = document.createElement('div');
  canvas.className = 'grid-notebook-canvas grid-notebook-full-sheet';
  canvas.dataset.gridCanvas = '';

  entries.forEach(entry => {
    const placement = {col:Number(entry.grid?.col)||0,row:Number(entry.grid?.row)||0};
    const note = document.createElement('div');
    note.className = 'grid-note grid-note-placed';
    note.dataset.entryId = entry.id;
    note.dataset.gridCol = placement.col;
    note.dataset.gridRow = placement.row;
    note.style.setProperty('--grid-col',placement.col);
    note.style.setProperty('--grid-row',placement.row);
    if (entry.cue) note.insertAdjacentHTML('beforeend',`<span class="grid-note-cue">${escapeHtml(entry.cue)}</span>`);
    note.insertAdjacentHTML('beforeend',`<span class="grid-note-text">${escapeHtml(entry.text || entry.attachment?.name || '')}</span>`);
    canvas.appendChild(note);
  });

  if (draft.text || draft.cue) {
    const hint = document.createElement('div');
    hint.className = 'grid-unplaced-draft';
    hint.textContent = 'Draft · double-click to place';
    canvas.appendChild(hint);
  }

  body.appendChild(canvas);
  bindGridNotebook(root,canvas);
};

function voiceDb() {
  return new Promise((resolve,reject) => {
    if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(VOICE_DB_NAME,1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VOICE_DB_STORE)) db.createObjectStore(VOICE_DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open voice storage'));
  });
}

async function storeVoiceBlob(key,blob) {
  const db = await voiceDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(VOICE_DB_STORE,'readwrite');
    tx.objectStore(VOICE_DB_STORE).put(blob,key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getVoiceBlob(key) {
  const db = await voiceDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(VOICE_DB_STORE,'readonly');
    const req = tx.objectStore(VOICE_DB_STORE).get(key);
    req.onsuccess = () => { const value=req.result; db.close(); resolve(value || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

function formatVoiceDuration(seconds=0) {
  const total = Math.max(0,Math.round(Number(seconds)||0));
  const mins = Math.floor(total/60);
  const secs = String(total%60).padStart(2,'0');
  return `${mins}:${secs}`;
}

function voiceEntryDom(entryId) {
  const escaped = (window.CSS && CSS.escape) ? CSS.escape(entryId) : entryId;
  return document.querySelector(`[data-entry-id="${escaped}"]`);
}

function updateVoiceTranscriptDom(entry) {
  const row = voiceEntryDom(entry.id);
  const text = row?.querySelector('.entry-text,.grid-note-text,.grid-history-text');
  if (text) text.textContent = entry.text || '';
  const duration = row?.querySelector('.voice-memo-duration');
  if (duration && activeVoiceMemo?.entry?.id === entry.id) {
    duration.textContent = formatVoiceDuration((Date.now()-activeVoiceMemo.startedAt)/1000);
  }
}

function voiceMemoChip(entry) {
  const memo = entry.voiceMemo || {};
  const wrap = document.createElement('div');
  wrap.className = `voice-memo-chip${memo.recording?' recording':''}`;
  wrap.dataset.voiceMemo = entry.id;
  wrap.innerHTML = `
    <button type="button" class="voice-memo-play" aria-label="${memo.recording?'Recording voice memo':'Play voice memo'}" title="${memo.recording?'Recording…':'Play voice memo'}" ${(!memo.audioKey || memo.recording)?'disabled':''}>
      <span aria-hidden="true">${memo.recording?'●':'▶'}</span>
    </button>
    <span class="voice-memo-title" contenteditable="${memo.recording?'false':'true'}" spellcheck="false">${escapeHtml(memo.title || 'Voice Memo')}</span>
    <span class="voice-memo-duration">${formatVoiceDuration(memo.durationSeconds || 0)}</span>`;

  const title = $('.voice-memo-title',wrap);
  if (title && !memo.recording) {
    title.addEventListener('keydown',e=>{
      if (e.key==='Enter') { e.preventDefault(); title.blur(); }
      if (e.key==='Escape') { e.preventDefault(); title.textContent=memo.title || 'Voice Memo'; title.blur(); }
    });
    title.addEventListener('blur',()=>{
      const value = title.textContent.trim() || 'Voice Memo';
      entry.voiceMemo.title = value;
      title.textContent = value;
      save();
    });
  }

  $('.voice-memo-play',wrap)?.addEventListener('click',()=>toggleVoicePlayback(entry,wrap));
  return wrap;
}

async function toggleVoicePlayback(entry,chip) {
  if (!entry.voiceMemo?.audioKey) return;
  if (activeVoiceAudio) {
    activeVoiceAudio.pause();
    activeVoiceAudio = null;
    if (activeVoiceAudioUrl) URL.revokeObjectURL(activeVoiceAudioUrl);
    activeVoiceAudioUrl = '';
    $$('.voice-memo-chip.playing').forEach(el=>el.classList.remove('playing'));
    if (chip?.dataset.playing === 'true') {
      chip.dataset.playing='false';
      return;
    }
  }

  try {
    const blob = await getVoiceBlob(entry.voiceMemo.audioKey);
    if (!blob) return toast('Voice memo audio is not available in this browser.');
    activeVoiceAudioUrl = URL.createObjectURL(blob);
    activeVoiceAudio = new Audio(activeVoiceAudioUrl);
    chip.classList.add('playing');
    chip.dataset.playing='true';
    activeVoiceAudio.onended = () => {
      chip.classList.remove('playing');
      chip.dataset.playing='false';
      URL.revokeObjectURL(activeVoiceAudioUrl);
      activeVoiceAudioUrl=''; activeVoiceAudio=null;
    };
    await activeVoiceAudio.play();
  } catch {
    toast('Could not play this voice memo.');
  }
}

function decorateVoiceMemoEntries(root) {
  if (!root) return;
  gridPageEntries().forEach(entry => {
    if (!entry.voiceMemo) return;
    const row = root.querySelector(`[data-entry-id="${(window.CSS&&CSS.escape)?CSS.escape(entry.id):entry.id}"]`);
    if (!row || $('.voice-memo-chip',row)) return;
    const text = $('.entry-text,.grid-note-text,.grid-history-text',row);
    const chip = voiceMemoChip(entry);
    if (text) row.insertBefore(chip,text);
    else row.appendChild(chip);
  });
}

function refreshVoiceMemoUi() {
  const entry = activeVoiceMemo?.entry;
  if (!entry) return;
  updateVoiceTranscriptDom(entry);
  const mic = $('#notebookDock [data-mic]');
  mic?.classList.add('recording');
  if (mic) mic.title = 'Stop voice memo';
}

async function startVoiceMemo(root) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    return toast('This browser cannot record voice memos.');
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio:true});
  } catch {
    return toast('Microphone access was not granted.');
  }

  const extra = {
    voiceMemo:{title:'Voice Memo',durationSeconds:0,audioKey:null,mimeType:'',recording:true}
  };
  if (notebookPaperView()==='grid') {
    extra.layout='grid';
    extra.grid=nextAvailableGridPlacement();
  }
  const entry = appendNotebookEntry('','voice',currentNotebookDate,currentNotebookPageId,extra);
  save();
  renderAll();

  const chunks=[];
  let recorder;
  try { recorder = new MediaRecorder(stream); }
  catch {
    stream.getTracks().forEach(t=>t.stop());
    entry.voiceMemo.recording=false;
    save(); renderAll();
    return toast('Voice recording could not start.');
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let finalText = '';

  activeVoiceMemo = {
    entry, stream, recorder, recognition:null, chunks,
    startedAt:Date.now(), finalText:'', interval:null
  };

  recorder.ondataavailable = e=>{ if(e.data?.size) chunks.push(e.data); };
  recorder.onstop = async()=>{
    const session = activeVoiceMemo;
    const duration = Math.max(1,Math.round((Date.now()-(session?.startedAt || Date.now()))/1000));
    entry.voiceMemo.durationSeconds=duration;
    entry.voiceMemo.recording=false;
    const blob = new Blob(chunks,{type:recorder.mimeType || chunks[0]?.type || 'audio/webm'});
    entry.voiceMemo.mimeType=blob.type;
    if (blob.size) {
      try {
        const key=`voice_${entry.id}`;
        await storeVoiceBlob(key,blob);
        entry.voiceMemo.audioKey=key;
      } catch {
        toast('Transcript saved, but the audio memo could not be stored.');
      }
    }
    save();
    stream.getTracks().forEach(t=>t.stop());
    if (activeVoiceMemo?.entry?.id === entry.id) activeVoiceMemo=null;
    renderAll();
  };

  recorder.start(250);

  if (SpeechRecognition) {
    try {
      recognition = new SpeechRecognition();
      recognition.continuous=true;
      recognition.interimResults=true;
      recognition.lang='en-US';
      activeVoiceMemo.recognition=recognition;
      recognition.onresult = e=>{
        let interim='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          const text=e.results[i][0].transcript;
          if(e.results[i].isFinal) finalText += `${text.trim()} `;
          else interim += text;
        }
        activeVoiceMemo && (activeVoiceMemo.finalText=finalText);
        entry.text=(finalText+interim).trim();
        delete entry.richHtml;
        save();
        updateVoiceTranscriptDom(entry);
      };
      recognition.onerror = ()=>{};
      recognition.start();
    } catch {}
  }

  activeVoiceMemo.interval=setInterval(refreshVoiceMemoUi,250);
  refreshVoiceMemoUi();
}

function stopVoiceMemo() {
  const session=activeVoiceMemo;
  if (!session) return;
  clearInterval(session.interval);
  try { session.recognition?.stop(); } catch {}
  try {
    if (session.recorder?.state !== 'inactive') session.recorder.stop();
    else {
      session.stream?.getTracks().forEach(t=>t.stop());
      activeVoiceMemo=null;
    }
  } catch {
    session.stream?.getTracks().forEach(t=>t.stop());
    activeVoiceMemo=null;
  }
}

/* The mic is now a voice-memo + live-transcription action in every paper style. */
toggleSpeech = function(root) {
  if (activeVoiceMemo) {
    stopVoiceMemo();
    return;
  }
  startVoiceMemo(root);
};

/* Everything committed to the current page stays visible until New Page. */
const _salesShopPageFlowRenderNotebookSurface = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopPageFlowRenderNotebookSurface(root);
  if (!root) return;
  decorateVoiceMemoEntries(root);
  if (activeVoiceMemo) refreshVoiceMemoUi();
};
