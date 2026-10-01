function renderQuotes() {
  if(!currentQuoteId && state.quotes[0]) currentQuoteId=state.quotes[0].id;
  const q=state.quotes.find(x=>x.id===currentQuoteId) || state.quotes[0];
  $('#view-quotes').innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Quote desk</div><h1>Quotes</h1><div class="page-subtitle">A single rough line is valid. A detailed estimate is valid too.</div></div><button class="primary-button" id="newQuoteBtn">+ New quote</button></div>
    <div class="quote-layout">
      <div class="quote-list"><div class="quote-list-head"><div class="helper">${state.quotes.length} quote${state.quotes.length===1?'':'s'}</div></div>${state.quotes.map(x=>`<div class="quote-list-item ${x.id===q?.id?'active':''}" data-quote-id="${x.id}"><div class="quote-item-title">${escapeHtml(x.title||'Untitled quote')}</div><div class="quote-item-meta"><span>${escapeHtml(x.quoteNumber)} · Rev ${x.revision}</span><span>${money(quoteTotal(x))}</span></div></div>`).join('')}</div>
      <div>${q ? quoteEditorHtml(q) : '<div class="panel"><div class="panel-body">Create your first quote.</div></div>'}</div>
    </div>`;
  $$('.quote-list-item', $('#view-quotes')).forEach(el=>el.onclick=()=>{currentQuoteId=el.dataset.quoteId;renderQuotes();});
  $('#newQuoteBtn').onclick=createBlankQuote;
  if(q) bindQuoteEditor(q);
}

function quoteEditorHtml(q) {
  return `<div class="quote-editor">
    <div class="quote-editor-head"><div><div class="quote-editor-title">${escapeHtml(q.title||'Untitled quote')}</div><div class="quote-editor-meta">${escapeHtml(q.quoteNumber)} · Revision ${q.revision} · ${escapeHtml(q.status||'Draft')}</div></div><div class="quote-actions"><button class="secondary-button" id="reviseBtn">Create revision</button><button class="secondary-button" id="previewBtn">Preview</button><button class="primary-button" id="shareBtn">Share / Save</button></div></div>
    <div class="quote-form">
      <div class="form-grid">
        <div class="field"><label>Quote / project name</label><input id="qTitle" value="${escapeHtml(q.title||'')}"></div>
        <div class="field"><label>Customer</label><input id="qCustomer" value="${escapeHtml(q.customer||'')}"></div>
        <div class="field"><label>Attention</label><input id="qContact" value="${escapeHtml(q.contact||'')}"></div>
        <div class="field"><label>Status</label><input id="qStatus" value="${escapeHtml(q.status||'Draft')}"></div>
      </div>
      <table class="quote-table"><thead><tr><th>Description</th><th style="width:90px">Qty</th><th style="width:110px">Rate</th><th style="width:105px;text-align:right">Amount</th><th style="width:34px"></th></tr></thead><tbody>${q.lines.map(line=>lineRowHtml(line)).join('')}</tbody></table>
      <button class="text-button" id="addLineBtn" style="margin-top:7px">+ Add line</button>
      <div class="quote-footer-row">
        <div class="quote-notes field"><label>Scope / notes</label><textarea id="qNotes" rows="6" placeholder="Optional terms, scope, exclusions, allowances…">${escapeHtml(q.notes||'')}</textarea></div>
        <div class="quote-totals"><div class="total-row"><span>Subtotal</span><span>${money(quoteTotal(q))}</span></div><div class="total-row grand"><span>Total</span><span>${money(quoteTotal(q))}</span></div></div>
      </div>
      <div class="revision-strip"><span class="helper">History:</span>${[...(q.revisions||[]).map(r=>`<span class="revision-chip">Rev ${r.revision} · ${money(r.total)} · ${new Date(r.savedAt).toLocaleDateString()}</span>`),`<span class="revision-chip">Current Rev ${q.revision}</span>`].join('')}</div>
    </div>
  </div>`;
}

function lineRowHtml(line) {
  return `<tr data-line-id="${line.id}"><td><input data-field="description" value="${escapeHtml(line.description||'')}" placeholder="Countertops"></td><td><input data-field="qty" value="${line.qty ?? ''}" inputmode="decimal"></td><td><input data-field="rate" value="${line.rate ?? ''}" inputmode="decimal"></td><td class="money-cell"><input data-field="amount" value="${line.amount ?? ''}" inputmode="decimal" style="text-align:right" placeholder="$0"></td><td><button class="icon-button line-delete" data-delete-line="${line.id}">×</button></td></tr>`;
}

function bindQuoteEditor(q) {
  const syncHeader = () => {
    q.title=$('#qTitle').value; q.customer=$('#qCustomer').value; q.contact=$('#qContact').value; q.status=$('#qStatus').value; q.notes=$('#qNotes').value; q.updatedAt=nowISO(); save();
  };
  ['qTitle','qCustomer','qContact','qStatus','qNotes'].forEach(id=>$('#'+id).oninput=()=>{syncHeader(); if(id==='qTitle') $('.quote-editor-title').textContent=$('#qTitle').value||'Untitled quote';});
  $$('.quote-table tr[data-line-id]').forEach(row=>$$('input',row).forEach(inp=>inp.oninput=()=>{
    const line=q.lines.find(l=>l.id===row.dataset.lineId); const f=inp.dataset.field; line[f]=['qty','rate','amount'].includes(f) ? (inp.value===''?'':Number(inp.value)) : inp.value;
    if((f==='qty'||f==='rate') && line.qty!=='' && line.rate!=='') line.amount=Number(line.qty||0)*Number(line.rate||0);
    q.updatedAt=nowISO(); save(); renderQuotes();
  }));
  $$('[data-delete-line]').forEach(b=>b.onclick=()=>mutate(()=>{q.lines=q.lines.filter(l=>l.id!==b.dataset.deleteLine);}));
  $('#addLineBtn').onclick=()=>{ q.lines.push({id:uid('line'),description:'',qty:'',rate:'',amount:''}); save(); renderQuotes(); setTimeout(()=>$('.quote-table tbody tr:last-child input')?.focus(),0); };
  $('#previewBtn').onclick=()=>openQuotePreview(q,false);
  $('#shareBtn').onclick=()=>openQuotePreview(q,true);
  $('#reviseBtn').onclick=()=>createRevision(q);
}

function quoteTotal(q) { return (q.lines||[]).reduce((sum,l)=>sum+Number(l.amount||0),0); }
function createBlankQuote() {
  const n=1001+state.quotes.length;
  const q={id:uid('quote'),quoteNumber:`Q-${n}`,title:'',customer:'',contact:'',createdAt:nowISO(),updatedAt:nowISO(),revision:0,status:'Draft',notes:'',lines:[{id:uid('line'),description:'',qty:'',rate:'',amount:''}],revisions:[]};
  state.quotes.unshift(q); currentQuoteId=q.id; save(); renderQuotes(); setTimeout(()=>$('#qTitle')?.focus(),0);
}
function createQuoteFromWorkItem(w) {
  const n=1001+state.quotes.length;
  const q={id:uid('quote'),quoteNumber:`Q-${n}`,title:w.title,customer:w.company,contact:'',createdAt:nowISO(),updatedAt:nowISO(),revision:0,status:'Draft',notes:'',lines:[{id:uid('line'),description:'Countertops',qty:'',rate:'',amount:w.amount||''}],revisions:[],workItemId:w.id};
  state.quotes.unshift(q); currentQuoteId=q.id; save();
}
function createRevision(q) {
  q.revisions=q.revisions||[];
  q.revisions.push({revision:q.revision,total:quoteTotal(q),savedAt:nowISO(),snapshot:JSON.parse(JSON.stringify({title:q.title,customer:q.customer,contact:q.contact,status:q.status,notes:q.notes,lines:q.lines}))});
  q.revision += 1; q.updatedAt=nowISO(); save(); renderQuotes(); toast(`Revision ${q.revision} started`);
}

function openQuotePreview(q, shareMode) {
  openModal(shareMode?'Share or save quote':'Quote preview', `${q.quoteNumber} · Rev ${q.revision}`, `
    ${shareMode?`<div style="display:flex;gap:8px;margin-bottom:14px"><button class="secondary-button" id="copyQuoteBtn">Copy summary</button><button class="primary-button" id="printQuoteBtn">Print / Save PDF</button></div>`:''}
    <div class="quote-preview"><div class="quote-paper">
      <div class="letterhead"><div><div class="letterhead-name">${escapeHtml(state.settings.companyName || 'Your Company')}</div><div class="helper">Sales & Quoting</div></div><div class="letterhead-meta">Professional Quote<br>${escapeHtml(q.quoteNumber)} · Revision ${q.revision}<br>${new Date(q.updatedAt).toLocaleDateString()}</div></div>
      <div class="preview-title">${escapeHtml(q.title||'Quote')}</div>
      <div class="preview-meta">${escapeHtml(q.customer||'Customer not specified')}${q.contact?` · Attn: ${escapeHtml(q.contact)}`:''}</div>
      <table class="preview-table"><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>${q.lines.filter(l=>l.description||l.amount).map(l=>`<tr><td>${escapeHtml(l.description||'')}</td><td>${money(l.amount)}</td></tr>`).join('')}</tbody></table>
      <div class="preview-total">Total ${money(quoteTotal(q))}</div>
      ${q.notes?`<div class="preview-notes">${escapeHtml(q.notes)}</div>`:''}
    </div></div>`);
  if(shareMode) {
    $('#copyQuoteBtn').onclick=async()=>{ const txt=`${q.quoteNumber} Rev ${q.revision} — ${q.title}\n${q.customer}\nTotal: ${money(quoteTotal(q))}`; await navigator.clipboard.writeText(txt); toast('Quote summary copied'); };
    $('#printQuoteBtn').onclick=()=>window.print();
  }
}
