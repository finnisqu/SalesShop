import {useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {SALES_DOCUMENT_TEMPLATES,salesDocumentTemplate,salesTemplateLabel,
  type SalesTemplateStart} from '../services/salesDocumentTemplates';
import type {Quote,SalesDocumentTemplateChoice} from '../types/quote';
import '../sales-documents.css';

const symbols:Record<SalesDocumentTemplateChoice,string>={
  'quick-quote':'▤','builder-rates':'≡','community-pricing':'▦','spreadsheet':'▥','multifamily':'▧',
};
export function NewSalesDocumentPicker({quotes,onClose,onCreate,stockRateCount}:{
  quotes:Quote[];onClose:()=>void;
  onCreate:(template:Exclude<SalesDocumentTemplateChoice,'multifamily'>,
    start:SalesTemplateStart,sourceQuoteId?:string)=>void;
  stockRateCount:number;
}){
  const [selected,setSelected]=useState<SalesDocumentTemplateChoice|null>(null);
  const [start,setStart]=useState<SalesTemplateStart>('blank');
  const [sourceId,setSourceId]=useState('');
  const [title,setTitle]=useState('');
  const template=SALES_DOCUMENT_TEMPLATES.find(t=>t.id===selected);
  const previous=useMemo(()=>quotes.filter(q=>{
    if(q.archivedAt||!q.pricingSchedule)return false;
    const type=salesDocumentTemplate(q);
    if(selected==='community-pricing')return type==='community-pricing'||type==='builder-rates';
    return type===selected;
  }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[selected,quotes]);
  const choose=(id:SalesDocumentTemplateChoice)=>{
    setSelected(id);setStart('blank');setSourceId('');setTitle('');
  };
  const canCreate=selected!==null&&selected!=='multifamily'&&
    (start!=='previous'||!!sourceId)&&
    (start!=='company-rates'||stockRateCount>0);
  return createPortal(<div className="sales-document-modal-backdrop"
    onPointerDown={e=>{if(e.currentTarget===e.target)onClose();}}>
    <section className="sales-document-picker" role="dialog" aria-modal="true"
      aria-label="New Sales Document">
      <header className="sales-document-picker-header">
        <div><strong>{template?template.title:'Create a sales document'}</strong>
          <small>{template?'Choose how to start this document. The editor stays in its selected workflow.':
            'Start from a blank document, company rates, or a previous agreement.'}</small></div>
        <button type="button" aria-label="Close new document picker" onClick={onClose}>×</button>
      </header>
      {!selected?<div className="sales-document-template-grid">
        {SALES_DOCUMENT_TEMPLATES.map(item=><button type="button" key={item.id}
          className={'sales-document-template-card'+(!item.available?' is-placeholder':'')}
          onClick={()=>choose(item.id)}>
          <span className="sales-document-template-symbol" aria-hidden="true">{symbols[item.id]}</span>
          <span className="sales-document-template-copy"><strong>{item.title}</strong>
            <small>{item.subtitle}</small><span>{item.description}</span></span>
          {!item.available&&<span className="sales-document-coming-soon">Coming later</span>}
        </button>)}
      </div>:<div className="sales-document-start">
        <button type="button" className="sales-document-picker-back" onClick={()=>setSelected(null)}>← All templates</button>
        {selected==='multifamily'?<div className="sales-document-placeholder">
          <strong>Multi-Family · planned workspace</strong>
          <p>This document type is reserved for supplier quotes, cut-to-size material pricing, wholesale purchasing and project cost modeling. It cannot create a draft or publish prices until its calculator and contract rules are ready.</p>
        </div>:<>
          <p className="sales-document-template-description">{template?.description}</p>
          <div className="sales-document-starter-options" role="group" aria-label="Starting point">
            <button type="button" className={start==='blank'?'active':''} onClick={()=>{setStart('blank');setSourceId('');}}>
              <strong>Blank</strong><small>Start with an empty editable document.</small>
            </button>
            {selected!=='spreadsheet'&&selected!=='quick-quote'&&<button type="button"
              className={start==='company-rates'?'active':''} disabled={!stockRateCount}
              onClick={()=>{setStart('company-rates');setSourceId('');}}>
              <strong>Company stock rates</strong>
              <small>{stockRateCount?stockRateCount+' available company rates, copied as a snapshot':'No rates in the company Rate Book'}</small>
            </button>}
            {selected!=='quick-quote'&&<button type="button" className={start==='previous'?'active':''}
              disabled={!previous.length} onClick={()=>setStart('previous')}>
              <strong>Copy previous agreement</strong><small>{previous.length?previous.length+' compatible documents':'No matching documents yet'}</small>
            </button>}
          </div>
          {start==='previous'&&<label className="sales-document-source-picker"><span>Choose the agreement to copy</span>
            <select aria-label="Previous agreement" value={sourceId} onChange={e=>setSourceId(e.target.value)}>
              <option value="">Select previous document…</option>
              {previous.map(q=><option key={q.id} value={q.id}>
                {q.companyName?q.companyName+' · ':''}{q.title} · Rev {q.revision} · {salesTemplateLabel(salesDocumentTemplate(q))}
              </option>)}
            </select>
            <small>Copies its current pricing as an independent draft. Later changes to the original will not change this document.</small>
          </label>}
          {selected==='community-pricing'&&<p className="sales-document-starter-note">
            Start from a prior Builder Rate Schedule to reuse negotiated material/add-on rates, then add this community's house plans and takeoffs.
          </p>}
          {selected==='spreadsheet'&&<p className="sales-document-starter-note">
            Choose Blank for a fresh Univer workbook. You can import an Excel file inside the spreadsheet editor.
          </p>}
        </>}
      </div>}
      <footer className="sales-document-picker-footer">
        <span>{selected&&selected!=='multifamily'?'Workspace: '+template?.title:'Templates retain their own editing tools.'}</span>
        {canCreate&&selected!=='multifamily'&&<button type="button" className="sales-document-picker-create"
          onClick={()=>onCreate(selected,start,sourceId||undefined)}>Create document →</button>}
        {selected==='multifamily'&&<button type="button" onClick={onClose}>Close</button>}
      </footer>
    </section>
  </div>,document.body);
}
