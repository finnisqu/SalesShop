function renderHome() {
  const legacy = $('#view-home');
  if (legacy) legacy.innerHTML = '';
}

function renderBoard() {
  const mode = state.settings.boardMode || 'projects';
  $('#view-board').innerHTML = `
    <div class="board-mode-bar">
      <div class="board-mode-switch" aria-label="Board view">
        <button class="board-mode-button ${mode==='projects'?'active':''}" data-board-mode="projects">Projects</button>
        <button class="board-mode-button ${mode==='accounts'?'active':''}" data-board-mode="accounts">Accounts</button>
      </div>
      ${mode==='accounts' ? '<span class="board-mode-note">Stages are inferred from CRM breadcrumbs unless overridden.</span>' : ''}
    </div>
    <div id="fullBoardMount" class="board-page"></div>`;

  $$('[data-board-mode]', $('#view-board')).forEach(btn=>btn.onclick=()=>mutate(()=>state.settings.boardMode=btn.dataset.boardMode));
  if (mode === 'accounts') renderAccountBoardSurface($('#fullBoardMount'));
  else renderBoardSurface($('#fullBoardMount'));
}

/* ---------------- Project board ---------------- */
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

/* ---------------- Account board ---------------- */
function renderAccountBoardSurface(root) {
  if (!root) return;
  const collapsed = new Set(state.settings.collapsedAccountStages || []);
  root.innerHTML = `<div class="board-wrap account-board-wrap"><div class="board account-board">
    ${ACCOUNT_STAGES.map(stage => {
      const companies = state.companies.filter(c => accountStage(c) === stage);
      const isCollapsed = collapsed.has(stage);
      return `<div class="board-column account-column ${isCollapsed?'collapsed':''}" data-account-stage="${stage}">
        <button class="column-head" data-toggle-account-stage="${stage}" title="${isCollapsed?'Open':'Collapse'} ${stage}">
          <span class="column-title">${stage}</span>
          <span class="column-count">${companies.length}</span>
          <span class="column-chevron">${isCollapsed?'›':'‹'}</span>
        </button>
        <div class="column-body">
          <div class="card-stack">${companies.map(accountCardHtml).join('')}</div>
          <div class="add-card-row"><input class="add-card-input" data-add-account-stage="${stage}" placeholder="+ Add company" /></div>
        </div>
      </div>`;
    }).join('')}
  </div></div>`;
  bindAccountBoard(root);
}

function bindAccountBoard(root) {
  $$('[data-toggle-account-stage]', root).forEach(btn=>btn.onclick=e=>{
    e.stopPropagation();
    const stage=btn.dataset.toggleAccountStage;
    mutate(()=>{
      const set=new Set(state.settings.collapsedAccountStages||[]);
      set.has(stage)?set.delete(stage):set.add(stage);
      state.settings.collapsedAccountStages=[...set];
    });
  });

  $$('.account-card', root).forEach(card=>{
    card.draggable=true;
    card.ondragstart=e=>{ card.classList.add('dragging'); e.dataTransfer.setData('text/plain',card.dataset.companyId); };
    card.ondragend=()=>card.classList.remove('dragging');
    card.ondblclick=()=>openAccount(card.dataset.companyId);
  });

  $$('.account-column', root).forEach(col=>{
    col.ondragover=e=>{e.preventDefault();col.classList.add('dragover');};
    col.ondragleave=()=>col.classList.remove('dragover');
    col.ondrop=e=>{
      e.preventDefault(); col.classList.remove('dragover');
      const id=e.dataTransfer.getData('text/plain');
      mutate(()=>{ const company=state.companies.find(c=>c.id===id); if(company) company.accountStageOverride=col.dataset.accountStage; });
      toast('Account stage overridden');
    };
  });

  $$('[data-add-account-stage]', root).forEach(inp=>inp.onkeydown=e=>{
    if(e.key==='Enter'&&inp.value.trim()){
      const name=inp.value.trim();
      mutate(()=>state.companies.push({id:uid('company'),name,accountStageOverride:inp.dataset.addAccountStage==='Discovery'?'':inp.dataset.addAccountStage}));
      toast('Company added');
    }
  });
}

