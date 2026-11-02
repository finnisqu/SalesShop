import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Quote,QuoteSection} from '../types/quote';
import {quoteLineAmount} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
export function QuoteInlineAreaName({quote,section,autoFocus=false}:{quote:Quote;section:QuoteSection;autoFocus?:boolean}){
 const update=useQuoteStore(s=>s.updateSection);
 const [draft,setDraft]=useState(section.title);
 const old=useRef(section.title);
 useEffect(()=>{old.current=section.title;setDraft(section.title);},[section.id,section.title]);
 const save=()=>{
   const value=draft.trim();
   if(value&&value!==section.title)update(quote.id,section.id,{title:value});
   else setDraft(section.title);
 };
 return <input className="qmb-inline-area-title" autoFocus={autoFocus} aria-label={'Area name '+section.title}
   disabled={!quoteIsCommerciallyEditable(quote)} value={draft} maxLength={140}
   onChange={e=>setDraft(e.target.value)}
   onBlur={save} onKeyDown={e=>{
     if(e.key==='Enter')e.currentTarget.blur();
     if(e.key==='Escape'){setDraft(old.current);e.currentTarget.blur();}
   }}/>;
}
export function QuoteInlineAreaRate({quote,section,onOpen}:{
 quote:Quote;section:QuoteSection;onOpen:()=>void;
}){
 const updateLine=useQuoteStore(s=>s.updateLine);
 const primary=quote.lines.find(l=>l.sectionId===section.id&&l.pricingMode==='quantity-rate'
   &&l.quantitySource?.syncMode==='live'&&l.quantitySource.field==='countertopSf');
 const [draft,setDraft]=useState(primary?.rate===undefined?'':String(primary.rate));
 useEffect(()=>setDraft(primary?.rate===undefined?'':String(primary.rate)),
   [quote.id,section.id,primary?.rate]);
 if(!primary)return <button type="button" onClick={onOpen}>Choose method</button>;
 const commit=()=>{
   if(draft.trim()===''){if(primary.rate!==undefined)updateLine(quote.id,primary.id,{rate:undefined,rateReference:undefined});return;}
   const value=Number(draft);
   if(Number.isFinite(value)&&value>=0&&value!==primary.rate)
     updateLine(quote.id,primary.id,{rate:value,rateReference:undefined});
   else setDraft(primary.rate===undefined?'':String(primary.rate));
 };
 return <input type="number" inputMode="decimal" min="0" step=".01"
   aria-label={'Selling rate per SF for '+section.title} placeholder="Set rate"
   disabled={!quoteIsCommerciallyEditable(quote)}
   value={draft} onChange={e=>setDraft(e.target.value)}
   onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();
     if(e.key==='Escape'){setDraft(primary.rate===undefined?'':String(primary.rate));e.currentTarget.blur();}
   }}/>;
}
type BulkEditKind='display-detail'|'display-summary'|'visible'|'hidden'|'sf-rate';
export function QuoteBulkAreaDialog({quote,ids,onClose,onApplied}:{
 quote:Quote;ids:string[];onClose:()=>void;onApplied:()=>void;
}){
 const bulk=useQuoteStore(s=>s.bulkEditAreas);
 const [kind,setKind]=useState<BulkEditKind>('display-summary');
 const [rawRate,setRawRate]=useState('');
 const [error,setError]=useState('');
 const areas=quote.sections.filter(a=>ids.includes(a.id));
 const sfLines=areas.flatMap(a=>quote.lines.filter(l=>l.sectionId===a.id
   &&l.pricingMode==='quantity-rate'&&l.quantitySource?.syncMode==='live'));
 const eligible=sfLines.length===areas.length;
 const rate=rawRate.trim()?Number(rawRate):NaN;
 const validRate=Number.isFinite(rate)&&rate>=0;
 const changedBefore=sfLines.reduce((n,l)=>n+quoteLineAmount(l),0);
 const changedAfter=sfLines.reduce((n,l)=>n+(l.quantity??0)*rate,0);
 const allowed=kind!=='sf-rate'||(eligible&&validRate);
 const apply=()=>{
   const patch=kind==='sf-rate'?{sfRate:rate}
     :kind==='display-detail'?{customerDisplayMode:'detail' as const}
     :kind==='display-summary'?{customerDisplayMode:'summary' as const}
     :kind==='visible'?{customerVisible:true}:{customerVisible:false};
   const count=bulk(quote.id,ids,patch);
   if(count===ids.length){onApplied();return;}
   setError('The bulk edit could not be applied. Recheck the selected Areas.');
 };
 useEffect(()=>{
   const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();}};
   document.addEventListener('keydown',close);
   return ()=>document.removeEventListener('keydown',close);
 },[onClose]);
 return createPortal(<div className="qmb qmb-area-manager-backdrop" onPointerDown={e=>{
   if(e.target===e.currentTarget)onClose();}}>
   <section className="qmb-bulk-area-dialog" role="dialog" aria-modal="true" aria-label="Bulk edit quote Areas">
     <header><strong>Bulk edit {areas.length} Areas</strong>
       <button type="button" onClick={onClose} aria-label="Close bulk edit">×</button></header>
     <small>{areas.map(a=>a.title||'Untitled Area').join(', ')}</small>
     <label>Apply to selected
       <select value={kind} onChange={e=>setKind(e.target.value as BulkEditKind)}>
         <option value="display-summary">Customer display: lump sum</option>
         <option value="display-detail">Customer display: itemized</option>
         <option value="visible">Show on customer quote</option>
         <option value="hidden">Hide on customer quote</option>
         <option value="sf-rate">Update existing SF selling rates</option>
       </select>
     </label>
     {kind==='sf-rate'&&<><label>New selling rate / SF
       <input type="number" value={rawRate} min="0" step=".01" inputMode="decimal"
         aria-label="Bulk selling rate per SF" onChange={e=>setRawRate(e.target.value)}/>
       </label>
       {!eligible?<p role="alert">All selected Areas need an existing live-SF pricing line.
         Manual and multiplier prices cannot be overwritten by a bulk rate change.</p>:
         <p>Selected countertop lines only: {money.format(changedBefore)} → {validRate?money.format(changedAfter):'Enter a rate'}.
           Separately charged sinks and extras stay unchanged.</p>}
     </>}
     <p className="qmb-bulk-area-warning">This changes the selected quote data once, with one Undo step.
       Review the customer preview before issuing.</p>
     {error&&<p role="alert">{error}</p>}
     <footer><button type="button" onClick={onClose}>Cancel</button>
       <button type="button" className="is-primary" disabled={!allowed||!areas.length}
         onClick={apply}>Confirm bulk edit</button></footer>
   </section>
 </div>,document.body);
}
