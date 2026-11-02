import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {Quote,QuoteSection,QuoteTakeoffPiece,QuoteTakeoffSink,QuoteLine} from '../types/quote';
import {quoteLineAmount,quoteLinesTotal} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
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
function SmallInput({value,label,commit,inches=false,integer=false,disabled=false}:{
 value?:number;label:string;commit:(n:number|undefined)=>void;
 inches?:boolean;integer?:boolean;disabled?:boolean;
}){
 const [draft,setDraft]=useState(value===undefined?'':String(value));
 useEffect(()=>setDraft(value===undefined?'':String(value)),[value]);
 const save=()=>{
  if(!draft.trim()){if(value!==undefined)commit(undefined);return;}
  const n=inches?parseInches(draft):Number(draft);
  if(n!==undefined&&Number.isFinite(n)&&n>=0&&(!integer||Number.isInteger(n))){
   if(n!==value)commit(n);
  }else setDraft(value===undefined?'':String(value));
 };
 return <input className="qqt-input" type="text" aria-label={label} disabled={disabled}
  inputMode="decimal" value={draft} onChange={e=>setDraft(e.target.value)}
  onBlur={save} onKeyDown={e=>{
   if(e.key==='Enter')e.currentTarget.blur();
   if(e.key==='Escape'){setDraft(value===undefined?'':String(value));e.currentTarget.blur();}
  }}/>;
}
function DetailPopup({quote,section,piece,sink,line,onClose}:{
 quote:Quote;section:QuoteSection|null;piece?:QuoteTakeoffPiece;sink?:QuoteTakeoffSink;
 line?:QuoteLine;onClose:()=>void;
}){
 const editable=quoteIsCommerciallyEditable(quote),store=useQuoteStore.getState();
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const fn=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape')onClose();};
  document.addEventListener('keydown',fn);
  ref.current?.querySelector<HTMLButtonElement>('.qqt-close')?.focus();
  return()=>document.removeEventListener('keydown',fn);
 },[onClose]);
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
        <label>Quantity<SmallInput label="Piece quantity" integer disabled={!editable}
         value={piece.count} commit={v=>{if(v!==undefined&&v>=1)patchPiece({count:v});}}/></label>
        <label>Splash height (in)<SmallInput label="Splash height" disabled={!editable}
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
        <label>Quantity<SmallInput label="Sink quantity" value={sink.count} integer disabled={!editable}
          commit={v=>{if(v!==undefined&&v>=1)patchSink({count:v});}}/></label>
        <label>Unit selling price<SmallInput label="Sink unit selling price" value={sink.unitPrice}
          disabled={!editable} commit={v=>patchSink({unitPrice:v})}/></label>
        <label>Private unit cost<SmallInput label="Sink private unit cost" value={sink.internalCostOverride}
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
         <SmallInput label="Charge quantity" disabled={!editable||line.quantitySource?.syncMode==='live'}
          value={line.quantity} commit={v=>patchLine({quantity:v})}/></label>}
        <label>{line.pricingMode==='quantity-rate'?'Unit rate':'Customer price'}
         <SmallInput label="Customer charge price" disabled={!editable}
          value={line.pricingMode==='quantity-rate'?line.rate:line.amount}
          commit={v=>patchLine(line.pricingMode==='quantity-rate'?{rate:v}:{amount:v})}/></label>
        <label>Private cost<SmallInput label="Private charge cost" disabled={!editable}
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
export function QuoteCompactTakeoffs({quote,onAdvanced}:{
 quote:Quote;onAdvanced:(areaId:string)=>void;
}){
 const store=useQuoteStore.getState(),editable=quoteIsCommerciallyEditable(quote);
 const [detail,setDetail]=useState<{areaId:string|null;id:string;kind:'piece'|'sink'|'line'}|null>(null);
 const [selected,setSelected]=useState<QuoteScopeRowRef[]>([]);
 const [bulk,setBulk]=useState<QuoteScopeBulkOperation>('exclude');
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
 const apply=()=>{
  if(!selected.length||!editable||(bulk==='move'&&!target))return;
  if(bulk==='move'&&selected.some(r=>r.kind==='splash'&&!selected.some(p=>
   p.kind==='piece'&&p.id===r.id&&p.sectionId===r.sectionId)))return;
  const targetId=target==='general'?undefined:target;
  const valid=bulk!=='move'||target==='general'
   ?bulk!=='move'||selected.every(r=>r.kind==='line')
   :areas.some(s=>s.id===target);
  if(!valid)return;
  store.bulkScopeRows(quote.id,selected,bulk,targetId);
  setSelected([]);
 };
 const row=(ref:QuoteScopeRowRef,area:string,description:ReactNode,qty:ReactNode,length:ReactNode,
  width:ReactNode,sfValue:ReactNode,price:ReactNode,excluded:boolean,edit:()=>void,issue=false)=>
  <div className={'qqt-row qqt-grid'+(excluded?' is-excluded':'')+(issue?' has-issue':'')} key={key(ref)}>
   <div className="qqt-cell qqt-check">{select(ref)}</div>
   <div className="qqt-cell qqt-area" title={area}>{area}</div>
   <div className="qqt-cell qqt-description">{description}</div>
   <div className="qqt-cell">{qty}</div>
   <div className="qqt-cell">{length}</div>
   <div className="qqt-cell">{width}</div>
   <div className="qqt-cell qqt-number">{sfValue}</div>
   <div className="qqt-cell qqt-number">{price}</div>
   <div className="qqt-cell">{contract(ref,excluded)}</div>
   <div className="qqt-cell"><button type="button" className="qqt-edit-button"
    aria-label={'Edit '+area+' '+ref.kind} onClick={edit}>✎</button></div>
  </div>;
 return <section className="qqt-workspace" aria-label="Takeoffs spreadsheet">
  <header className="qqt-heading"><div><h3>Takeoffs</h3>
   <span>One row per piece, splash, sink or charge · detailed settings on ✎</span></div>
   <button type="button" onClick={()=>areas[0]&&onAdvanced(areas[0].id)}>Advanced fabrication ↗</button></header>
  {!!selected.length&&<div className="qqt-bulk" role="toolbar" aria-label="Bulk edit takeoff lines">
    <strong>{selected.length} selected</strong>
    <select value={bulk} aria-label="Bulk operation" onChange={e=>setBulk(e.target.value as QuoteScopeBulkOperation)}>
     <option value="exclude">Strike out</option><option value="restore">Restore</option>
     <option value="move">Move to another Area</option></select>
    {bulk==='move'&&<select aria-label="Move to Area" value={target} onChange={e=>setTarget(e.target.value)}>
     <option value="">Choose Area</option>{areas.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}
     <option value="general">General (charges only)</option></select>}
    <button type="button" disabled={!editable||bulk==='move'&&!target} onClick={apply}>Apply</button>
    <button type="button" onClick={()=>setSelected([])}>Clear</button></div>}
  <div className="qqt-scroll" role="region" aria-label="Takeoff detail rows" tabIndex={0}>
   <div className="qqt-header qqt-grid">
    {['','Area','Piece / Item','Qty','Length (in)','Width (in)','Square feet','Selling $','Contract','Edit']
     .map((h,i)=><div key={i} className="qqt-cell">{h}</div>)}
   </div>
   {areas.map(section=>{
    const pieces=section.scope?.takeoffPieces??[],sinks=section.scope?.takeoffSinks??[];
    const summary=quickAreaSummary(quote,section);
    const primary=summary.primary;
    const otherLines=summary.specialty;
    const pieceTotal=summary.measuredSf;
    return <div className="qqt-area-block" key={section.id}>
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
       {row(ref,section.title,<input type="text" className="qqt-text" aria-label={'Piece name '+piece.id}
        value={piece.name} disabled={!editable} onChange={e=>setPiece(section,piece,{name:e.target.value})}/>,
        <SmallInput label={'Quantity '+piece.name} integer disabled={!editable} value={piece.count}
         commit={v=>{if(v!==undefined&&v>0)setPiece(section,piece,{count:v});}}/>,
        <SmallInput label={'Length '+piece.name} inches disabled={!editable} value={piece.lengthIn}
         commit={v=>setPiece(section,piece,{lengthIn:v})}/>,
        <SmallInput label={'Width '+piece.name} inches disabled={!editable} value={piece.widthIn}
         commit={v=>setPiece(section,piece,{widthIn:v})}/>,
        sf.format(topSf),<span title="Allocated Area price; not a second billable line">
         {money.format(allocated)}</span>,!!piece.excludedFromQuote,edit,!piece.lengthIn||!piece.widthIn)}
       {(piece.backsplash||piece.leftSplash||piece.rightSplash)&&
        row({kind:'splash',id:piece.id,sectionId:section.id},section.title,'↳ Splash · '+piece.name,
         piece.count,'—',sf.format(piece.splashHeightIn??4),sf.format(takeoffPieceSplashSf(piece)),
         <span title="Splash included in the Area stone selling price">Included in stone</span>,
         !!piece.excludedFromQuote||!!piece.excludeSplashFromQuote,edit)}
      </div>;
     })}
     {sinks.map(sink=>{
      const ref:QuoteScopeRowRef={kind:'sink',id:sink.id,sectionId:section.id};
      const sinkAmount=quote.lines.filter(l=>l.sectionId===section.id&&l.takeoffSinkId===sink.id&&l.includeInTotal)
       .reduce((sum,line)=>sum+quoteLineAmount(line),0);
      return row(ref,section.title,'Sink · '+(sink.name||'Choose model'),sink.count,'—','—','—',
       money.format(sinkAmount),!!sink.excludedFromContract,
       ()=>setDetail({areaId:section.id,id:sink.id,kind:'sink'}),!sink.name.trim());
     })}
     {otherLines.map(line=>row({kind:'line',id:line.id,sectionId:section.id},
      section.title,line.description,line.quantity??1,'—','—','—',
      money.format(line.includeInTotal?quoteLineAmount(line):0),!line.includeInTotal,
      ()=>setDetail({areaId:section.id,id:line.id,kind:'line'})))}
     {!pieces.length&&!sinks.length&&!otherLines.length&&
      <div className="qqt-empty">No takeoffs yet. Add a piece, sink or charge.</div>}
    </div>;
   })}
   <div className="qqt-area-block"><div className="qqt-group">
    <strong>General</strong><span>Project-wide charges and adjustments</span>
    <div><button type="button" disabled={!editable} onClick={()=>addLine(null)}>+ Charge</button></div></div>
    {quote.lines.filter(line=>!line.sectionId||
     !quote.sections.some(s=>s.id===line.sectionId)||quote.sections.some(s=>s.id===line.sectionId&&isGeneralTakeoffSection(s)))
     .map(line=>row({kind:'line',id:line.id,sectionId:line.sectionId},'General',line.description,
      line.quantity??1,'—','—','—',money.format(line.includeInTotal?quoteLineAmount(line):0),
      !line.includeInTotal,()=>setDetail({areaId:null,id:line.id,kind:'line'})))}
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
