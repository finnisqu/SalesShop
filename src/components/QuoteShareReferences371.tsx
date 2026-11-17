import {useEffect,useMemo,useRef,useState} from 'react';
import type {SalesQuoteRecord} from '../services/salesQuoteRegistry';
import {getQuoteShare,quoteShareUrl,type QuoteShare} from '../services/quoteShareService';
import {quoteShareLookupCandidate,quoteShareReferenceSummary}
 from '../services/quoteShareReferences371';
import {useAuthStore} from '../store/authStore';
import {useQuoteStore} from '../store/quoteStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';

/** Checks only a user-selected existing customer Quote Share.
 * Never creates, rotates or persists bearer URLs, and never marks delivery. */
export function QuoteShareReferences371({quotes,search,onOpenQuote}:{
 quotes:readonly SalesQuoteRecord[];search:string;onOpenQuote:(id:string)=>void;
}){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const sourceQuotes=useQuoteStore(s=>s.quotes);
 const [selectedId,setSelectedId]=useState('');
 const [result,setResult]=useState<{
  identity:string;quoteId:string;revision:number;share:QuoteShare|null;
 }|null>(null);
 const [working,setWorking]=useState(false);
 const [notice,setNotice]=useState('');
 const requestRef=useRef(0);
 const identity=mode==='cloud'&&org&&user&&!perspective?org+'|'+user:null;
 const candidates=useMemo(()=>quotes.filter(quote=>quoteShareLookupCandidate(quote)&&
  sourceQuotes.some(row=>row.id===quote.sourceId)&&
  (!search.trim()||[
   quote.name,quote.number,quote.companyName,quote.dealName
  ].some(value=>value?.toLowerCase().includes(search.trim().toLowerCase())))),
  [quotes,sourceQuotes,search]);
 const selected=candidates.find(quote=>quote.sourceId===selectedId);
 const current=selected?sourceQuotes.find(quote=>quote.id===selected.sourceId):null;
 const validResult=identity&&selected&&current&&result?.identity===identity&&
  result.quoteId===current.id&&result.revision===current.revision?result:null;
 const summary=validResult&&current
  ?quoteShareReferenceSummary({id:current.id,revision:current.revision},validResult.share):null;
 useEffect(()=>{
  requestRef.current+=1;setResult(null);setNotice('');setWorking(false);
 },[identity,selectedId,current?.revision]);
 const check=async()=>{
  const auth=useAuthStore.getState();
  if(!identity||!selected||!current||!quoteShareLookupCandidate(selected)||
   !auth.session||perspective){
   setNotice('Sign in to an authorized cloud workspace and select an issued SalesShop Quote.');
   return;
  }
  const request=++requestRef.current,revision=current.revision,quoteId=current.id;
  setWorking(true);setResult(null);setNotice('');
  try{
   const share=await getQuoteShare(quoteId);
   const latest=useAuthStore.getState(),nowQuote=useQuoteStore.getState()
    .quotes.find(q=>q.id===quoteId);
   if(request!==requestRef.current||latest.mode!=='cloud'||
    latest.organizationId!==org||latest.user?.id!==user||
    useRolePerspectiveStore.getState().activePerspective||
    !nowQuote||nowQuote.revision!==revision)return;
   if(share&&(share.quoteId!==quoteId||share.revision!==revision)){
    setNotice('The stored customer link belongs to another Quote revision. Manage the link in Quote Review.');
    return;
   }
   setResult({identity,quoteId,revision,share});
  }catch(error){
   if(request===requestRef.current)
    setNotice(error instanceof Error?error.message:'Could not check customer Quote link.');
  }finally{if(request===requestRef.current)setWorking(false);}
 };
 const copy=async()=>{
  const auth=useAuthStore.getState();
  if(!identity||!validResult?.share||!summary?.usable||!current||
   auth.mode!=='cloud'||auth.organizationId!==org||auth.user?.id!==user||
   useRolePerspectiveStore.getState().activePerspective||
   useQuoteStore.getState().quotes.find(q=>q.id===current.id)?.revision!==result?.revision){
   setNotice('Recheck the current issued Quote before copying its customer link.');
   return;
  }
  try{
   await navigator.clipboard.writeText(quoteShareUrl(validResult.share));
   setNotice('Customer link copied. Copying does not confirm quote delivery.');
  }catch{setNotice('Clipboard permission denied. Open Quote Review to copy the customer link.');}
 };
 return <section className="ss-file-quote-references" aria-label="SalesShop customer Quote links">
  <header><div>
   <strong>Customer Quote links</strong>
   <p>Check existing SalesShop customer links without creating or sending a Quote.</p>
  </div><small>Read-only lookup</small></header>
  {identity?<div className="ss-file-quote-controls">
   <label>Issued SalesShop Quote
    <select value={selected?.sourceId??''} onChange={event=>setSelectedId(event.target.value)}>
     <option value="">Choose a Quote</option>
     {candidates.map(item=><option value={item.sourceId} key={item.id}>
      {item.number?item.number+' · ':''}{item.name}
     </option>)}
    </select>
   </label>
   <div className="ss-file-quote-actions">
    <button type="button" disabled={!selected||working} onClick={()=>{void check();}}>
     {working?'Checking…':'Check current link'}</button>
    {selected&&<button type="button" onClick={()=>onOpenQuote(selected.sourceId)}>
     Manage in Quote</button>}
   </div>
  </div>:<p>Customer link checks require your signed-in SalesShop cloud workspace.</p>}
  {identity&&!candidates.length&&
   <p className="ss-files-notice">No eligible issued SalesShop Quotes match this search. External Quotes remain first-class linked records, but do not have native SalesShop customer links.</p>}
  {summary&&<div className="ss-file-quote-result" role="status">
   <strong>{summary.state==='missing'?'No customer link for this revision':
    summary.state==='active'?'Customer link ready':
    summary.state==='viewed'?'Customer link viewed':
    summary.state==='signed'?'Customer signed':
    summary.state==='revoked'?'Customer link revoked':
    summary.state==='expired'?'Customer link expired':'Quote revision mismatch'}</strong>
   <small>Revision {summary.revision} · {summary.views} link views</small>
   {summary.usable&&<button type="button" onClick={()=>{void copy();}}>
    Copy customer link</button>}
   {!summary.usable&&<p>Use Quote Review to create or manage a valid customer link.</p>}
  </div>}
  {notice&&<p className="ss-files-notice" role="status">{notice}</p>}
  <small className="ss-files-notice">Checking a link never issues a Quote, sends an email, or confirms customer delivery. Customer URLs contain access tokens and are not saved as File links.</small>
 </section>;
}
