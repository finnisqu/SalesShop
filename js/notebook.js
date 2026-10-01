let draftSelectionText = '';

function renderNotebook() {
  const placeholder = $('#view-notebook');
  if (placeholder) placeholder.innerHTML = '';
  renderNotebookSurface($('#notebookDock'));
}

function renderNotebookSurface(root) {
  if(!root) return;
  const keys = [...new Set([dateKey(), ...Object.keys(state.notebook)])].sort().reverse();
  if (!keys.includes(currentNotebookDate)) currentNotebookDate = dateKey();
  const entries = state.notebook[currentNotebookDate] || [];
  const isToday = currentNotebookDate === dateKey();

  root.innerHTML = `
    <div class="notebook-shell">
      <div class="notebook-toolbar">
        <div class="notebook-toolbar-left">
          <button class="notebook-icon-tool" data-mic title="Voice note" aria-label="Voice note">🎙</button>
          <button class="notebook-icon-tool" data-attach title="Attach image or file" aria-label="Attach image or file">📎</button>
          <input data-file-input type="file" multiple hidden />
          <span class="notebook-toolbar-date">${isToday?'Today':fmtDate(currentNotebookDate,{weekday:'short',month:'short',day:'numeric'})}</span>
        </div>
        <div class="notebook-toolbar-actions">
          ${!isToday?'<button class="notebook-tool" data-today>Today</button>':''}
          <button class="notebook-tool" data-history>History</button>
        </div>
      </div>
      <div class="notebook-page">
        <div class="notebook-paper-head">
          <div class="notebook-date">${fmtDate(currentNotebookDate,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div>
        </div>
        <div class="notebook-page-body">
          <div class="notebook-entries">
            ${entries.map(notebookEntryHtml).join('')}
          </div>
          <div class="notebook-writing-zone ${entries.length?'':'blank-page'}">
            <div class="draft-selection-tools" data-draft-tools>
              <button type="button" data-draft-promote>Promote</button>
              <button type="button" data-draft-link>Link</button>
            </div>
            <textarea data-notebook-input class="notebook-input" placeholder="Start writing…"></textarea>
          </div>
        </div>
      </div>
    </div>`;
  bindNotebookSurface(root);
}

function notebookEntryHtml(entry) {
  const attachment = entry.attachment;
  let attachmentHtml = '';
  if (attachment) {
    if (attachment.dataUrl && attachment.type?.startsWith('image/')) {
      attachmentHtml = `<div class="notebook-attachment"><img class="notebook-attachment-image" src="${escapeHtml(attachment.dataUrl)}" alt="${escapeHtml(attachment.name)}"><div class="notebook-attachment-file">📎 ${escapeHtml(attachment.name)}</div></div>`;
    } else if (attachment.dataUrl) {
      attachmentHtml = `<div class="notebook-attachment"><a class="notebook-attachment-file" href="${escapeHtml(attachment.dataUrl)}" download="${escapeHtml(attachment.name)}">📎 ${escapeHtml(attachment.name)}</a></div>`;
    } else {
      attachmentHtml = `<div class="notebook-attachment"><span class="notebook-attachment-file">📎 ${escapeHtml(attachment.name)}</span></div>`;
    }
  }
  return `<div class="notebook-entry" data-entry-id="${entry.id}">
    <div class="entry-time">${fmtTimestamp(entry.createdAt)}</div>
    ${entry.source === 'attachment' ? '' : `<div class="entry-text">${escapeHtml(entry.text)}</div>`}
    ${attachmentHtml}
  </div>`;
}

function bindNotebookSurface(root) {
  $('[data-history]', root)?.addEventListener('click', openNotebookHistory);
  $('[data-today]', root)?.addEventListener('click',()=>{ currentNotebookDate=dateKey(); renderAll(); });

  const input = $('[data-notebook-input]', root);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveNotebookDraft(root);
    }
  });
  ['select','mouseup','keyup'].forEach(eventName => input?.addEventListener(eventName,()=>updateDraftSelectionTools(root)));
  input?.addEventListener('input',()=>updateDraftSelectionTools(root));

  $('[data-draft-promote]', root)?.addEventListener('mousedown',e=>e.preventDefault());
  $('[data-draft-link]', root)?.addEventListener('mousedown',e=>e.preventDefault());
  $('[data-draft-promote]', root)?.addEventListener('click',()=>{
    if (draftSelectionText) openPromoteModal(draftSelectionText, null);
  });
  $('[data-draft-link]', root)?.addEventListener('click',()=>{
    if (draftSelectionText) openLinkModal(draftSelectionText, null);
  });

  $('[data-mic]', root)?.addEventListener('click',()=>toggleSpeech(root));
  $('[data-attach]', root)?.addEventListener('click',()=> $('[data-file-input]', root)?.click());
  $('[data-file-input]', root)?.addEventListener('change', e => handleNotebookFiles([...e.target.files], currentNotebookDate));

  $$('.entry-text', root).forEach(el => {
    el.onmouseup = e => handleSelection(e, el.closest('.notebook-entry').dataset.entryId);
    el.oncontextmenu = e => { e.preventDefault(); handleSelection(e, el.closest('.notebook-entry').dataset.entryId, true); };
  });
}

