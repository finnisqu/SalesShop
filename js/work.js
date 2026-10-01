function renderHome() {
  const layout = state.settings.workspaceLayout || 'stacked';
  const openCount = state.workItems.filter(w => !CLOSED_STAGES.has(w.stage)).length;
  const bidValue = state.workItems.filter(w => ['Bid Sent','Negotiation'].includes(w.stage)).reduce((s,w)=>s+Number(w.amount||0),0);
  const todayNotes = (state.notebook[dateKey()] || []).length;
  $('#view-home').innerHTML = `
    <div class="workspace-head">
      <div class="workspace-title-row">
        <h1>Work</h1>
        <span class="workspace-meta">${openCount} open · ${money(bidValue)} out · ${todayNotes} notes today</span>
      </div>
      <div class="workspace-controls" aria-label="Workspace layout">
        <button class="layout-button ${layout==='stacked'?'active':''}" data-layout="stacked" title="Stack board and notebook">Stacked</button>
        <button class="layout-button ${layout==='columns'?'active':''}" data-layout="columns" title="Board and notebook side by side">Columns</button>
      </div>
    </div>
    <div class="workspace-layout ${layout}">
      <section class="workspace-section board-section">
        <div class="section-line"><div><strong>Projects & quotes</strong><span>Whatever can be quoted</span></div><button class="text-button" data-go="board">Open board</button></div>
        <div id="homeBoardMount"></div>
      </section>
      <section class="workspace-section notebook-section">
        <div class="section-line"><div><strong>Notebook</strong><span>Write first. Organize later.</span></div><button class="text-button" data-go="notebook">Open notebook</button></div>
        <div id="homeNotebookMount"></div>
      </section>
    </div>`;

  renderBoardSurface($('#homeBoardMount'), {embedded:true});
  renderNotebookSurface($('#homeNotebookMount'), {embedded:true, prefix:'home'});
  $$('[data-layout]', $('#view-home')).forEach(b => b.onclick=()=>mutate(()=>state.settings.workspaceLayout=b.dataset.layout));
  $$('[data-go]', $('#view-home')).forEach(b => b.onclick=()=>showView(b.dataset.go));
}

function renderBoard() {
  $('#view-board').innerHTML = `
    <div class="page-head compact-head"><div><div class="eyebrow">Whatever can be quoted</div><h1>Board</h1><div class="page-subtitle">Drag the work. Fill in only what becomes useful.</div></div></div>
    <div id="fullBoardMount"></div>`;
  renderBoardSurface($('#fullBoardMount'), {embedded:false});
}

function renderBoardSurface(root, {embedded=false}={}) {
  if (!root) return;
  root.innerHTML = `<div class="board-wrap ${embedded?'embedded-board':''}"><div class="board">
    ${STAGES.map(stage => {
      const items = state.workItems.filter(w => w.stage === stage);
      const closed = CLOSED_STAGES.has(stage);
      return `<div class="board-column ${closed?'terminal-column':''}" data-stage="${stage}">
        <div class="column-head"><span class="column-title">${stage}</span><span class="column-count">${items.length}</span></div>
        <div class="card-stack">${items.map(workCardHtml).join('')}</div>
        <div class="add-card-row"><input class="add-card-input" data-add-stage="${stage}" placeholder="+ Add…" /></div>
      </div>`;
    }).join('')}
  </div></div>`;
  bindBoardSurface(root);
}

function bindBoardSurface(root) {
  $$('.work-card', root).forEach(card => {
    card.draggable = true;
    card.ondragstart = e => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', card.dataset.id); };
    card.ondragend = () => card.classList.remove('dragging');
    card.ondblclick = () => openWorkItem(card.dataset.id);
  });
  $$('.board-column', root).forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('dragover'); };
    col.ondragleave = () => col.classList.remove('dragover');
    col.ondrop = e => { e.preventDefault(); col.classList.remove('dragover'); const id=e.dataTransfer.getData('text/plain'); mutate(()=>{ const w=state.workItems.find(x=>x.id===id); if(w)w.stage=col.dataset.stage; }); };
  });
  $$('.add-card-input', root).forEach(inp => inp.onkeydown = e => {
    if (e.key === 'Enter' && inp.value.trim()) {
      const title = inp.value.trim();
      mutate(()=>state.workItems.push({id:uid('work'),title,company:'',stage:inp.dataset.addStage,due:'',amount:0,nextAction:'',lastTouchpoint:''}));
      toast('Card added');
    }
  });
}

function workCardHtml(w) {
  return `<div class="work-card" data-id="${w.id}">
    <div class="work-card-title">${escapeHtml(w.title)}</div>
    ${w.company ? `<div class="work-card-company">${escapeHtml(w.company)}</div>` : ''}
    <div class="work-card-facts">
      ${w.amount ? `<span>${money(w.amount)}</span>`:''}
      ${w.due ? `<span>Due ${fmtDate(w.due)}</span>`:''}
      ${w.lastTouchpoint ? `<span>Touchpoint ${fmtDate(w.lastTouchpoint)}</span>`:''}
    </div>
    ${w.nextAction ? `<div class="work-card-next">${escapeHtml(w.nextAction)}</div>`:''}
  </div>`;
}

function openWorkItem(id) {
  const w = state.workItems.find(x=>x.id===id); if(!w)return;
  openModal('Work item', w.title, `
    <div class="form-grid">
      <div class="field"><label>Name</label><input id="wiTitle" value="${escapeHtml(w.title)}"></div>
      <div class="field"><label>Company</label><input id="wiCompany" value="${escapeHtml(w.company||'')}"></div>
      <div class="field"><label>Stage</label><select id="wiStage" class="field-select">${STAGES.map(s=>`<option ${s===w.stage?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Due</label><input id="wiDue" type="date" value="${w.due||''}"></div>
      <div class="field"><label>Value</label><input id="wiAmount" type="number" value="${w.amount||''}"></div>
      <div class="field"><label>Next action</label><input id="wiNext" value="${escapeHtml(w.nextAction||'')}"></div>
    </div>
    <div class="modal-actions"><button class="secondary-button" id="wiQuote">Create quote</button><button class="primary-button" id="wiSave">Save</button></div>`);
  $('#wiSave').onclick=()=>{ mutate(()=>Object.assign(w,{title:$('#wiTitle').value.trim()||w.title,company:$('#wiCompany').value.trim(),stage:$('#wiStage').value,due:$('#wiDue').value,amount:Number($('#wiAmount').value||0),nextAction:$('#wiNext').value.trim()})); closeModal(); };
  $('#wiQuote').onclick=()=>{ createQuoteFromWorkItem(w); closeModal(); showView('quotes'); };
}
