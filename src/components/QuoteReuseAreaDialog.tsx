import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Quote} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
import './quote-reuse-area.css';

/** Sources are passed by the document workspace's existing visibility filter.
 * Never search the entire organization store from this chooser. */
export function QuoteReuseAreaDialog({quote,sources,onClose}:{
 quote:Quote;sources:readonly Quote[];onClose:()=>void;
}){
 const eligible=sources.filter(source=>source.id!==quote.id&&!source.archivedAt
  &&source.documentType!=='pricing-schedule'
  &&source.sections.some(area=>!isGeneralTakeoffSection(area)));
 const [sourceId,setSourceId]=useState('');
 const [areaId,setAreaId]=useState('');
 const [includePricing,setIncludePricing]=useState(false);
 const [error,setError]=useState('');
 const source=eligible.find(candidate=>candidate.id===sourceId);
 const areas=source?.sections.filter(area=>!isGeneralTakeoffSection(area))??[];
 const currentArea=areas.some(area=>area.id===areaId)?areaId:'';
 useEffect(()=>{
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
  document.addEventListener('keydown',escape);
  return()=>document.removeEventListener('keydown',escape);
 },[onClose]);
 const copy=()=>{
  if(!source||!currentArea||!quoteIsCommerciallyEditable(quote))return;
  const newArea=useQuoteStore.getState().copyAreaFromQuote(quote.id,source.id,currentArea,includePricing);
  if(newArea)onClose();
  else setError('This Area could not be copied. Confirm the destination is an editable quote.');
 };
 return createPortal(<div className="qra-backdrop" onPointerDown={event=>{
  if(event.target===event.currentTarget)onClose();
 }}>
  <section className="qra-panel" role="dialog" aria-modal="true" aria-label="Copy Area from another quote">
   <header><div><small>QUICK QUOTE · REUSE</small><h2>Copy an Area</h2></div>
    <button type="button" onClick={onClose} aria-label="Close Area reuse">×</button></header>
   <div className="qra-body">
    <p>Reuse measurements, stone selections, sinks and specialty charges from an existing quote. The original won't change.</p>
    {eligible.length?<><label>Source quote
      <select autoFocus value={sourceId} onChange={event=>{
       setSourceId(event.target.value);setAreaId('');setError('');
      }}>
       <option value="">Choose a quote…</option>
       {eligible.map(item=><option key={item.id} value={item.id}>
        {item.title||'Untitled quote'} · {item.quoteNumber} · {item.status}
       </option>)}
      </select>
     </label>
     <label>Area to copy
      <select value={currentArea} disabled={!source} onChange={event=>{
       setAreaId(event.target.value);setError('');
      }}>
       <option value="">Choose an Area…</option>
       {areas.map(area=><option key={area.id} value={area.id}>{area.title}</option>)}
      </select>
     </label>
     <label className="qra-checkbox"><input type="checkbox" checked={includePricing}
      onChange={event=>setIncludePricing(event.target.checked)}/>
      <span><strong>Carry over previous selling prices</strong>
       <small>Off by default. If checked, existing selling rates and charges are copied. Always review against current company pricing.</small></span>
     </label>
     <div className="qra-note" role="note">
      <strong>{includePricing?'Price review required':'Pricing will be left unpriced'}</strong>
      <span>{includePricing
       ?'The customer quote gains new charges copied from the source. Review the price and margin before approval.'
       :'Measurements, fixtures and charge descriptions remain; source selling prices are not applied.'}</span>
     </div></>:<p>No other accessible quotes have Areas to copy yet. You can still use Saved layouts.</p>}
    {error&&<p role="alert" className="qra-error">{error}</p>}
   </div>
   <footer><button type="button" onClick={onClose}>Cancel</button>
    <button type="button" className="qra-primary" onClick={copy}
     disabled={!currentArea||!quoteIsCommerciallyEditable(quote)}>Copy Area</button></footer>
  </section>
 </div>,document.body);
}
