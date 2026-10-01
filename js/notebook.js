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
        <span class="notebook-toolbar-date">${isToday?'Today':fmtDate(currentNotebookDate,{weekday:'short',month:'short',day:'numeric'})}</span>
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
            ${entries.map(e=>`<div class="notebook-entry" data-entry-id="${e.id}">
              <div class="entry-time">${fmtTimestamp(e.createdAt)}</div>
              <div class="entry-text">${escapeHtml(e.text)}</div>
            </div>`).join('')}
          </div>
          <div class="notebook-writing-zone ${entries.length?'':'blank-page'}">
            <textarea data-notebook-input class="notebook-input" placeholder="Start writing…"></textarea>
            <div class="notebook-actions">
              <button data-mic class="mic-button">🎙 Voice</button>
              <button data-note-save class="paper-action">Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  bindNotebookSurface(root);
}

function bindNotebookSurface(root) {
  $('[data-history]', root)?.addEventListener('click', openNotebookHistory);
  $('[data-today]', root)?.addEventListener('click',()=>{ currentNotebookDate=dateKey(); renderAll(); });
  $('[data-note-save]', root)?.addEventListener('click',()=>saveNotebookDraft(root));
  $('[data-notebook-input]', root)?.addEventListener('keydown',e=>{
    if ((e.ctrlKey||e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveNotebookDraft(root); }
  });
  $('[data-mic]', root)?.addEventListener('click',()=>toggleSpeech(root));
  $$('.entry-text', root).forEach(el => {
    el.onmouseup = e => handleSelection(e, el.closest('.notebook-entry').dataset.entryId);
    el.oncontextmenu = e => { e.preventDefault(); handleSelection(e, el.closest('.notebook-entry').dataset.entryId, true); };
  });
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

function addNotebookEntry(text, source='typed', key=dateKey()) {
  if(!state.notebook[key]) state.notebook[key]=[];
  state.notebook[key].push({id:uid('note'), createdAt:nowISO(), text, source});
  save();
  renderAll();
}

function toggleSpeech(root) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return toast('Live browser dictation is not supported here. Typing still works.');
  const btn=$('[data-mic]', root); const input=$('[data-notebook-input]', root);
  if (speech) {
    speech.stop(); speech=null; speechTarget=null;
    btn?.classList.remove('recording'); if(btn)btn.textContent='🎙 Voice';
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
    btn?.classList.remove('recording'); if(btn)btn.textContent='🎙 Voice';
    speech=null; speechTarget=null;
  };
  speech.onerror = () => toast('Microphone transcription stopped.');
  speech.start();
  btn.classList.add('recording');
  btn.textContent='■ Stop';
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
  save(); closeModal(); renderAll(); toast(`Promoted to ${type}`);
}

function openReminderModal(text,entryId) {
  openModal('Reminder','',`<div class="field"><label>Reminder</label><input id="remText" value="${escapeHtml(text)}"></div><div class="field spaced-field"><label>Date</label><input id="remDate" type="date"></div><div class="modal-actions"><button class="primary-button" id="saveRem">Save reminder</button></div>`);
  $('#saveRem').onclick=()=>{ state.reminders.push({id:uid('rem'),text:$('#remText').value.trim(),date:$('#remDate').value,createdAt:nowISO(),sourceEntryId:entryId}); save(); closeModal(); renderAll(); toast('Reminder created'); };
}

function openProjectUpdateModal(text,entryId) {
  openModal('Project update','',`<div class="field"><label>Work item</label><select id="updWork" class="field-select">${state.workItems.map(w=>`<option value="${w.id}">${escapeHtml(w.title)}</option>`).join('')}</select></div><div class="field spaced-field"><label>Update</label><textarea id="updText" rows="4">${escapeHtml(text)}</textarea></div><div class="modal-actions"><button class="primary-button" id="saveUpd">Attach update</button></div>`);
  $('#saveUpd').onclick=()=>{ state.projectUpdates.push({id:uid('upd'),workItemId:$('#updWork').value,text:$('#updText').value.trim(),createdAt:nowISO(),sourceEntryId:entryId}); save(); closeModal(); renderAll(); toast('Project updated'); };
}

function openLinkModal(text,entryId) {
  removeSelectionPopover();
  openModal('Link selection','',`<div class="selection-quote">“${escapeHtml(text)}”</div><div class="field"><label>Link to work item</label><select id="linkWork" class="field-select">${state.workItems.map(w=>`<option value="${w.id}">${escapeHtml(w.title)}</option>`).join('')}</select></div><div class="modal-actions"><button class="primary-button" id="saveLink">Link</button></div>`);
  $('#saveLink').onclick=()=>{ state.projectUpdates.push({id:uid('link'),workItemId:$('#linkWork').value,text:`Linked notebook text: ${text}`,createdAt:nowISO(),sourceEntryId:entryId,linkOnly:true}); save();closeModal();toast('Linked to work item'); };
}