function accountStage(company) {
  if (company.accountStageOverride && ACCOUNT_STAGES.includes(company.accountStageOverride)) return company.accountStageOverride;

  const deals = accountDeals(company);
  const projects = company.source === 'hubspot' ? [] : accountProjects(company);
  const quotes = company.source === 'hubspot' ? [] : accountQuotes(company);
  const lastTouch = latestAccountTouch(company);
  const stale = lastTouch ? monthsSince(lastTouch) >= 6 : false;

  const activeWon = deals.some(d=>d.stage==='Closed Won (Active)') || projects.some(p=>p.stage==='Closed Won' && !p.completedAt);
  const recentComplete = deals.some(d=>d.stage==='Closed Won (Complete)' && d.closeDate && monthsSince(d.closeDate)<6);
  const anyWon = deals.some(d=>String(d.stage).startsWith('Closed Won')) || projects.some(p=>p.stage==='Closed Won');
  const quoted = deals.some(d=>['Bid Sent','Negotiation','Closed Won (Active)','Closed Won (Complete)','Closed Lost','Discarded'].includes(d.stage)) ||
    projects.some(p=>['Bid Sent','Negotiation','Closed Won','Closed Lost','Discarded'].includes(p.stage)) || quotes.length>0;
  const connected = !!(company.lastEngagement || company.lastContacted || accountTouchpoints(company).length);
  const outreach = !!company.outreachAt;
  const hadRelationship = connected || outreach || quoted || anyWon;

  if (activeWon || recentComplete) return 'Active';
  if (stale && hadRelationship) return 'Cold';
  if (anyWon) return 'Won';
  if (quoted) return 'Quoted';
  if (connected) return 'Connected';
  if (outreach) return 'Outreach';
  return 'Discovery';
}

function accountDeals(company) {
  return (state.crmDeals||[]).filter(d=>d.companyId===company.id);
}
function accountProjects(company) {
  const name=(company.name||'').trim().toLowerCase();
  return state.workItems.filter(w=>w.companyId===company.id || (!!name && (w.company||'').trim().toLowerCase()===name));
}
function accountQuotes(company) {
  const name=(company.name||'').trim().toLowerCase();
  return state.quotes.filter(q=>!!name && (q.customer||'').trim().toLowerCase()===name);
}
function accountTouchpoints(company) {
  const name=(company.name||'').trim().toLowerCase();
  return (state.touchpoints||[]).filter(t=>t.companyId===company.id || (!!name && (t.company||'').trim().toLowerCase()===name));
}
function latestAccountTouch(company) {
  const values=[company.lastEngagement,company.lastContacted,company.lastActivity,...accountTouchpoints(company).map(t=>t.createdAt)].filter(Boolean);
  if(!values.length)return '';
  return values.sort((a,b)=>new Date(b)-new Date(a))[0];
}
function monthsSince(value) {
  if(!value)return Infinity;
  const then=new Date(value); const now=new Date();
  return (now-then)/(1000*60*60*24*30.4375);
}
function featuredAccountDeal(company) {
  const deals=accountDeals(company);
  const priority=['Closed Won (Active)','Negotiation','Bid Sent','Closed Won (Complete)','Closed Lost','Discarded'];
  return [...deals].sort((a,b)=>priority.indexOf(a.stage)-priority.indexOf(b.stage))[0] || null;
}
function accountReason(company) {
  const stage=accountStage(company); const deal=featuredAccountDeal(company); const touch=latestAccountTouch(company);
  if(company.accountStageOverride) return `Manual override · ${stage}`;
  if(stage==='Active'&&deal) return `${deal.name} · ${deal.stage}`;
  if(stage==='Cold'&&touch) return `Last activity ${fmtDate(touch,{month:'short',day:'numeric',year:'numeric'})}`;
  if(stage==='Quoted'&&deal) return `${deal.name} · ${deal.stage}`;
  if(stage==='Connected'&&touch) return `Last touch ${fmtDate(touch,{month:'short',day:'numeric'})}`;
  if(stage==='Outreach') return 'Outreach recorded; no connection yet';
  if(stage==='Discovery') return 'No relationship breadcrumbs yet';
  return stage;
}

