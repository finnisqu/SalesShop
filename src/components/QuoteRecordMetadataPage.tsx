import {useQuoteStore} from '../store/quoteStore';
import {useCrmStore} from '../store/crmStore';
import {useAuthStore} from '../store/authStore';
import {useNavigationStore} from '../store/navigationStore';
import {displayQuoteNumber,quoteTotal} from '../types/quote';
import '../quote-record-metadata.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
export function QuoteRecordMetadataPage({quoteId,onBack,onPreview}:{
 quoteId:string;onBack:()=>void;onPreview:()=>void;
}){
 const authMode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id);
 const quote=useQuoteStore(s=>s.quotes.find(q=>q.id===quoteId&&
   (authMode!=='cloud'||q.ownerUserId===userId)));
 const deals=useCrmStore(s=>s.projects),companies=useCrmStore(s=>s.companies);
 const nav=useNavigationStore();
 if(!quote)return <section className="quote-record-page">
   <button type="button" onClick={onBack}>‹ Back to quote records</button>
   <p>Quote not found in your accessible records.</p></section>;
 const project=deals.find(d=>d.id===quote.projectId);
 const company=companies.find(c=>c.id===quote.companyId);
 const detail=(label:string,value:string)=> <div className="quote-record-detail" key={label}>
   <dt>{label}</dt><dd>{value||'—'}</dd>
 </div>;
 return <section className="quote-record-page" aria-label="Quote record metadata">
   <header><button type="button" onClick={onBack}>‹ Quotes</button>
     <div><small>CONNECTIONS / QUOTE RECORD</small><h1>{quote.title||displayQuoteNumber(quote)}</h1>
       <p>{displayQuoteNumber(quote)} · {quote.status} · Revision {quote.revision}</p></div>
     <button type="button" onClick={onPreview}>Preview info</button>
     <button type="button" className="quote-record-open" disabled={Boolean(quote.archivedAt)}
       title={quote.archivedAt?'Restore this document in Sales Documents before opening':undefined}
       onClick={()=>nav.openQuote(quote.id)}>Open quote</button>
   </header>
   <div className="quote-record-panels">
     <section><h2>Document details</h2><dl>
       {detail('Number',displayQuoteNumber(quote))}
       {detail('Type',quote.documentType==='pricing-schedule'?'Pricing schedule':quote.documentType==='change-order'?'Change order':'Quote')}
       {detail('Status',quote.status+(quote.archivedAt?' · Archived':''))}
       {detail('Revision',String(quote.revision))}
       {detail('Customer value',money.format(quoteTotal(quote)))}
       {detail('Created',new Date(quote.createdAt).toLocaleDateString())}
       {detail('Updated',new Date(quote.updatedAt).toLocaleDateString())}
     </dl></section>
     <section><h2>Connections</h2>
       {company?<button type="button" onClick={()=>nav.openCompany(company.id)}>{company.name} · Company ›</button>
         :<p>{quote.companyName||'No company linked'}</p>}
       {project?<button type="button" onClick={()=>nav.openProject(project.id)}>{project.name} · Deal ›</button>
         :<p>No linked deal</p>}
       <p>Open quote to edit its commercial scope, pricing and customer presentation.</p>
     </section>
   </div>
 </section>;
}
