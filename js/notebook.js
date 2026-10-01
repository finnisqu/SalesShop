function renderNotebook() {
  const keys = [...new Set([dateKey(), ...Object.keys(state.notebook)])].sort().reverse();
  if (!keys.includes(currentNotebookDate)) currentNotebookDate = keys[0];
  const entries = state.notebook[currentNotebookDate] || [];
  $('#view-notebook').innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Notebook</div><h1>Write first. Organize later.</h1><div class="page-subtitle">A partial record is still a useful record.</div></div><button class="secondary-button" id="todayBtn">Today</button></div>
    <div class="notebook-layout">
      <div class="notebook-days">${keys.map(k=>`<button class="day-button ${k===currentNotebookDate?'active':''}" data-date="${k}"><div class="day-label">${k===dateKey()?'Today':fmtDate(k,{weekday:'short',month:'short',day:'numeric'})}</div><div class="day-count">${(state.notebook[k]||[]).length} entries</div></button>`).join('')}</div>
      <div class="notebook-page">
        <div class="notebook-paper-head"><div class="notebook-date">${fmtDate(currentNotebookDate,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div><div class="notebook-caption">Everything here is searchable. Promote only what deserves structure.</div></div>
        <div class="notebook-composer">
          <textarea id="notebookInput" class="notebook-input" placeholder="What happened? What do you need to remember?"></textarea>
          <div class="notebook-actions"><button id="micBtn" class="mic-button">🎙 Voice note</button><button id="notebookSaveBtn" class="primary-button">Add to page</button></div>
        </div>
        <div class="notebook-entries">
          ${entries.length ? entries.map(e=>`<div class="notebook-entry" data-entry-id="${e.id}"><div class="entry-meta"><span>${fmtTimestamp(e.createdAt)}</span><span class="entry-source">${e.source==='voice'?'Voice note':'Note'}</span></div><div class="entry-text">${escapeHtml(e.text)}</div></div>`).join('') : '<div class="empty-page">A blank page is allowed.</div>'}
        </div>
      </div>
    </div>`;
  $$('.day-button', $('#view-notebook')).forEach(b => b.onclick=()=>{currentNotebookDate=b.dataset.date;renderNotebook();});
  $('#todayBtn').onclick=()=>{currentNotebookDate=dateKey();renderNotebook();};
  $('#notebookSaveBtn').onclick=()=>{ const val=$('#notebookInput').value.trim(); if(!val)return; addNotebookEntry(val,'typed',currentNotebookDate); $('#notebookInput').value=''; toast('Added to notebook'); };
  $('#micBtn').onclick=toggleSpeech;
  $$('.entry-text', $('#view-notebook')).forEach(el => {
    el.onmouseup = e => handleSelection(e, el.closest('.notebook-entry').dataset.entryId);
    el.oncontextmenu = e => { e.preventDefault(); handleSelection(e, el.closest('.notebook-entry').dataset.entryId, true); };
  });
}

function addNotebookEntry(text, source='typed', key=dateKey()) {
  if(!state.notebook[key]) state.notebook[key]=[];
  state.notebook[key].push({id:uid('note'), createdAt:nowISO(), text, source}); save(); renderAll();
}

function toggleSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return toast('Live browser dictation is not supported here. Typing still works.');
  const btn=$('#micBtn');
  if (speech) { speech.stop(); speech=null; btn?.classList.remove('recording'); btn && (btn.textContent='🎙 Voice note'); return; }
  speech = new SpeechRecognition(); speech.continuous=true; speech.interimResults=true; speech.lang='en-US';
  let final='';
  speech.onresult = e => { let interim=''; for(let i=e.resultIndex;i<e.results.length;i++){ const t=e.results[i][0].transcript; if(e.results[i].isFinal) final += t+' '; else interim += t; } $('#notebookInput').value=(final+interim).trim(); };
  speech.onend = () => { btn?.classList.remove('recording'); if(btn)btn.textContent='🎙 Voice note'; speech=null; };
  speech.onerror = () => toast('Microphone transcription stopped.');
  speech.start(); btn.classList.add('recording'); btn.textContent='■ Stop recording';
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
  openModal('Promote selection', 'Give this breadcrumb more structure', `
    <div style="background:var(--panel-soft);padding:11px;border-radius:9px;margin-bottom:14px;font-family:Georgia,serif">“${escapeHtml(text)}”</div>
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
  if(type==='project') state.workItems.push({id:uid('work'),title:text,company:'',stage:'New',due:'',amount:0,nextAction:'',lastTouchpoint:'',sourceEntryId:entryId});
  if(type==='update') { closeModal(); return openProjectUpdateModal(text,entryId); }
  save(); closeModal(); renderAll(); toast(`Promoted to ${type}`);
}

function openReminderModal(text,entryId) {
  openModal('Reminder','When should this come back?',`<div class="field"><label>Reminder</label><input id="remText" value="${escapeHtml(text)}"></div><div class="field" style="margin-top:12px"><label>Date</label><input id="remDate" type="date"></div><div class="modal-actions"><button class="primary-button" id="saveRem">Save reminder</button></div>`);
  $('#saveRem').onclick=()=>{ state.reminders.push({id:uid('rem'),text:$('#remText').value.trim(),date:$('#remDate').value,createdAt:nowISO(),sourceEntryId:entryId}); save(); closeModal(); renderAll(); toast('Reminder created'); };
}

function openProjectUpdateModal(text,entryId) {
  openModal('Project update','Attach this breadcrumb',`<div class="field"><label>Work item</label><select id="updWork" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:9px">${state.workItems.map(w=>`<option value="${w.id}">${escapeHtml(w.title)}</option>`).join('')}</select></div><div class="field" style="margin-top:12px"><label>Update</label><textarea id="updText" rows="4">${escapeHtml(text)}</textarea></div><div class="modal-actions"><button class="primary-button" id="saveUpd">Attach update</button></div>`);
  $('#saveUpd').onclick=()=>{ state.projectUpdates.push({id:uid('upd'),workItemId:$('#updWork').value,text:$('#updText').value.trim(),createdAt:nowISO(),sourceEntryId:entryId}); save(); closeModal(); renderAll(); toast('Project updated'); };
}

function openLinkModal(text,entryId) {
  removeSelectionPopover();
  openModal('Link selection','Connect the note without changing it',`<div style="background:var(--panel-soft);padding:11px;border-radius:9px;margin-bottom:14px">“${escapeHtml(text)}”</div><div class="field"><label>Link to work item</label><select id="linkWork" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:9px">${state.workItems.map(w=>`<option value="${w.id}">${escapeHtml(w.title)}</option>`).join('')}</select></div><div class="modal-actions"><button class="primary-button" id="saveLink">Link</button></div>`);
  $('#saveLink').onclick=()=>{ state.projectUpdates.push({id:uid('link'),workItemId:$('#linkWork').value,text:`Linked notebook text: ${text}`,createdAt:nowISO(),sourceEntryId:entryId,linkOnly:true}); save();closeModal();toast('Linked to work item'); };
}
