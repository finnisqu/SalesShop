import {useMemo} from 'react';
import type {Company,Project} from '../types/crm';
import type {SalesQuoteRecord} from '../services/salesQuoteRegistry';
import type {FileTarget} from '../services/fileLinks357a';
import {StorageInventory390} from './StorageInventory390';
import {QuoteShareReferences371} from './QuoteShareReferences371';
import {useNavigationStore} from '../store/navigationStore';

export function FilesWorkspace({companies,deals,quotes,query}:{
 companies:readonly Company[];deals:readonly Project[];
 quotes:readonly SalesQuoteRecord[];query:string;
}){
 const targets=useMemo<FileTarget[]>(()=>[
  ...companies.map(row=>({kind:'company' as const,id:row.id,title:row.name})),
  ...deals.map(row=>({kind:'deal' as const,id:row.id,title:row.name,companyId:row.companyId})),
  ...quotes.map(row=>({kind:row.source==='external'?'externalQuote' as const:'quote' as const,
   id:row.sourceId,title:row.name+(row.source==='external'?' · external':' · SalesShop'),
   companyId:row.companyId,projectId:row.projectId})),
 ],[companies,deals,quotes]);
 const openCompany=useNavigationStore(s=>s.openCompany);
 const openDeal=useNavigationStore(s=>s.openProject);
 const openQuote=useNavigationStore(s=>s.openQuote);
 const openTarget=(target:FileTarget)=>{
  if(target.kind==='company')openCompany(target.id);
  else if(target.kind==='deal')openDeal(target.id);
  else if(target.kind==='quote')openQuote(target.id);
  else{
   const quote=quotes.find(q=>q.source==='external'&&q.sourceId===target.id);
   if(quote?.projectId&&deals.some(deal=>deal.id===quote.projectId))openDeal(quote.projectId);
  }
 };
 return <section className="ss-files-workspace" aria-label="Files and documents">
  <header><div><small>FILES · STORAGE & DOCUMENTS</small><h2>Files & Docs</h2>
   <p>Find drawings, contracts and linked documents. Review storage sources, sizes and related records.</p></div>
   <span>Storage inventory · links only</span></header>
  <StorageInventory390 targets={targets} search={query} onOpenTarget={openTarget}/>
  <details className="ss-files-quote-lookup">
   <summary>Customer Quote links · check existing share status</summary>
   <QuoteShareReferences371 quotes={quotes} search={query}
    onOpenQuote={openQuote}/>
  </details>
 </section>;
}
