let draftSelectionText = '';
let currentNotebookPageId = null;

function notebookPageState() {
  state.settings.activeNotebookPageByDate ||= {};
  return state.settings.activeNotebookPageByDate;
}

function ensureNotebookPage(key) {
  state.notebook[key] ||= [];
  const entries = state.notebook[key];
  const activeByDate = notebookPageState();
  let changed = false;

  if (entries.some(entry => !entry.pageId)) {
    const legacyPageId = `page_${key}_legacy`;
    entries.forEach(entry => {
      if (!entry.pageId) entry.pageId = legacyPageId;
    });
    changed = true;
  }

  const pageIds = [...new Set(entries.map(entry => entry.pageId).filter(Boolean))];
  if (!activeByDate[key]) {
    activeByDate[key] = pageIds[pageIds.length - 1] || uid('page');
    changed = true;
  }

  const validIds = new Set([...pageIds, activeByDate[key]]);
  if (!currentNotebookPageId || !validIds.has(currentNotebookPageId)) {
    currentNotebookPageId = activeByDate[key];
  }

  if (changed) save();
  return currentNotebookPageId;
}

function notebookEntriesForPage(key, pageId) {
  return (state.notebook[key] || []).filter(entry => entry.pageId === pageId);
}

function appendNotebookEntry(text, source='typed', key=dateKey(), pageId=null, extra={}) {
  state.notebook[key] ||= [];
  const targetPageId = pageId || ensureNotebookPage(key);
  const entry = {id:uid('note'), createdAt:nowISO(), text, source, pageId:targetPageId, ...extra};
  state.notebook[key].push(entry);
  return entry;
}

function renderNotebook() {
  const placeholder = $('#view-notebook');
  if (placeholder) placeholder.innerHTML = '';
  renderNotebookSurface($('#notebookDock'));
}

function renderNotebookSurface(root) {
  if(!root) return;
  const keys = [...new Set([dateKey(), ...Object.keys(state.notebook)])].sort().reverse();
  if (!keys.includes(currentNotebookDate)) currentNotebookDate = dateKey();
  const pageId = ensureNotebookPage(currentNotebookDate);
  const entries = notebookEntriesForPage(currentNotebookDate, pageId);
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
          <button class="notebook-tool notebook-new-page" data-new-page>+ New Page</button>
          <button class="notebook-tool" data-history>History</button>
        </div>
      </div>
      <div class="notebook-page">
        <div class="notebook-paper-head">
          <div class="notebook-date">${fmtDate(currentNotebookDate,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div>
        </div>
        <div class="notebook-page-body">
          <div class="notebook-entries ${entries.length > 3 ? 'has-scrollback' : ''}" data-notebook-entries>
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
  requestAnimationFrame(()=>scrollNotebookEntriesToBottom(root));
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
  $('[data-new-page]', root)?.addEventListener('click',()=>startFreshNotebookPage(root));
  $('[data-today]', root)?.addEventListener('click',()=>{
    currentNotebookDate=dateKey();
    currentNotebookPageId=notebookPageState()[currentNotebookDate] || null;
    renderAll();
  });

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
  $('[data-file-input]', root)?.addEventListener('change', e => handleNotebookFiles([...e.target.files], currentNotebookDate, currentNotebookPageId));

  $$('.entry-text', root).forEach(el => {
    el.onmouseup = e => handleSelection(e, el.closest('.notebook-entry').dataset.entryId);
    el.oncontextmenu = e => { e.preventDefault(); handleSelection(e, el.closest('.notebook-entry').dataset.entryId, true); };
  });
}

function scrollNotebookEntriesToBottom(root) {
  const entries = $('[data-notebook-entries]', root);
  if (entries) entries.scrollTop = entries.scrollHeight;
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
  appendNotebookEntry(val,'typed',currentNotebookDate,currentNotebookPageId);
  save();
  renderAll();
  toast('Added');
}

function startFreshNotebookPage(root) {
  const input=$('[data-notebook-input]', root);
  const draft=input?.value.trim();
  if (draft) appendNotebookEntry(draft,'typed',currentNotebookDate,currentNotebookPageId);

  currentNotebookDate = dateKey();
  state.notebook[currentNotebookDate] ||= [];
  const newPageId = uid('page');
  notebookPageState()[currentNotebookDate] = newPageId;
  currentNotebookPageId = newPageId;
  save();
  renderAll();
  setTimeout(()=>document.querySelector('[data-notebook-input]')?.focus(),0);
  toast('Fresh page');
}

function notebookHistoryRows() {
  const rows=[];
  const activeByDate=notebookPageState();
  const keys=[...new Set([dateKey(),...Object.keys(state.notebook),...Object.keys(activeByDate)])].sort().reverse();
  keys.forEach(key=>{
    const entries=state.notebook[key]||[];
    const ids=[...new Set(entries.map(e=>e.pageId).filter(Boolean))];
    if(activeByDate[key]&&!ids.includes(activeByDate[key])) ids.push(activeByDate[key]);
    ids.forEach((pageId,index)=>{
      const pageEntries=entries.filter(e=>e.pageId===pageId);
      rows.push({
        key,
        pageId,
        pageNumber:index+1,
        count:pageEntries.length,
        lastAt:pageEntries[pageEntries.length-1]?.createdAt || '',
        active:activeByDate[key]===pageId
      });
    });
  });
  return rows;
}

function openNotebookHistory() {
  const rows=notebookHistoryRows();
  openModal('Notebook','History',`
    <div class="history-list">
      ${rows.map(row=>`<button class="history-row ${row.key===currentNotebookDate&&row.pageId===currentNotebookPageId?'active':''}" data-history-date="${row.key}" data-history-page="${row.pageId}">
        <span>${row.key===dateKey()?'Today':fmtDate(row.key,{weekday:'short',month:'short',day:'numeric',year:'numeric'})} · Page ${row.pageNumber}${row.active?' · current':''}</span>
        <span>${row.count}</span>
      </button>`).join('')}
    </div>`);
  $$('[data-history-page]').forEach(btn=>btn.onclick=()=>{
    currentNotebookDate=btn.dataset.historyDate;
    currentNotebookPageId=btn.dataset.historyPage;
    closeModal();
    renderAll();
  });
}

function addNotebookEntry(text, source='typed', key=dateKey(), extra={}) {
  const previousDate=currentNotebookDate;
  const previousPage=currentNotebookPageId;
  const activePage=notebookPageState()[key] || null;
  currentNotebookDate=key;
  currentNotebookPageId=activePage;
  const pageId=ensureNotebookPage(key);
  appendNotebookEntry(text,source,key,pageId,extra);
  currentNotebookDate=previousDate;
  currentNotebookPageId=previousPage;
  save();
  renderAll();
}

async function handleNotebookFiles(files, key=dateKey(), pageId=null) {
  if (!files.length) return;
  state.notebook[key] ||= [];
  const targetPageId=pageId || ensureNotebookPage(key);
  let oversized = 0;
  for (const file of files) {
    let dataUrl = '';
    if (file.size <= 900 * 1024) {
      try { dataUrl = await readFileAsDataURL(file); } catch {}
    } else {
      oversized += 1;
    }
    appendNotebookEntry(file.name,'attachment',key,targetPageId,{
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
