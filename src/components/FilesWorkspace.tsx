import {useMemo} from 'react';
import type {Company,Project} from '../types/crm';
import type {SalesQuoteRecord} from '../services/salesQuoteRegistry';
import type {FileTarget} from '../services/fileLinks357a';
import {FileLinksManager} from './FileLinksManager';
import {useNavigationStore} from '../store/navigationStore';

export function FilesWorkspace({companies,deals,quotes,query}:{
 companies:readonly Company[];deals:readonly Project[];
 quotes:readonly SalesQuoteRecord[];query:string;
}){
 const targets=useMemo<FileTarget[]>(()=>[
  ...companies.map(row=>({kind:'company' as const,id:row.id,title:row.name})),
  ...deals.map(row=>({kind:'deal' as const,id:row.id,title:row.name})),
  ...quotes.map(row=>({kind:row.source==='external'?'externalQuote' as const:'quote' as const,
   id:row.sourceId,title:row.name+(row.source==='external'?' · external':' · SalesShop')})),
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
 return <section className="ss-files-workspace" aria-label="Files and folders">
  <header><div><small>FILES · PROTOTYPE V0.1</small><h2>Files</h2>
   <p>Keep drawings, bids, contracts and shared folders beside the records they belong to.</p></div>
   <span>Document links · no uploads yet</span></header>
  <FileLinksManager targets={targets} search={query} onOpenTarget={openTarget}/>
 </section>;
}
