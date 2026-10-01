function renderHome() {
  const open = state.workItems.filter(w => w.stage !== 'Awarded');
  const sent = state.workItems.filter(w => ['Sent','Decision'].includes(w.stage)).reduce((s,w)=>s+Number(w.amount||0),0);
  const quoted = state.quotes.reduce((s,q)=>s+quoteTotal(q),0);
  const attention = state.workItems.filter(w => w.nextAction).slice(0,5);
  const todayNotes = state.notebook[dateKey()] || [];
  $('#view-home').innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Working memory</div><h1>Good morning.</h1><div class="page-subtitle">Capture first. Structure only when it helps.</div></div>
      <button class="secondary-button" data-go="notebook">Open today’s page</button>
    </div>
    <div class="home-grid">
      <div class="panel">
        <div class="panel-head"><h2>What needs attention</h2><button class="text-button" data-go="board">View board</button></div>
        <div class="panel-body">
          <div class="stat-row">
            <div class="stat"><div class="stat-value">${open.length}</div><div class="stat-label">open work items</div></div>
            <div class="stat"><div class="stat-value">${money(sent)}</div><div class="stat-label">awaiting decision</div></div>
            <div class="stat"><div class="stat-value">${money(quoted)}</div><div class="stat-label">quote book</div></div>
          </div>
          <div class="attention-list">
            ${attention.map((w,i)=>`<div class="attention-item"><div><div class="attention-title">${escapeHtml(w.title)}</div><div class="attention-meta">${escapeHtml(w.company || 'No company yet')} · ${escapeHtml(w.nextAction)}</div></div><span class="pill ${i===0?'amber':''}">${escapeHtml(w.stage)}</span></div>`).join('') || '<div class="helper">Nothing pressing.</div>'}
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Scratchpad</h2><span class="helper">${todayNotes.length} entries today</span></div>
        <div class="panel-body">
          <textarea id="homeQuickNote" class="quick-note" placeholder="Write anything. It does not have to belong anywhere yet."></textarea>
          <div class="quick-note-actions"><span class="helper">Saved to today’s notebook page</span><button id="homeSaveNote" class="primary-button">Remember</button></div>
        </div>
      </div>
    </div>`;
  $$('[data-go]', $('#view-home')).forEach(b => b.onclick = () => showView(b.dataset.go));
  $('#homeSaveNote').onclick = () => {
    const text = $('#homeQuickNote').value.trim(); if (!text) return;
    addNotebookEntry(text, 'typed'); $('#homeQuickNote').value=''; toast('Added to today’s notebook');
  };
}

function renderBoard() {
  $('#view-board').innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Whatever can be quoted</div><h1>Board</h1><div class="page-subtitle">Cards can begin almost empty and collect breadcrumbs over time.</div></div></div>
    <div class="board-wrap"><div class="board">
      ${STAGES.map(stage => {
        const items = state.workItems.filter(w => w.stage === stage);
        return `<div class="board-column" data-stage="${stage}">
          <div class="column-head"><span class="column-title">${stage}</span><span class="column-count">${items.length}</span></div>
          <div class="card-stack">${items.map(workCardHtml).join('')}</div>
          <div class="add-card-row"><input class="add-card-input" data-add-stage="${stage}" placeholder="+ Add something…" /></div>
        </div>`;
      }).join('')}
    </div></div>`;

  $$('.work-card', $('#view-board')).forEach(card => {
    card.draggable = true;
    card.ondragstart = e => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', card.dataset.id); };
    card.ondragend = () => card.classList.remove('dragging');
    card.ondblclick = () => openWorkItem(card.dataset.id);
  });
  $$('.board-column', $('#view-board')).forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('dragover'); };
    col.ondragleave = () => col.classList.remove('dragover');
    col.ondrop = e => { e.preventDefault(); col.classList.remove('dragover'); const id=e.dataTransfer.getData('text/plain'); mutate(()=>{ const w=state.workItems.find(x=>x.id===id); if(w)w.stage=col.dataset.stage; }); };
  });
  $$('.add-card-input', $('#view-board')).forEach(inp => inp.onkeydown = e => {
    if (e.key === 'Enter' && inp.value.trim()) {
      const title = inp.value.trim(); mutate(()=>state.workItems.push({id:uid('work'),title,company:'',stage:inp.dataset.addStage,due:'',amount:0,nextAction:'',lastTouchpoint:''}));
      toast('Card added');
    }
  });
}

function workCardHtml(w) {
  return `<div class="work-card" data-id="${w.id}">
    <div class="work-card-title">${escapeHtml(w.title)}</div>
    <div class="work-card-company">${escapeHtml(w.company || 'Loose card — no company yet')}</div>
    ${w.amount ? `<div class="work-card-row"><span>Value</span><strong>${money(w.amount)}</strong></div>`:''}
    ${w.due ? `<div class="work-card-row"><span>Due</span><span>${fmtDate(w.due)}</span></div>`:''}
    ${w.lastTouchpoint ? `<div class="work-card-row"><span>Last touchpoint</span><span>${fmtDate(w.lastTouchpoint)}</span></div>`:''}
    ${w.nextAction ? `<div class="work-card-next"><strong>Next:</strong> ${escapeHtml(w.nextAction)}</div>`:''}
  </div>`;
}

function openWorkItem(id) {
  const w = state.workItems.find(x=>x.id===id); if(!w)return;
  openModal('Work item', w.title, `
    <div class="form-grid">
      <div class="field"><label>Name</label><input id="wiTitle" value="${escapeHtml(w.title)}"></div>
      <div class="field"><label>Company</label><input id="wiCompany" value="${escapeHtml(w.company||'')}"></div>
      <div class="field"><label>Stage</label><select id="wiStage" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:9px">${STAGES.map(s=>`<option ${s===w.stage?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Due</label><input id="wiDue" type="date" value="${w.due||''}"></div>
      <div class="field"><label>Value</label><input id="wiAmount" type="number" value="${w.amount||''}"></div>
      <div class="field"><label>Next action</label><input id="wiNext" value="${escapeHtml(w.nextAction||'')}"></div>
    </div>
    <div class="modal-actions"><button class="secondary-button" id="wiQuote">Create quote</button><button class="primary-button" id="wiSave">Save</button></div>`);
  $('#wiSave').onclick=()=>{ mutate(()=>Object.assign(w,{title:$('#wiTitle').value.trim()||w.title,company:$('#wiCompany').value.trim(),stage:$('#wiStage').value,due:$('#wiDue').value,amount:Number($('#wiAmount').value||0),nextAction:$('#wiNext').value.trim()})); closeModal(); };
  $('#wiQuote').onclick=()=>{ createQuoteFromWorkItem(w); closeModal(); showView('quotes'); };
}
