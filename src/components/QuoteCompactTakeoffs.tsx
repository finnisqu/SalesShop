import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {Quote,QuoteSection,QuoteTakeoffPiece,QuoteTakeoffSink,QuoteLine} from '../types/quote';
import {quoteLineAmount,quoteLinesTotal} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
import {handleQuickGridKey} from '../services/quoteGridNavigation';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {newTakeoffPiece,newTakeoffSink,takeoffPieceSf,takeoffPieceSplashSf,
 parseInches,takeoffPieceMiterInches} from '../services/quoteTakeoffsLite';
import {quickAreaSummary} from '../services/quoteQuickAreaSummary';
import {TakeoffSinkCatalog} from './TakeoffCatalogPickers';
import type {QuoteScopeRowRef,QuoteScopeBulkOperation} from '../services/quoteScopeRowBatch';
import './quote-compact-takeoffs.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const sf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const key=(r:QuoteScopeRowRef)=>[r.kind,r.sectionId??'',r.id].join(':');
function SmallInput({value,label,commit,inches=false,integer=false,disabled=false,allowNegative=false,alwaysInput=false}:{
 value?:number;label:string;commit:(n:number|undefined)=>void;
 inches?:boolean;integer?:boolean;disabled?:boolean;allowNegative?:boolean;alwaysInput?:boolean;
}){
 const [editing,setEditing]=useState(false);
 const [draft,setDraft]=useState(value===undefined?'':String(value));
 const cancelled=useRef(false);
 const selectOriginal=useRef(true);
 useEffect(()=>{if(!editing)setDraft(value===undefined?'':String(value));},[value,editing]);
 const save=()=>{
  if(cancelled.current){cancelled.current=false;setEditing(false);return;}
  const raw=draft.trim();
  if(!raw){if(value!==undefined)commit(undefined);setEditing(false);return;}
  const n=inches?parseInches(raw):Number(raw);
  if(n!==undefined&&Number.isFinite(n)&&(n>=0||allowNegative)&&(!integer||Number.isInteger(n))){
   if(n!==value)commit(n);
  }else setDraft(value===undefined?'':String(value));
  setEditing(false);
 };
 if(disabled&&!alwaysInput)return <span className="qqt-readonly" title={label}>{value===undefined?'—':String(value)}</span>;
 if(!editing&&!alwaysInput)return <button type="button" data-quick-grid-editable="true" className="qqt-cell-value is-editable"
  aria-label={'Edit '+label} title={'Click or type to edit '+label}
  onClick={()=>{selectOriginal.current=true;setEditing(true);}}
  onKeyDown={event=>{
   if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&/^[0-9.-]$/.test(event.key)){
    event.preventDefault();selectOriginal.current=false;setDraft(event.key);setEditing(true);
   }
  }}
  onPaste={event=>{
   const text=event.clipboardData.getData('text/plain').trim();
   if(!text)return;
   event.preventDefault();selectOriginal.current=false;setDraft(text);setEditing(true);
  }}>{value===undefined?'—':String(value)}</button>;
 return <input className="qqt-input is-editing" data-quick-grid-editable={alwaysInput?undefined:'true'}
   autoFocus={editing} disabled={disabled} type="text" aria-label={label}
  inputMode="decimal" value={draft} onChange={e=>setDraft(e.target.value)}
  onFocus={e=>{if(selectOriginal.current)e.currentTarget.select();}}
  onBlur={save} onKeyDown={e=>{
   if(e.key==='Enter'||e.key==='Tab')e.currentTarget.blur();
   if(e.key==='Escape'){cancelled.current=true;setDraft(value===undefined?'':String(value));e.currentTarget.blur();}
  }}/>;
}
function SmallText({value,label,commit,disabled=false,placeholder='—'}:{
 value:string;label:string;commit:(value:string)=>void;disabled?:boolean;placeholder?:string;
}){
 const [editing,setEditing]=useState(false);
 const [draft,setDraft]=useState(value);
 const cancelled=useRef(false);
 const selectOriginal=useRef(true);
 useEffect(()=>{if(!editing)setDraft(value);},[value,editing]);
 if(disabled)return <span className="qqt-readonly" title={label}>{value||placeholder}</span>;
 if(!editing)return <button type="button" data-quick-grid-editable="true" className="qqt-cell-value qqt-cell-text is-editable"
  title={value||'Click to enter '+label} aria-label={'Edit '+label}
  onClick={()=>{selectOriginal.current=true;setEditing(true);}}
  onKeyDown={event=>{
   if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.length===1&&event.key!==' '){
    event.preventDefault();selectOriginal.current=false;setDraft(event.key);setEditing(true);
   }
  }}
  onPaste={event=>{
   const text=event.clipboardData.getData('text/plain');
   if(!text)return;
   event.preventDefault();selectOriginal.current=false;setDraft(text);setEditing(true);
  }}>{value||placeholder}</button>;
 return <input type="text" data-quick-grid-editable="true" className="qqt-text is-editing" autoFocus aria-label={label}
  value={draft} onChange={e=>setDraft(e.target.value)}
  onFocus={e=>{if(selectOriginal.current)e.currentTarget.select();}}
  onBlur={()=>{if(!cancelled.current&&draft!==value)commit(draft);cancelled.current=false;setEditing(false);}}
  onKeyDown={e=>{
   if(e.key==='Enter'||e.key==='Tab')e.currentTarget.blur();
   if(e.key==='Escape'){cancelled.current=true;setDraft(value);e.currentTarget.blur();}
  }}/>;
}
function DetailPopup({quote,section,piece,sink,line,onClose}:{
 quote:Quote;section:QuoteSection|null;piece?:QuoteTakeoffPiece;sink?:QuoteTakeoffSink;
 line?:QuoteLine;onClose:()=>void;
}){
 const editable=quoteIsCommerciallyEditable(quote),store=useQuoteStore.getState();
 const ref=useRef<HTMLDivElement>(null);
 const closeRef=useRef(onClose);
 closeRef.current=onClose;
 useEffect(()=>{
  const fn=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape')closeRef.current();};
  document.addEventListener('keydown',fn);
  ref.current?.querySelector<HTMLButtonElement>('.qqt-close')?.focus();
  return()=>document.removeEventListener('keydown',fn);
 },[piece?.id,sink?.id,line?.id]);
 const patchPiece=(patch:Partial<QuoteTakeoffPiece>)=>{
  if(!section||!piece)return;
  store.updateTakeoffPieces(quote.id,section.id,(section.scope?.takeoffPieces??[])
   .map(p=>p.id===piece.id?{...p,...patch}:p));
 };
 const patchSink=(patch:Partial<QuoteTakeoffSink>)=>{
  if(!section||!sink)return;
  store.updateTakeoffSinks(quote.id,section.id,(section.scope?.takeoffSinks??[])
   .map(s=>s.id===sink.id?{...s,...patch}:s));
 };
 const patchLine=(patch:Partial<QuoteLine>)=>{
  if(line)store.updateLine(quote.id,line.id,patch);
 };
 const title=piece?.name||sink?.name||line?.description||'Row details';
 return createPortal(<div className="qmb qqt-overlay" onPointerDown={e=>{
  if(e.target===e.currentTarget)onClose();
 }}>
   <div className="qqt-panel" role="dialog" aria-modal="true" ref={ref} aria-label={'Edit '+title}>
    <header><div><small>{section?.title??'General'}</small><h2>{title||'Untitled item'}</h2></div>
     <button className="qqt-close" type="button" onClick={onClose} aria-label="Close line details">×</button></header>
    <div className="qqt-panel-body">
     {piece&&<><p>Measured geometry remains saved even if this piece or its splashes are excluded from the contract.</p>
       <label>Piece name<input type="text" disabled={!editable} value={piece.name}
        onChange={e=>patchPiece({name:e.target.value})}/></label>
       <label>Edge profile<input type="text" disabled={!editable} value={piece.edgeProfile??'Flat'}
        onChange={e=>patchPiece({edgeProfile:e.target.value})}/></label>
       <div className="qqt-two">
        <label>Quantity<SmallInput alwaysInput label="Piece quantity" integer disabled={!editable}
         value={piece.count} commit={v=>{if(v!==undefined&&v>=1)patchPiece({count:v});}}/></label>
        <label>Splash height (in)<SmallInput alwaysInput label="Splash height" disabled={!editable}
         value={piece.splashHeightIn??4} commit={v=>patchPiece({splashHeightIn:v??4})}/></label>
       </div>
       <strong>Splash edges</strong>
       {([['backsplash','Back'],['leftSplash','Left'],['rightSplash','Right']] as const)
        .map(([field,label])=><label className="qqt-check-label" key={field}>
         <input type="checkbox" disabled={!editable} checked={!!piece[field]}
          onChange={e=>patchPiece({[field]:e.target.checked})}/>{label}</label>)}
       <strong>Miter edges · {sf.format(takeoffPieceMiterInches(piece))} in</strong>
       {([['miterFront','Front'],['miterLeft','Left'],['miterRight','Right']] as const)
        .map(([field,label])=><label className="qqt-check-label" key={field}>
         <input type="checkbox" disabled={!editable} checked={!!piece[field]}
          onChange={e=>patchPiece({[field]:e.target.checked})}/>{label}</label>)}
      </>}
     {sink&&section&&<>
       <label>Sink model / Catalog
        <TakeoffSinkCatalog disabled={!editable} value={sink.name}
         onTextChange={name=>patchSink({name,sinkReference:undefined})}
         onSelect={patchSink}/>
       </label>
       <div className="qqt-two">
        <label>Category<select disabled={!editable} value={sink.category}
          onChange={e=>patchSink({category:e.target.value as QuoteTakeoffSink['category']})}>
          <option value="kitchen">Kitchen</option><option value="vanity">Vanity</option>
          <option value="bar-prep">Bar / Prep</option><option value="laundry">Laundry</option>
          <option value="other">Other</option>
        </select></label>
        <label>Quantity<SmallInput alwaysInput label="Sink quantity" value={sink.count} integer disabled={!editable}
          commit={v=>{if(v!==undefined&&v>=1)patchSink({count:v});}}/></label>
        <label>Unit selling price<SmallInput alwaysInput label="Sink unit selling price" value={sink.unitPrice}
          disabled={!editable} commit={v=>patchSink({unitPrice:v})}/></label>
        <label>Private unit cost<SmallInput alwaysInput label="Sink private unit cost" value={sink.internalCostOverride}
          disabled={!editable} commit={v=>patchSink({internalCostOverride:v})}/></label>
       </div>
       <label className="qqt-check-label"><input type="checkbox" disabled={!editable}
         checked={sink.includeInPricing&&!sink.excludedFromContract}
         onChange={e=>store.setTakeoffSinkCharge(quote.id,section.id,sink.id,e.target.checked)}/>
        Include sink in customer price</label>
      </>}
     {line&&<>
       <label>Description<input type="text" disabled={!editable} value={line.description}
        onChange={e=>patchLine({description:e.target.value})}/></label>
       <label>Pricing method<select disabled={!editable} value={line.pricingMode}
        onChange={e=>patchLine({pricingMode:e.target.value as QuoteLine['pricingMode']})}>
        <option value="direct">Fixed price</option><option value="quantity-rate">Quantity × rate</option>
        <option value="none">Notes only</option>
        {line.pricingMode==='slab-multiplier'&&<option value="slab-multiplier">Slab multiplier</option>}
       </select></label>
       <div className="qqt-two">
        {line.pricingMode==='quantity-rate'&&<label>Quantity
         <SmallInput alwaysInput label="Charge quantity" disabled={!editable||line.quantitySource?.syncMode==='live'}
          value={line.quantity} commit={v=>patchLine({quantity:v})}/></label>}
        <label>{line.pricingMode==='quantity-rate'?'Unit rate':'Customer price'}
         <SmallInput alwaysInput label="Customer charge price" disabled={!editable}
          value={line.pricingMode==='quantity-rate'?line.rate:line.amount}
          commit={v=>patchLine(line.pricingMode==='quantity-rate'?{rate:v}:{amount:v})}/></label>
        <label>Private cost<SmallInput alwaysInput label="Private charge cost" disabled={!editable}
         value={line.internalCost} commit={v=>patchLine({internalCost:v})}/></label>
       </div>
       {line.costCategory==='product'&&<div className="qqt-two">
        <label>Supplier<input type="text" disabled={!editable} value={line.supplierName??''}
         onChange={e=>patchLine({supplierName:e.target.value})}/></label>
        <label>SKU<input type="text" disabled={!editable} value={line.productCode??''}
         onChange={e=>patchLine({productCode:e.target.value})}/></label>
       </div>}
      </>}
    </div>
    <footer><button type="button" onClick={onClose}>Done</button></footer>
   </div>
  </div>,document.querySelector('.sales-app')??document.body);
}
export function QuoteCompactTakeoffs({quote,onAdvanced,focusArea}:{
 quote:Quote;onAdvanced:(areaId:string)=>void;focusArea?:string|null;
}){
 const store=useQuoteStore.getState(),editable=quoteIsCommerciallyEditable(quote);
 const list=useRef<HTMLDivElement>(null);
 const [detail,setDetail]=useState<{areaId:string|null;id:string;kind:'piece'|'sink'|'line'}|null>(null);
 useEffect(()=>{
  if(!focusArea)return;
  const target=Array.from(list.current?.querySelectorAll<HTMLElement>('[data-area-id]')??[])
   .find(el=>el.dataset.areaId===focusArea);
  target?.scrollIntoView({block:'nearest',behavior:'smooth'});
 },[focusArea]);
 const [selected,setSelected]=useState<QuoteScopeRowRef[]>([]);
 const [target,setTarget]=useState('');
 const areas=quote.sections.filter(s=>!isGeneralTakeoffSection(s));
 useEffect(()=>{setSelected([]);setDetail(null);},[quote.id]);
 const selectedKeys=new Set(selected.map(key));
 const changeSelected=(ref:QuoteScopeRowRef,on:boolean)=>setSelected(old=>on?
  [...old.filter(r=>key(r)!==key(ref)),ref]:old.filter(r=>key(r)!==key(ref)));
 const select=(ref:QuoteScopeRowRef)=><input type="checkbox" aria-label={'Select '+ref.kind+' '+ref.id}
  checked={selectedKeys.has(key(ref))} onChange={e=>changeSelected(ref,e.target.checked)}/>;
 const contract=(ref:QuoteScopeRowRef,isExcluded:boolean)=><button type="button"
  className={'qqt-contract'+(isExcluded?' is-excluded':'')}
  disabled={!editable} onClick={()=>store.bulkScopeRows(quote.id,[ref],isExcluded?'restore':'exclude')}>
   {isExcluded?'Restore':'Include ✓'}</button>;
 const addPiece=(section:QuoteSection)=>store.updateTakeoffPieces(quote.id,section.id,
  [...(section.scope?.takeoffPieces??[]),newTakeoffPiece((section.scope?.takeoffPieces?.length??0)+1)]);
 const addSink=(section:QuoteSection)=>store.updateTakeoffSinks(quote.id,section.id,
  [...(section.scope?.takeoffSinks??[]),newTakeoffSink()]);
 const addLine=(section:QuoteSection|null)=>store.addLine(quote.id,'item',section?.id);
 const setPiece=(section:QuoteSection,piece:QuoteTakeoffPiece,changes:Partial<QuoteTakeoffPiece>)=>
  store.updateTakeoffPieces(quote.id,section.id,(section.scope?.takeoffPieces??[])
   .map(p=>p.id===piece.id?{...p,...changes}:p));
 const setSink=(section:QuoteSection,sink:QuoteTakeoffSink,patch:Partial<QuoteTakeoffSink>)=>
  store.updateTakeoffSinks(quote.id,section.id,(section.scope?.takeoffSinks??[])
   .map(item=>item.id===sink.id?{...item,...patch}:item));
 const deleteRow=(ref:QuoteScopeRowRef)=>{
  if(!editable)return;
  const section=quote.sections.find(s=>s.id===ref.sectionId);
  if(ref.kind==='line'){
   const line=quote.lines.find(l=>l.id===ref.id);
   if(!line||line.quantitySource?.syncMode==='live'||line.takeoffSinkId)return;
   if(window.confirm('Delete this charge? You can Undo.'))store.deleteLine(quote.id,line.id);
   return;
  }
  if(!section)return;
  if(ref.kind==='sink'){
   if(window.confirm('Delete this sink? You can Undo.'))
    store.updateTakeoffSinks(quote.id,section.id,(section.scope?.takeoffSinks??[]).filter(s=>s.id!==ref.id));
  }else if(ref.kind==='piece'){
   if(window.confirm('Delete this measured piece and its attached splash? You can Undo.'))
    store.updateTakeoffPieces(quote.id,section.id,(section.scope?.takeoffPieces??[]).filter(p=>p.id!==ref.id));
  }else if(ref.kind==='splash'){
   if(window.confirm('Remove splash edges from this piece? The top measurements stay. You can Undo.'))
    store.updateTakeoffPieces(quote.id,section.id,(section.scope?.takeoffPieces??[]).map(p=>p.id===ref.id
     ?{...p,backsplash:false,leftSplash:false,rightSplash:false,excludeSplashFromQuote:false}:p));
  }
 };
 const setChargeTotal=(line:QuoteLine,total:number|undefined)=>{
  if(line.quantitySource?.syncMode==='live')return;
  if(line.pricingMode==='quantity-rate'&&(line.quantity??0)>0)
   store.updateLine(quote.id,line.id,{rate:total===undefined?undefined:
    Math.round(total/(line.quantity??1)*10000)/10000,rateReference:undefined});
  else store.updateLine(quote.id,line.id,{pricingMode:'direct',amount:total,rate:undefined});
 };
 const apply=(operation:QuoteScopeBulkOperation)=>{
  if(!selected.length||!editable||(operation==='move'&&!target))return;
  if(operation==='delete'&&!window.confirm('Delete '+selected.length+' selected takeoff row(s)? Measurements and charges are removed; Undo is available.'))return;
  if(operation==='move'&&selected.some(r=>r.kind==='splash'&&!selected.some(p=>
   p.kind==='piece'&&p.id===r.id&&p.sectionId===r.sectionId)))return;
  const targetId=target==='general'?undefined:target;
  const valid=operation!=='move'||target==='general'
   ?operation!=='move'||selected.every(r=>r.kind==='line')
   :areas.some(s=>s.id===target);
  if(!valid)return;
  store.bulkScopeRows(quote.id,selected,operation,targetId);
  setSelected([]);
 };
 const row=(ref:QuoteScopeRowRef,area:string,description:ReactNode,qty:ReactNode,length:ReactNode,
  width:ReactNode,sfValue:ReactNode,price:ReactNode,excluded:boolean,edit:()=>void,issue=false,remove?:()=>void)=>
  <div className={'qqt-row qqt-grid'+(excluded?' is-excluded':'')+(issue?' has-issue':'')}
   key={key(ref)} data-quick-grid-row={key(ref)}>
   <div className="qqt-cell qqt-check">{select(ref)}</div>
   <div className="qqt-cell qqt-area" title={area}>{area}</div>
   <div className="qqt-cell qqt-description">{description}</div>
   <div className={'qqt-cell'+(typeof qty==='number'||typeof qty==='string'?' qqt-derived-cell':'')}>{qty}</div>
   <div className={'qqt-cell'+(typeof length==='string'?' qqt-derived-cell':'')}>{length}</div>
   <div className={'qqt-cell'+(typeof width==='string'?' qqt-derived-cell':'')}>{width}</div>
   <div className="qqt-cell qqt-number qqt-derived-cell">{sfValue}</div>
   <div className="qqt-cell qqt-number">{price}</div>
   <div className="qqt-cell">{contract(ref,excluded)}</div>
   <div className="qqt-cell qqt-actions">
    <button type="button" className="qqt-edit-button"
     aria-label={'More settings for '+area+' '+ref.kind} onClick={edit} title="Detailed settings">✎</button>
    <button type="button" className="qqt-delete-button" disabled={!editable||!remove}
     aria-label={'Delete '+area+' '+ref.kind} title="Delete row (Undo available)"
     onClick={remove}>×</button>
   </div>
  </div>;
 return <section className="qqt-workspace" aria-label="Takeoffs spreadsheet">
  <header className={'qqt-heading'+(selected.length?' is-selecting':'')}>
    {selected.length?<div className="qqt-bulk" role="toolbar" aria-label="Bulk edit takeoff lines">
     <strong>{selected.length} selected</strong>
     <button type="button" disabled={!editable} onClick={()=>apply('exclude')}>Strike out</button>
     <button type="button" disabled={!editable} onClick={()=>apply('restore')}>Restore</button>
     <select aria-label="Move selected rows to Area" value={target} onChange={e=>setTarget(e.target.value)}>
      <option value="">Move to…</option>{areas.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}
      <option value="general">General (charges only)</option>
     </select>
     <button type="button" disabled={!editable||!target} onClick={()=>apply('move')}>Move</button>
     <button type="button" className="qqt-delete-selected" disabled={!editable}
      onClick={()=>apply('delete')}>Delete</button>
     <button type="button" onClick={()=>{setSelected([]);setTarget('');}}>Clear ×</button>
    </div>:<div><h3>Takeoffs</h3>
     <span>Click, type or paste to edit · Tab/Enter to move · pencil for more</span></div>}
    <button type="button" onClick={()=>areas[0]&&onAdvanced(areas[0].id)}>Advanced fabrication ↗</button>
   </header>
  <div className="qqt-scroll" role="region" aria-label="Takeoff detail rows" tabIndex={0} ref={list}
   onKeyDownCapture={event=>handleQuickGridKey(event,event.currentTarget)}>
   <div className="qqt-header qqt-grid">
    {['','Area','Piece / Item','Qty','Length (in)','Width (in)','Square feet','Selling price','Contract','Actions']
     .map((h,i)=><div key={i} className="qqt-cell">{h}</div>)}
   </div>
   {areas.map(section=>{
    const pieces=section.scope?.takeoffPieces??[],sinks=section.scope?.takeoffSinks??[];
    const summary=quickAreaSummary(quote,section);
    const primary=summary.primary;
    const otherLines=summary.specialty;
    const pieceTotal=summary.measuredSf;
    return <div className="qqt-area-block" key={section.id} data-area-id={section.id}>
     <div className="qqt-group"><strong>{section.title}</strong>
      <span>{sf.format(summary.measuredSf)} measured SF · {sf.format(summary.billedSf)} billed</span>
      <div>
       <button disabled={!editable} type="button" onClick={()=>addPiece(section)}>+ Piece</button>
       <button disabled={!editable} type="button" onClick={()=>addSink(section)}>+ Sink</button>
       <button disabled={!editable} type="button" onClick={()=>addLine(section)}>+ Charge</button>
      </div><strong>{money.format(summary.total)}</strong></div>
     {pieces.map(piece=>{
      const topSf=takeoffPieceSf(piece);
      const allocated=pieceTotal>0&&!piece.excludedFromQuote&&primary?.includeInTotal
       ?quoteLineAmount(primary)*topSf/pieceTotal:0;
      const ref:QuoteScopeRowRef={kind:'piece',id:piece.id,sectionId:section.id};
      const edit=()=>setDetail({areaId:section.id,id:piece.id,kind:'piece'});
      return <div key={piece.id}>
       {row(ref,section.title,<SmallText label={'Piece name '+piece.id} value={piece.name} disabled={!editable}
         commit={name=>setPiece(section,piece,{name})}/>,
        <SmallInput label={'Quantity '+piece.name} integer disabled={!editable} value={piece.count}
         commit={v=>{if(v!==undefined&&v>0)setPiece(section,piece,{count:v});}}/>,
        <SmallInput label={'Length '+piece.name} inches disabled={!editable} value={piece.lengthIn}
         commit={v=>setPiece(section,piece,{lengthIn:v})}/>,
        <SmallInput label={'Width '+piece.name} inches disabled={!editable} value={piece.widthIn}
         commit={v=>setPiece(section,piece,{widthIn:v})}/>,
        sf.format(topSf),<span className="qqt-readonly" title="Allocated Area price; not a second billable line">
         {money.format(allocated)}</span>,!!piece.excludedFromQuote,edit,!piece.lengthIn||!piece.widthIn,
         ()=>deleteRow(ref))}
       {(piece.backsplash||piece.leftSplash||piece.rightSplash)&&
        row({kind:'splash',id:piece.id,sectionId:section.id},section.title,'↳ Splash · '+piece.name,
         piece.count,'—',<SmallInput label={'Splash height '+piece.name} value={piece.splashHeightIn??4}
          disabled={!editable} commit={v=>setPiece(section,piece,{splashHeightIn:v??4})}/>,
         sf.format(takeoffPieceSplashSf(piece)),
         <span className="qqt-readonly" title="This selling price is included in Area stone pricing">Included in stone</span>,
         !!piece.excludedFromQuote||!!piece.excludeSplashFromQuote,edit,false,
         ()=>deleteRow({kind:'splash',id:piece.id,sectionId:section.id}))}
      </div>;
     })}
     {sinks.map(sink=>{
      const ref:QuoteScopeRowRef={kind:'sink',id:sink.id,sectionId:section.id};
      const sinkAmount=quote.lines.filter(l=>l.sectionId===section.id&&l.takeoffSinkId===sink.id&&l.includeInTotal)
       .reduce((sum,line)=>sum+quoteLineAmount(line),0);
      return row(ref,section.title,
       <SmallText label={'Sink model '+sink.id} value={sink.name} disabled={!editable}
         placeholder="Choose sink" commit={name=>setSink(section,sink,{name,sinkReference:undefined})}/>,
       <SmallInput label={'Sink quantity '+sink.name} value={sink.count} integer disabled={!editable}
        commit={v=>{if(v!==undefined&&v>=1)setSink(section,sink,{count:v});}}/>,
       '—','—','—',
       <SmallInput label={'Sink selling total '+sink.name} value={sinkAmount} disabled={!editable}
        commit={v=>{if(v!==undefined&&sink.count>0)
         setSink(section,sink,{unitPrice:Math.round(v/sink.count*100)/100});}}/>,
       !!sink.excludedFromContract,
       ()=>setDetail({areaId:section.id,id:sink.id,kind:'sink'}),!sink.name.trim(),
       ()=>deleteRow(ref));
     })}
     {otherLines.map(line=>{
       const ref:QuoteScopeRowRef={kind:'line',id:line.id,sectionId:section.id};
       return row(ref,section.title,
        <SmallText label={'Charge description '+line.id} value={line.description} disabled={!editable}
         commit={description=>store.updateLine(quote.id,line.id,{description})}/>,
        line.pricingMode==='quantity-rate'
         ?<SmallInput label={'Charge quantity '+line.id} value={line.quantity} disabled={!editable||line.quantitySource?.syncMode==='live'}
           commit={v=>store.updateLine(quote.id,line.id,{quantity:v})}/>
         :line.quantity??1,
        '—','—','—',
        <SmallInput label={'Charge selling total '+line.id} value={line.includeInTotal?quoteLineAmount(line):0}
         disabled={!editable||line.quantitySource?.syncMode==='live'||!line.includeInTotal}
         allowNegative={line.kind==='discount'} commit={v=>setChargeTotal(line,v)}/>,
        !line.includeInTotal,
        ()=>setDetail({areaId:section.id,id:line.id,kind:'line'}),false,
        ()=>deleteRow(ref));
      })}
     {!pieces.length&&!sinks.length&&!otherLines.length&&
      <div className="qqt-empty">No takeoffs yet. Add a piece, sink or charge.</div>}
    </div>;
   })}
   <div className="qqt-area-block"><div className="qqt-group">
    <strong>General</strong><span>Project-wide charges and adjustments</span>
    <div><button type="button" disabled={!editable} onClick={()=>addLine(null)}>+ Charge</button></div></div>
    {quote.lines.filter(line=>!line.sectionId||
     !quote.sections.some(s=>s.id===line.sectionId)||quote.sections.some(s=>s.id===line.sectionId&&isGeneralTakeoffSection(s)))
     .map(line=>{
      const ref:QuoteScopeRowRef={kind:'line',id:line.id,sectionId:line.sectionId};
      return row(ref,'General',
       <SmallText label={'General charge description '+line.id} value={line.description} disabled={!editable}
         commit={description=>store.updateLine(quote.id,line.id,{description})}/>,
       line.pricingMode==='quantity-rate'
        ?<SmallInput label={'General charge quantity '+line.id} value={line.quantity}
          disabled={!editable||line.quantitySource?.syncMode==='live'}
          commit={v=>store.updateLine(quote.id,line.id,{quantity:v})}/>
        :line.quantity??1,
       '—','—','—',
       <SmallInput label={'General charge selling total '+line.id} value={line.includeInTotal?quoteLineAmount(line):0}
        disabled={!editable||line.quantitySource?.syncMode==='live'||!line.includeInTotal}
        allowNegative={line.kind==='discount'} commit={v=>setChargeTotal(line,v)}/>,
       !line.includeInTotal,()=>setDetail({areaId:null,id:line.id,kind:'line'}),false,
       ()=>deleteRow(ref));
     })}
   </div>
  </div>
  <footer className="qqt-total">Striking out a row preserves the measurements and excludes it from current pricing.</footer>
  {detail&&<DetailPopup quote={quote} section={quote.sections.find(s=>s.id===detail.areaId)??null}
   piece={detail.kind==='piece'?quote.sections.find(s=>s.id===detail.areaId)?.scope?.takeoffPieces?.find(p=>p.id===detail.id):undefined}
   sink={detail.kind==='sink'?quote.sections.find(s=>s.id===detail.areaId)?.scope?.takeoffSinks?.find(p=>p.id===detail.id):undefined}
   line={detail.kind==='line'?quote.lines.find(l=>l.id===detail.id):undefined}
   onClose={()=>setDetail(null)}/>}
 </section>;
}
