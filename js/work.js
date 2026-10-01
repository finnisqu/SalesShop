function renderHome() {
  const legacy = $('#view-home');
  if (legacy) legacy.innerHTML = '';
}

function renderBoard() {
  $('#view-board').innerHTML = `<div id="fullBoardMount" class="board-page"></div>`;
  renderBoardSurface($('#fullBoardMount'));
}

function renderBoardSurface(root) {
  if (!root) return;
  const collapsed = new Set(state.settings.collapsedStages || []);
  root.innerHTML = `<div class="board-wrap"><div class="board">
    ${STAGES.map(stage => {
      const items = state.workItems.filter(w => w.stage === stage);
      const isCollapsed = collapsed.has(stage);
      return `<div class="board-column ${isCollapsed?'collapsed':''}" data-stage="${stage}">
        <button class="column-head" data-toggle-stage="${stage}" title="${isCollapsed?'Open':'Collapse'} ${stage}">
          <span class="column-title">${stage}</span>
          <span class="column-count">${items.length}</span>
          <span class="column-chevron">${isCollapsed?'›':'‹'}</span>
        </button>
        <div class="column-body">
          <div class="card-stack">${items.map(workCardHtml).join('')}</div>
          <div class="add-card-row"><input class="add-card-input" data-add-stage="${stage}" placeholder="+ Add" /></div>
        </div>
      </div>`;
    }).join('')}
  </div></div>`;
  bindBoardSurface(root);
}

function bindBoardSurface(root) {
  $$('[data-toggle-stage]', root).forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const stage = btn.dataset.toggleStage;
      mutate(()=>{
        const list = new Set(state.settings.collapsedStages || []);
        list.has(stage) ? list.delete(stage) : list.add(stage);
        state.settings.collapsedStages = [...list];
      });
    };
  });

  $$('.work-card', root).forEach(card => {
    card.draggable = true;
    card.ondragstart = e => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', card.dataset.id); };
    card.ondragend = () => card.classList.remove('dragging');
    card.ondblclick = () => openWorkItem(card.dataset.id);
  });

  $$('.board-column', root).forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('dragover'); };
    col.ondragleave = () => col.classList.remove('dragover');
    col.ondrop = e => {
      e.preventDefault();
      col.classList.remove('dragover');
      const id=e.dataTransfer.getData('text/plain');
      mutate(()=>{ const w=state.workItems.find(x=>x.id===id); if(w)w.stage=col.dataset.stage; });
    };
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
  const hasDetails = !!(w.company || w.amount || w.due || w.lastTouchpoint || w.nextAction);
  return `<div class="work-card ${hasDetails?'has-details':''}" data-id="${w.id}">
    <div class="work-card-face"><span class="work-card-title">${escapeHtml(w.title)}</span></div>
    ${hasDetails ? `<div class="work-card-reveal">
      ${w.company ? `<div class="work-card-company">${escapeHtml(w.company)}</div>` : ''}
      <div class="work-card-facts">
        ${w.amount ? `<span>${money(w.amount)}</span>`:''}
        ${w.due ? `<span>Due ${fmtDate(w.due)}</span>`:''}
        ${w.lastTouchpoint ? `<span>Touchpoint ${fmtDate(w.lastTouchpoint)}</span>`:''}
      </div>
      ${w.nextAction ? `<div class="work-card-next">${escapeHtml(w.nextAction)}</div>`:''}
    </div>` : ''}
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
  $('#wiSave').onclick=()=>{
    mutate(()=>Object.assign(w,{title:$('#wiTitle').value.trim()||w.title,company:$('#wiCompany').value.trim(),stage:$('#wiStage').value,due:$('#wiDue').value,amount:Number($('#wiAmount').value||0),nextAction:$('#wiNext').value.trim()}));
    closeModal();
  };
  $('#wiQuote').onclick=()=>{ createQuoteFromWorkItem(w); closeModal(); showView('quotes'); };
}