function accountCardHtml(company) {
  const deal=featuredAccountDeal(company);
  const lastTouch=latestAccountTouch(company);
  const contacts=company.contactCount ?? state.contacts.filter(c=>c.companyId===company.id || c.company===company.name).length;
  const deals=company.dealCount ?? accountDeals(company).length;
  const details=company.domain || contacts || deals || lastTouch || deal;
  return `<div class="work-card account-card ${details?'has-details':''}" data-company-id="${company.id}">
    <div class="work-card-face"><span class="work-card-title">${escapeHtml(company.name || company.domain || 'Untitled company')}</span>${company.accountStageOverride?'<span class="account-override-dot" title="Manual stage override"></span>':''}</div>
    ${details?`<div class="work-card-reveal account-card-reveal">
      ${company.domain?`<div class="work-card-company">${escapeHtml(company.domain)}</div>`:''}
      <div class="work-card-facts">
        ${contacts?`<span>${contacts} contact${contacts===1?'':'s'}</span>`:''}
        ${deals?`<span>${deals} deal${deals===1?'':'s'}</span>`:''}
        ${lastTouch?`<span>Touch ${fmtDate(lastTouch,{month:'short',day:'numeric'})}</span>`:''}
        ${deal?`<span>${escapeHtml(deal.name)} · ${money(deal.amount)}</span>`:''}
      </div>
      <div class="work-card-next smart-stage-reason">${escapeHtml(accountReason(company))}</div>
    </div>`:''}
  </div>`;
}

function openAccount(id) {
  const company=state.companies.find(c=>c.id===id); if(!company)return;
  const stage=accountStage(company);
  const deals=accountDeals(company);
  const contacts=state.contacts.filter(c=>c.companyId===company.id || c.company===company.name);
  const lastTouch=latestAccountTouch(company);
  openModal('Account', company.name || company.domain || 'Company', `
    <div class="account-modal-summary">
      <div><span class="account-summary-label">Smart stage</span><strong>${stage}</strong></div>
      ${lastTouch?`<div><span class="account-summary-label">Last touch</span><strong>${fmtDate(lastTouch,{month:'short',day:'numeric',year:'numeric'})}</strong></div>`:''}
      <div><span class="account-summary-label">Contacts</span><strong>${company.contactCount ?? contacts.length}</strong></div>
      <div><span class="account-summary-label">Deals</span><strong>${company.dealCount ?? deals.length}</strong></div>
    </div>
    <div class="field spaced-field"><label>Stage behavior</label><select id="accountStageOverride" class="field-select"><option value="">Auto · ${stage}</option>${ACCOUNT_STAGES.map(s=>`<option value="${s}" ${company.accountStageOverride===s?'selected':''}>Override · ${s}</option>`).join('')}</select></div>
    ${company.domain?`<div class="account-detail-line"><span>Domain</span><strong>${escapeHtml(company.domain)}</strong></div>`:''}
    <div class="account-section-title">Why it is here</div>
    <div class="account-reason-box">${escapeHtml(accountReason(company))}</div>
    ${deals.length?`<div class="account-section-title">Deals</div><div class="account-related-list">${deals.map(d=>`<div class="account-related-row"><div><strong>${escapeHtml(d.name)}</strong><span>${escapeHtml(d.stage)}</span></div><strong>${money(d.amount)}</strong></div>`).join('')}</div>`:''}
    ${contacts.length?`<div class="account-section-title">Contacts</div><div class="account-related-list">${contacts.map(c=>`<div class="account-related-row"><div><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.detail||c.email||'')}</span></div></div>`).join('')}</div>`:''}
    <div class="modal-actions"><button class="primary-button" id="saveAccountStage">Save</button></div>`);
  $('#saveAccountStage').onclick=()=>{
    mutate(()=>company.accountStageOverride=$('#accountStageOverride').value);
    closeModal();
  };
}
