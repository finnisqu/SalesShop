function renderMemory() {
  $('#view-memory').innerHTML=`
    <div class="page-head"><div><div class="eyebrow">Breadcrumb CRM</div><h1>Memory</h1><div class="page-subtitle">The database is here when you want it, but it does not run the experience.</div></div></div>
    <div class="memory-grid">
      ${memoryPanel('Contacts',state.contacts.map(c=>({title:c.name,meta:[c.company,c.detail].filter(Boolean).join(' · ')||'Partial contact'})))}
      ${memoryPanel('Companies',state.companies.map(c=>({title:c.name||c.domain||'Untitled company',meta:`${accountStage(c)}${c.domain?` · ${c.domain}`:''}`})))}
      ${memoryPanel('Deals',state.crmDeals.map(d=>({title:d.name,meta:`${d.stage} · ${money(d.amount)}`})))}
      ${memoryPanel('Touchpoints',state.touchpoints.map(t=>({title:t.text,meta:new Date(t.createdAt).toLocaleString()})))}
      ${memoryPanel('Reminders',state.reminders.map(r=>({title:r.text,meta:r.date?`Due ${fmtDate(r.date)}`:'No date required'})))}
      ${memoryPanel('Project updates',state.projectUpdates.map(u=>({title:u.text,meta:state.workItems.find(w=>w.id===u.workItemId)?.title||'Linked breadcrumb'})))}
    </div>`;
}
function memoryPanel(title,items){ return `<div class="panel"><div class="panel-head"><h2>${title}</h2><span class="helper">${items.length}</span></div><div class="memory-list">${items.length?items.slice().reverse().map(i=>`<div class="memory-item"><div class="memory-title">${escapeHtml(i.title)}</div><div class="memory-meta">${escapeHtml(i.meta||'')}</div></div>`).join(''):'<div class="panel-body helper">Nothing here yet.</div>'}</div></div>`; }

function openModal(eyebrow,title,bodyHtml) {
  const tpl=$('#modalTemplate').content.cloneNode(true); $('.modal-eyebrow',tpl).textContent=eyebrow; $('.modal-title',tpl).textContent=title; $('.modal-body',tpl).innerHTML=bodyHtml; $('#modalRoot').innerHTML=''; $('#modalRoot').appendChild(tpl);
  $('.modal-close').onclick=closeModal; $('.modal-backdrop').onclick=e=>{if(e.target.classList.contains('modal-backdrop'))closeModal();};
}
function closeModal(){ $('#modalRoot').innerHTML=''; }

function openQuickNew() {
  openModal('Quick create','What do you want to start?',`<div class="promote-grid"><button class="promote-option" id="newWorkQuick"><div class="promote-title">Something to quote</div><div class="promote-desc">Start with only a name. Add the rest later.</div></button><button class="promote-option" id="newQuoteQuick"><div class="promote-title">Quote</div><div class="promote-desc">Start a blank, unrestricted quote.</div></button><button class="promote-option" id="newNoteQuick"><div class="promote-title">Notebook entry</div><div class="promote-desc">Capture a thought with no structure.</div></button><button class="promote-option" id="newTouchQuick"><div class="promote-title">Touchpoint</div><div class="promote-desc">Record only that contact happened.</div></button></div>`);
  $('#newWorkQuick').onclick=()=>{ closeModal(); state.settings.boardMode='projects'; save(); showView('board'); setTimeout(()=>$('.add-card-input[data-add-stage="Discovery"]')?.focus(),0); };
  $('#newQuoteQuick').onclick=()=>{ closeModal(); showView('quotes'); createBlankQuote(); };
  $('#newNoteQuick').onclick=()=>{ closeModal(); showView('notebook'); setTimeout(()=>document.querySelector('[data-notebook-input]')?.focus(),0); };
  $('#newTouchQuick').onclick=()=>{ closeModal(); openModal('Touchpoint','Who did you talk with?',`<div class="field"><label>Person or company</label><input id="quickTouch" placeholder="John at ABC"></div><div class="modal-actions"><button class="primary-button" id="saveQuickTouch">Record touchpoint</button></div>`); $('#saveQuickTouch').onclick=()=>{ const text=$('#quickTouch').value.trim(); if(!text)return; state.touchpoints.push({id:uid('touch'),text,createdAt:nowISO()});save();closeModal();renderAll();toast('Touchpoint recorded'); }; };
}

