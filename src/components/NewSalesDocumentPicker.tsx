import {useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {SALES_DOCUMENT_TEMPLATES,salesDocumentTemplate,salesTemplateLabel,
  type SalesTemplateStart} from '../services/salesDocumentTemplates';
import type {Quote,SalesDocumentTemplateChoice} from '../types/quote';
import '../sales-documents.css';

const symbols:Record<SalesDocumentTemplateChoice,string>={
  'quick-quote':'▤','builder-rates':'≡','community-pricing':'▦','spreadsheet':'▥','multifamily':'▧',
};
export function NewSalesDocumentPicker({quotes,onClose,onCreate,stockRateCount,
  stockLevelReady,stockMaterialCount,stockLevelCount,unassignedStockCount}:{
  quotes:Quote[];onClose:()=>void;
  onCreate:(template:Exclude<SalesDocumentTemplateChoice,'multifamily'>,
    start:SalesTemplateStart,sourceQuoteId:string|undefined,title:string)=>void;
  stockRateCount:number;
  stockLevelReady:boolean;
  stockMaterialCount:number;
  stockLevelCount:number;
  unassignedStockCount:number;
}){
  const [selected,setSelected]=useState<SalesDocumentTemplateChoice|null>(null);
  const [start,setStart]=useState<SalesTemplateStart>('blank');
  const [sourceId,setSourceId]=useState('');
  const [documentName,setDocumentName]=useState('');
  const template=SALES_DOCUMENT_TEMPLATES.find(t=>t.id===selected);
  const previous=useMemo(()=>quotes.filter(q=>{
    if(q.archivedAt||!q.pricingSchedule)return false;
    const type=salesDocumentTemplate(q);
    if(selected==='community-pricing')return type==='community-pricing'||type==='builder-rates';
    return type===selected;
  }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[selected,quotes]);
  const choose=(id:SalesDocumentTemplateChoice)=>{
    setSelected(id);setStart('blank');setSourceId('');setDocumentName('');
  };
  const stockStarterSelected=selected==='builder-rates';
  const stockStarterReady=stockStarterSelected
    ?stockLevelReady&&stockMaterialCount>0
    :stockRateCount>0;
  const canCreate=selected!==null&&selected!=='multifamily'&&documentName.trim().length>0&&
    (start!=='previous'||!!sourceId)&&
    (start!=='company-rates'||stockStarterReady);
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
          {selected!=='quick-quote'&&<div className="sales-document-starter-options" role="group" aria-label="Starting point">
            <button type="button" className={start==='blank'?'active':''} onClick={()=>{setStart('blank');setSourceId('');}}>
              <strong>Blank</strong><small>Start with an empty editable document.</small>
            </button>
            {selected!=='spreadsheet'&&selected!=='quick-quote'&&<button type="button"
              className={start==='company-rates'?'active':''} disabled={!stockStarterReady}
              onClick={()=>{setStart('company-rates');setSourceId('');}}>
              <strong>{stockStarterSelected?'Company stock levels':'Company stock rates'}</strong>
              <small>{stockStarterSelected
                ?!stockLevelReady?'Loading stock materials and level pricing…'
                  :!stockMaterialCount?'No active stock materials in the company catalog'
                  :stockMaterialCount+' stock colors · '+stockLevelCount+' priced level groups'
                :stockRateCount?stockRateCount+' available company rates, copied as a snapshot'
                  :'No rates in the company Rate Book'}</small>
            </button>}
            {selected!=='quick-quote'&&<button type="button" className={start==='previous'?'active':''}
              disabled={!previous.length} onClick={()=>{setStart('previous');setDocumentName('');}}>
              <strong>Copy previous agreement</strong><small>{previous.length?previous.length+' compatible documents':'No matching documents yet'}</small>
            </button>}
          </div>}
          {start==='previous'&&<label className="sales-document-source-picker"><span>Choose the agreement to copy</span>
            <select aria-label="Previous agreement" value={sourceId} onChange={e=>{
              setSourceId(e.target.value);
              const chosen=quotes.find(q=>q.id===e.target.value);
              if(chosen)setDocumentName(chosen.title+' · New agreement');
            }}>
              <option value="">Select previous document…</option>
              {previous.map(q=><option key={q.id} value={q.id}>
                {q.companyName?q.companyName+' · ':''}{q.title} · Rev {q.revision} · {salesTemplateLabel(salesDocumentTemplate(q))}
              </option>)}
            </select>
            <small>Copies its current pricing as an independent draft. Later changes to the original will not change this document.</small>
          </label>}
          <label className="sales-document-name-field">
            <span>{selected==='quick-quote'?'Quote name':'Document name'} <strong aria-hidden="true">*</strong></span>
            <input aria-label={selected==='quick-quote'?'Quote name':'Document name'}
              autoFocus maxLength={300} required value={documentName}
              onChange={e=>setDocumentName(e.target.value)}
              placeholder={selected==='quick-quote'?'e.g. Smith Residence Kitchen':'e.g. Oakwood 2027 Pricing'}
              onKeyDown={e=>{if(e.key==='Enter'&&canCreate)onCreate(selected as Exclude<SalesDocumentTemplateChoice,'multifamily'>,start,sourceId||undefined,documentName.trim());}}/>
            <small>Name this document before creating it. You can change its title later.</small>
          </label>
          {selected==='builder-rates'&&start==='company-rates'&&
            <p className="sales-document-starter-note">
              Prices come from the current company Builder Level Guide ($/SF), with its approved
              stock colors grouped by level. General Rate Book sinks and add-ons are included separately.
              {unassignedStockCount>0?' '+unassignedStockCount+' stock color(s) need a level assignment and will be listed for review.':''}
              Everything becomes an editable snapshot for this builder.
            </p>}
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
        {canCreate&&<button type="button" className="sales-document-picker-create"
          onClick={()=>onCreate(selected,start,sourceId||undefined,documentName.trim())}>Create document →</button>}
        {selected==='multifamily'&&<button type="button" onClick={onClose}>Close</button>}
      </footer>
    </section>
  </div>,document.body);
}