function updateDraftSelectionTools(root) {
  const input = $('[data-notebook-input]', root);
  const tools = $('[data-draft-tools]', root);
  if (!input || !tools) return;
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  draftSelectionText = start !== end ? input.value.slice(start,end).trim() : '';
  tools.classList.toggle('visible', !!draftSelectionText);
}

function saveNotebookDraft(root) {
  const input=$('[data-notebook-input]', root);
  const val=input?.value.trim();
  if(!val)return;
  addNotebookEntry(val,'typed',currentNotebookDate);
  toast('Added');
}

function openNotebookHistory() {
  const keys = [...new Set([dateKey(), ...Object.keys(state.notebook)])].sort().reverse();
  openModal('Notebook','History',`
    <div class="history-list">
      ${keys.map(k=>`<button class="history-row ${k===currentNotebookDate?'active':''}" data-history-date="${k}">
        <span>${k===dateKey()?'Today':fmtDate(k,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</span>
        <span>${(state.notebook[k]||[]).length}</span>
      </button>`).join('')}
    </div>`);
  $$('[data-history-date]').forEach(btn=>btn.onclick=()=>{
    currentNotebookDate=btn.dataset.historyDate;
    closeModal();
    renderAll();
  });
}

function addNotebookEntry(text, source='typed', key=dateKey(), extra={}) {
  if(!state.notebook[key]) state.notebook[key]=[];
  state.notebook[key].push({id:uid('note'), createdAt:nowISO(), text, source, ...extra});
  save();
  renderAll();
}

async function handleNotebookFiles(files, key=dateKey()) {
  if (!files.length) return;
  if(!state.notebook[key]) state.notebook[key]=[];
  let oversized = 0;
  for (const file of files) {
    let dataUrl = '';
    if (file.size <= 900 * 1024) {
      try { dataUrl = await readFileAsDataURL(file); } catch {}
    } else {
      oversized += 1;
    }
    state.notebook[key].push({
      id: uid('note'),
      createdAt: nowISO(),
      text: file.name,
      source: 'attachment',
      attachment: {name:file.name, type:file.type || 'application/octet-stream', size:file.size, dataUrl}
    });
  }
  save();
  renderAll();
  toast(oversized ? 'Attached. Large files are saved as metadata in this prototype.' : 'Attached');
}

function readFileAsDataURL(file) {
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toggleSpeech(root) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return toast('Live browser dictation is not supported here. Typing still works.');
  const btn=$('[data-mic]', root); const input=$('[data-notebook-input]', root);
  if (speech) {
    speech.stop(); speech=null; speechTarget=null;
    btn?.classList.remove('recording'); if(btn)btn.textContent='🎙';
    return;
  }
  speechTarget = input;
  speech = new SpeechRecognition();
  speech.continuous=true;
  speech.interimResults=true;
  speech.lang='en-US';
  let final=input.value ? `${input.value.trim()} ` : '';
  speech.onresult = e => {
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t=e.results[i][0].transcript;
      if(e.results[i].isFinal) final += t+' '; else interim += t;
    }
    if(speechTarget) speechTarget.value=(final+interim).trim();
  };
  speech.onend = () => {
    btn?.classList.remove('recording'); if(btn)btn.textContent='🎙';
    speech=null; speechTarget=null;
  };
  speech.onerror = () => toast('Microphone transcription stopped.');
  speech.start();
  btn.classList.add('recording');
  btn.textContent='■';
}

function handleSelection(e, entryId, force=false) {
  setTimeout(()=>{
    const selection=window.getSelection(); const text=selection?.toString().trim();
    removeSelectionPopover(); if(!text)return;
    selectedNotebookText=text; selectedNotebookEntryId=entryId;
    const range=selection.getRangeAt(0); const rect=range.getBoundingClientRect();
    const pop=document.createElement('div'); pop.id='selectionPopover'; pop.className='selection-popover';
    pop.style.left=`${Math.min(window.innerWidth-190,Math.max(8,rect.left))}px`; pop.style.top=`${Math.max(8,rect.top-42)}px`;
    pop.innerHTML='<button id="promoteSelectionBtn">Promote</button><button id="linkSelectionBtn">Link</button>';
    document.body.appendChild(pop);
    $('#promoteSelectionBtn').onclick=()=>openPromoteModal(text, entryId);
    $('#linkSelectionBtn').onclick=()=>openLinkModal(text, entryId);
  }, force?0:10);
}
function removeSelectionPopover(){ $('#selectionPopover')?.remove(); }

function openPromoteModal(text, entryId) {
  removeSelectionPopover();
  openModal('Promote selection', '', `
    <div class="selection-quote">“${escapeHtml(text)}”</div>
    <div class="promote-grid">
      ${[
        ['contact','Contact','Create a person with only the information you have.'],
        ['company','Company','Turn the selection into a company record.'],
        ['touchpoint','Touchpoint','Record that contact happened. Nothing else required.'],
        ['reminder','Reminder','Give this thought a date and bring it back later.'],
        ['project','Project / quote card','Create something that can be quoted.'],
        ['update','Project update','Attach the selected thought to a work item.']
      ].map(([type,title,desc])=>`<button class="promote-option" data-promote="${type}"><div class="promote-title">${title}</div><div class="promote-desc">${desc}</div></button>`).join('')}
    </div>`);
  $$('[data-promote]').forEach(b=>b.onclick=()=>promoteText(b.dataset.promote,text,entryId));
}

function promoteText(type,text,entryId) {
  if(type==='contact') state.contacts.push({id:uid('contact'),name:text,company:'',detail:'',sourceEntryId:entryId});
  if(type==='company') state.companies.push({id:uid('company'),name:text,sourceEntryId:entryId});
  if(type==='touchpoint') state.touchpoints.push({id:uid('touch'),text,createdAt:nowISO(),sourceEntryId:entryId});
  if(type==='reminder') { closeModal(); return openReminderModal(text,entryId); }
  if(type==='project') state.workItems.push({id:uid('work'),title:text,company:'',stage:'Discovery',due:'',amount:0,nextAction:'',lastTouchpoint:'',sourceEntryId:entryId});
  if(type==='update') { closeModal(); return openProjectUpdateModal(text,entryId); }
  save(); closeModal();
  if (entryId) renderAll();
  toast(`Promoted to ${type}`);
}

function openReminderModal(text,entryId) {
  openModal('Reminder','',`<div class="field"><label>Reminder</label><input id="remText" value="${escapeHtml(text)}"></div><div class="field spaced-field"><label>Date</label><input id="remDate" type="date"></div><div class="modal-actions"><button class="primary-button" id="saveRem">Save reminder</button></div>`);
  $('#saveRem').onclick=()=>{
    state.reminders.push({id:uid('rem'),text:$('#remText').value.trim(),date:$('#remDate').value,createdAt:nowISO(),sourceEntryId:entryId});
    save(); closeModal(); if(entryId) renderAll(); toast('Reminder created');
  };
}

function openProjectUpdateModal(text,entryId) {
  openModal('Project update','',`<div class="field"><label>Work item</label><select id="updWork" class="field-select">${state.workItems.map(w=>`<option value="${w.id}">${escapeHtml(w.title)}</option>`).join('')}</select></div><div class="field spaced-field"><label>Update</label><textarea id="updText" rows="4">${escapeHtml(text)}</textarea></div><div class="modal-actions"><button class="primary-button" id="saveUpd">Attach update</button></div>`);
  $('#saveUpd').onclick=()=>{
    state.projectUpdates.push({id:uid('upd'),workItemId:$('#updWork').value,text:$('#updText').value.trim(),createdAt:nowISO(),sourceEntryId:entryId});
    save(); closeModal(); if(entryId) renderAll(); toast('Project updated');
  };
}

function openLinkModal(text,entryId) {
  removeSelectionPopover();
  openModal('Link selection','',`<div class="selection-quote">“${escapeHtml(text)}”</div><div class="field"><label>Link to work item</label><select id="linkWork" class="field-select">${state.workItems.map(w=>`<option value="${w.id}">${escapeHtml(w.title)}</option>`).join('')}</select></div><div class="modal-actions"><button class="primary-button" id="saveLink">Link</button></div>`);
  $('#saveLink').onclick=()=>{
    state.projectUpdates.push({id:uid('link'),workItemId:$('#linkWork').value,text:`Linked notebook text: ${text}`,createdAt:nowISO(),sourceEntryId:entryId,linkOnly:true});
    save(); closeModal(); if(entryId) renderAll(); toast('Linked to work item');
  };
}