function indexEverything() {
  const rows=[];
  state.workItems.forEach(w=>rows.push({type:'Project',title:w.title,text:`${w.company} ${w.stage} ${w.nextAction||''}`,go:()=>{state.settings.boardMode='projects';save();showView('board');setTimeout(()=>openWorkItem(w.id),0);}}));
  state.quotes.forEach(q=>rows.push({type:'Quote',title:q.title||q.quoteNumber,text:`${q.customer} ${q.quoteNumber} ${money(quoteTotal(q))}`,go:()=>{currentQuoteId=q.id;showView('quotes');}}));
  Object.entries(state.notebook).forEach(([d,entries])=>entries.forEach(n=>rows.push({type:'Notebook',title:fmtDate(d,{month:'short',day:'numeric',year:'numeric'}),text:n.text,go:()=>{currentNotebookDate=d;showView('notebook');}})));
  state.contacts.forEach(c=>rows.push({type:'Contact',title:c.name,text:c.company||'',go:()=>showView('memory')}));
  state.companies.forEach(c=>rows.push({type:'Company',title:c.name||c.domain||'Untitled company',text:`${c.domain||''} ${accountStage(c)}`,go:()=>{state.settings.boardMode='accounts';save();showView('board');setTimeout(()=>openAccount(c.id),0);}}));
  state.crmDeals.forEach(d=>rows.push({type:'Deal',title:d.name,text:`${d.stage} ${money(d.amount)}`,go:()=>{state.settings.boardMode='accounts';save();showView('board');setTimeout(()=>openAccount(d.companyId),0);}}));
  state.touchpoints.forEach(t=>rows.push({type:'Touchpoint',title:t.text,text:new Date(t.createdAt).toLocaleDateString(),go:()=>showView('memory')}));
  state.reminders.forEach(r=>rows.push({type:'Reminder',title:r.text,text:r.date||'',go:()=>showView('memory')}));
  return rows;
}

function renderCommandResults(query) {
  const box=$('#commandResults'); const q=query.trim().toLowerCase();
  if(!q){box.classList.add('hidden');box.innerHTML='';return;}
  const words=q.split(/\s+/);
  const matches=indexEverything().map(row=>({row,score:words.reduce((s,w)=>s+((`${row.title} ${row.text}`).toLowerCase().includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
  box.innerHTML=`<div class="command-result capture-result" data-capture="1"><div class="command-result-type">Remember</div><div><div class="command-result-title">Add “${escapeHtml(query)}” to today’s notebook</div><div class="command-result-text">Press Enter to capture it as a breadcrumb.</div></div></div>${matches.map((m,i)=>`<div class="command-result" data-result-index="${i}"><div class="command-result-type">${m.row.type}</div><div><div class="command-result-title">${escapeHtml(m.row.title)}</div><div class="command-result-text">${escapeHtml(m.row.text).slice(0,130)}</div></div></div>`).join('')}`;
  box.classList.remove('hidden');
  $('[data-capture]',box).onclick=()=>captureCommand(query);
  $$('[data-result-index]',box).forEach(el=>el.onclick=()=>{matches[Number(el.dataset.resultIndex)].row.go();box.classList.add('hidden');$('#commandInput').value='';});
}
function captureCommand(text){ addNotebookEntry(text,'typed'); $('#commandInput').value=''; $('#commandResults').classList.add('hidden'); toast('Remembered'); }
