import {useEffect,useRef,useState,type ReactNode,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {useQuoteStore} from '../store/quoteStore';
import type {Quote,QuoteLine,QuoteSection,QuoteTakeoffPiece,QuoteTakeoffSink} from '../types/quote';
import {quoteLineAmount,quoteLinesTotal,quoteTotal} from '../types/quote';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
import {newTakeoffPiece,newTakeoffSink,takeoffPieceSf,takeoffPieceSplashSf,
 takeoffPieceMiterInches,totalBillableTakeoffSf,roundedBillableTakeoffSf,parseInches} from '../services/quoteTakeoffsLite';
import {QuoteInlineAreaName,QuoteInlineAreaRate} from './QuoteInlineAreaEditing';
import {SINK_CATEGORIES,SINK_CATEGORY_LABELS} from '../types/sink';
import {TakeoffMaterialCatalog,TakeoffSinkCatalog} from './TakeoffCatalogPickers';
import {CalculatorDrawer} from './QuoteWorkTables';
import type {QuoteScopeRowRef,QuoteScopeBulkOperation} from '../services/quoteScopeRowBatch';
import './quote-matrix-builder.css';

const cash=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const decimal=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const round=(n:number)=>Math.round(n*100)/100;
const keyOf=(row:QuoteScopeRowRef)=>[row.kind,row.sectionId??'',row.id].join(':');
const areaLines=(quote:Quote,id:string)=>quote.lines.filter(line=>line.sectionId===id);
const areaPrimary=(quote:Quote,id:string)=>{
 const lines=areaLines(quote,id);
 return lines.find(l=>l.quantitySource?.syncMode==='live'&&l.quantitySource.field==='countertopSf')
  ??lines.find(l=>l.kind==='material'&&!l.takeoffSinkId);
};
const areaMeasured=(section:QuoteSection)=>totalBillableTakeoffSf(section.scope?.takeoffPieces??[]);
const areaBilled=(section:QuoteSection)=>section.scope?.takeoffPieces?.length
 ?roundedBillableTakeoffSf(section.scope.takeoffPieces,section.scope.billableSfRounding)
 :section.scope?.countertopSf??0;
const sinkSell=(quote:Quote,id:string,sink:QuoteTakeoffSink)=>{
 const line=quote.lines.find(l=>l.sectionId===id&&l.takeoffSinkId===sink.id);
 return line?.includeInTotal?quoteLineAmount(line):0;
};
const cellMoney=(value:number|undefined)=>value===undefined?'—':cash.format(value);

/** Numeric values commit on blur, not on every keystroke; fractions work for inches. */
function CellNumber({value,label,disabled=false,integer=false,inches=false,onChange}:{
 value?:number;label:string;disabled?:boolean;integer?:boolean;inches?:boolean;
 onChange:(v:number|undefined)=>void;
}){
 const [draft,setDraft]=useState(value===undefined?'':String(value));
 useEffect(()=>setDraft(value===undefined?'':String(value)),[value]);
 const commit=()=>{
  if(draft.trim()===''){if(value!==undefined)onChange(undefined);return;}
  const next=inches?parseInches(draft):Number(draft);
  if(next!==undefined&&Number.isFinite(next)&&next>=0&&(!integer||Number.isInteger(next))){
   if(next!==value)onChange(next);
  }else setDraft(value===undefined?'':String(value));
 };
 return <input className="qmx-edit qmx-numeric" type="text" inputMode="decimal"
  aria-label={label} disabled={disabled} value={draft} onChange={e=>setDraft(e.target.value)}
  placeholder="—" onBlur={commit} onKeyDown={e=>{
   if(e.key==='Enter')e.currentTarget.blur();
   if(e.key==='Escape'){setDraft(value===undefined?'':String(value));e.currentTarget.blur();}
  }}/>;
}

/** Fixed-position picker escapes the sheet's scroll clipping and inherits app theme. */
function PopupCell({value,label,disabled=false,render}:{
 value:string;label:string;disabled?:boolean;render:(dismiss:()=>void)=>ReactNode;
}){
 const [open,setOpen]=useState(false);
 const [position,setPosition]=useState({top:80,left:12});
 const trigger=useRef<HTMLButtonElement>(null);
 const panel=useRef<HTMLDivElement>(null);
 const dismiss=()=>setOpen(false);
 useEffect(()=>{
  if(!open)return;
  panel.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus({preventScroll:true});
  const outside=(event:PointerEvent)=>{
   if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))setOpen(false);
  };
  const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
  const scroll=(event:Event)=>{if(!(event.target instanceof Node)||!panel.current?.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  window.addEventListener('resize',dismiss);
  window.addEventListener('scroll',scroll,true);
  return()=>{
   document.removeEventListener('pointerdown',outside);
   document.removeEventListener('keydown',escape);
   window.removeEventListener('resize',dismiss);
   window.removeEventListener('scroll',scroll,true);
  };
 },[open]);
 const launch=()=>{
  if(open){setOpen(false);return;}
  const rect=trigger.current?.getBoundingClientRect();
  if(rect)setPosition({top:Math.min(rect.bottom+5,window.innerHeight-290),
   left:Math.max(10,Math.min(rect.left,window.innerWidth-370))});
  setOpen(true);
 };
 return <><button ref={trigger} type="button" className="qmx-picker" onClick={launch}
   aria-label={label} aria-haspopup="dialog" aria-expanded={open} disabled={disabled}>
   <span>{value||'Select…'}</span><span aria-hidden="true">▾</span></button>
  {open&&createPortal(<div className="qmb qmx-popup" role="dialog" aria-label={label}
   style={{top:position.top,left:position.left}} ref={panel}>
   <header><strong>{label}</strong><button type="button" onClick={dismiss} aria-label="Close selection">×</button></header>
   <div className="qmx-popup-body">{render(dismiss)}</div>
  </div>,document.querySelector('.sales-app')??document.body)}</>;
}
function MaterialCell({quote,section,editable}:{quote:Quote;section:QuoteSection;editable:boolean}){
 const store=useQuoteStore.getState();
 return <PopupCell value={section.scope?.takeoffMaterial??''} label={'Material for '+section.title}
  disabled={!editable} render={dismiss=><TakeoffMaterialCatalog
   disabled={!editable} value={section.scope?.takeoffMaterial??''}
   selected={section.scope?.takeoffMaterialReference} pinned={quote.projectMaterials??[]}
   onTextChange={value=>store.selectTakeoffMaterial(quote.id,section.id,value)}
   onSelect={(ref,label)=>{store.selectTakeoffMaterial(quote.id,section.id,label,ref);dismiss();}}/>}/>;
}
function SinkModel({quote,section,sink,editable}:{quote:Quote;section:QuoteSection; sink:QuoteTakeoffSink;editable:boolean}){
 const store=useQuoteStore.getState();
 const patch=(changes:Partial<QuoteTakeoffSink>)=>store.updateTakeoffSinks(quote.id,section.id,
  (section.scope?.takeoffSinks??[]).map(item=>item.id===sink.id?{...item,...changes}:item));
 const model=sink.sinkReference?.snapshot?.modelCode??sink.name;
 return <PopupCell value={model||'Select model'} label={'Sink model for '+section.title} disabled={!editable}
  render={dismiss=><TakeoffSinkCatalog disabled={!editable} value={sink.name}
   onTextChange={name=>patch({name,sinkReference:undefined})}
   onSelect={changes=>{patch(changes);dismiss();}}/>}/>;
}
function EdgesCell({quote,section,piece,editable}:{quote:Quote;section:QuoteSection;piece:QuoteTakeoffPiece;editable:boolean}){
 const store=useQuoteStore.getState();
 const patch=(changes:Partial<QuoteTakeoffPiece>)=>store.updateTakeoffPieces(quote.id,section.id,
  (section.scope?.takeoffPieces??[]).map(item=>item.id===piece.id?{...item,...changes}:item));
 const labels=[['miterFront','Front'],['miterLeft','Left'],['miterRight','Right'],
  ['backsplash','Back splash'],['leftSplash','Left splash'],['rightSplash','Right splash']] as const;
 return <PopupCell value={takeoffPieceMiterInches(piece)>0?decimal.format(takeoffPieceMiterInches(piece))+' in':'Add edges'}
  label={'Edges for '+piece.name} disabled={!editable} render={()=><div className="qmx-edge-menu">
    {labels.map(([flag,label])=><label key={flag}><input type="checkbox"
     checked={!!piece[flag]} onChange={e=>patch({[flag]:e.target.checked})}/>{label}</label>)}
    <label>Edge profile<input type="text" value={piece.edgeProfile??'Flat'}
     onChange={e=>patch({edgeProfile:e.target.value})}/></label>
    <label>Splash height (in)<CellNumber label="Splash height" value={piece.splashHeightIn??4}
     onChange={v=>patch({splashHeightIn:v??4})}/></label>
  </div>}/>;
}
function SinkSummary({quote,section,kind,editable}:{quote:Quote;section:QuoteSection;kind:'kitchen'|'vanity';editable:boolean}){
 const store=useQuoteStore.getState();
 const sinks=(section.scope?.takeoffSinks??[]).filter(s=>s.category===kind&&!s.excludedFromContract);
 const first=sinks[0],id=section.id;
 const patch=(changes:Partial<QuoteTakeoffSink>)=>{
  if(!first)return;
  store.updateTakeoffSinks(quote.id,id,(section.scope?.takeoffSinks??[]).map(s=>s.id===first.id?{...s,...changes}:s));
 };
 const add=()=>store.updateTakeoffSinks(quote.id,id,[...(section.scope?.takeoffSinks??[]),
  {...newTakeoffSink(),category:kind}]);
 return <>
  <div className="qmx-cell">{first?<SinkModel quote={quote} section={section} sink={first} editable={editable}/>:
   <button type="button" className="qmx-add-small" disabled={!editable} onClick={add}>+ Sink</button>}
   {sinks.length>1&&<small>+{sinks.length-1} more in worksheet</small>}</div>
  <div className="qmx-cell">{first?<CellNumber label={section.title+' '+kind+' sink qty'}
   value={first.count} integer disabled={!editable} onChange={v=>{if(v!==undefined&&v>0)patch({count:v});}}/>:'—'}</div>
  <div className="qmx-cell">{first?<CellNumber label={section.title+' '+kind+' sink unit price'}
   value={first.unitPrice} disabled={!editable} onChange={v=>patch({unitPrice:v})}/>:'—'}</div>
  <div className="qmx-cell qmx-money">{first?cash.format(sinks.reduce((n,s)=>n+sinkSell(quote,id,s),0)):'—'}</div>
 </>;
}
function AreaRow({quote,section,editable,onCalculator}:{quote:Quote;section:QuoteSection;editable:boolean;onCalculator:(id:string)=>void}){
 const store=useQuoteStore.getState();
 const id=section.id,lines=areaLines(quote,id),primary=areaPrimary(quote,id);
 const measured=areaMeasured(section),billed=areaBilled(section);
 const stone=primary?.includeInTotal?quoteLineAmount(primary):0;
 const extra=lines.filter(l=>l!==primary&&!l.takeoffSinkId).reduce((v,l)=>v+(l.includeInTotal?quoteLineAmount(l):0),0)+
  (section.scope?.takeoffSinks??[]).filter(s=>s.category!=='kitchen'&&s.category!=='vanity')
   .reduce((sum,sink)=>sum+sinkSell(quote,id,sink),0);
 const manual=primary?.pricingMode!=='quantity-rate';
 const billMode=section.scope?.billableSfRounding??'exact';
 return <div className="qmx-grid qmx-area-row" role="row">
  <div className="qmx-cell qmx-sticky-area"><QuoteInlineAreaName quote={quote} section={section}/>
   <select disabled={!editable} aria-label={'Customer presentation '+section.title}
    value={!section.customerVisible?'hidden':section.customerDisplayMode==='summary'?'summary':'detail'}
    onChange={e=>store.updateSection(quote.id,id,{customerVisible:e.target.value!=='hidden',
     ...(e.target.value!=='hidden'?{customerDisplayMode:e.target.value==='summary'?'summary':'detail'}:{})})}>
    <option value="detail">Itemized</option><option value="summary">Lump sum</option>
    <option value="hidden">Hide from contract</option></select></div>
  <div className="qmx-cell qmx-sticky-material"><MaterialCell quote={quote} section={section} editable={editable}/></div>
  <div className="qmx-cell qmx-num">{decimal.format(measured)}</div>
  <div className="qmx-cell"><strong>{decimal.format(billed)}</strong>
   <select disabled={!editable} value={billMode} aria-label={'Billable SF rounding for '+section.title}
    onChange={e=>{
     store.updateSection(quote.id,id,{scope:{...section.scope,
      billableSfRounding:e.target.value as NonNullable<typeof section.scope>['billableSfRounding']}});
     store.updateTakeoffPieces(quote.id,id,section.scope?.takeoffPieces??[]);
    }}>
    <option value="exact">Exact</option><option value="quarter-up">¼ up</option>
    <option value="half-up">½ up</option><option value="whole-up">Whole up</option>
   </select></div>
  <div className="qmx-cell">{primary?.pricingMode==='quantity-rate'
   ?<QuoteInlineAreaRate quote={quote} section={section} onOpen={()=>onCalculator(id)}/>
   :<button type="button" className="qmx-add-small" onClick={()=>onCalculator(id)}>
     {manual&&billed>0?cash.format(stone/billed):'Set price'}</button>}
   <small>{manual?'Effective $/SF':'Sell / SF'}</small></div>
  <div className="qmx-cell qmx-money">{cellMoney(primary?stone:undefined)}</div>
  <SinkSummary quote={quote} section={section} kind="kitchen" editable={editable}/>
  <SinkSummary quote={quote} section={section} kind="vanity" editable={editable}/>
  <div className="qmx-cell qmx-money">{cash.format(round(extra))}</div>
  <div className="qmx-cell"><button type="button" className="qmx-calc" onClick={()=>onCalculator(id)}>Calculator ↗</button></div>
  <div className="qmx-cell qmx-money qmx-total">{cash.format(quoteLinesTotal(lines))}</div>
 </div>;
}
function GeneralRow({quote,onCalculator}:{quote:Quote;onCalculator:()=>void}){
 const generalIds=new Set(quote.sections.filter(isGeneralTakeoffSection).map(s=>s.id));
 const lines=quote.lines.filter(l=>!l.sectionId||generalIds.has(l.sectionId)||!quote.sections.some(s=>s.id===l.sectionId));
 return <div className="qmx-grid qmx-area-row qmx-general-row" role="row">
   <div className="qmx-cell qmx-sticky-area"><strong>General</strong><small>Fees, allowances &amp; other work</small></div>
   <div className="qmx-cell qmx-sticky-material">Other charges</div>
   <div className="qmx-cell qmx-spread">Unassigned line items and project-wide adjustments</div>
   <div className="qmx-cell"><button type="button" className="qmx-calc" onClick={onCalculator}>Calculator ↗</button></div>
   <div className="qmx-cell qmx-money qmx-total">{cash.format(quoteLinesTotal(lines))}</div>
  </div>;
}
function DetailRow({children,excluded=false,issue=false}:{children:ReactNode;excluded?:boolean;issue?:boolean}){
 return <div className={'qmx-grid qmx-detail-row'+(excluded?' is-excluded':'')+(issue?' has-issue':'')} role="row">{children}</div>;
}
function ReadCell({children,className=''}:{children?:ReactNode;className?:string}){
 return <div className={'qmx-cell '+className}>{children??'—'}</div>;
}
export function QuoteMatrixBuilder({quote,onAddArea,onLayouts,onAdvanced,onGeneralTakeoff}:{
 quote:Quote;onAddArea:()=>void;onLayouts:()=>void;onAdvanced:(id:string)=>void;onGeneralTakeoff:()=>void;
}){
 const store=useQuoteStore.getState(),editable=quoteIsCommerciallyEditable(quote);
 const [calculator,setCalculator]=useState<string|null|'general'>(null);
 const [selected,setSelected]=useState<QuoteScopeRowRef[]>([]);
 const [operation,setOperation]=useState<QuoteScopeBulkOperation>('exclude');
 const [target,setTarget]=useState('');
 const [destination,setDestination]=useState('');
 const areas=quote.sections.filter(s=>!isGeneralTakeoffSection(s));
 const general=quote.sections.find(isGeneralTakeoffSection)??null;
 useEffect(()=>setSelected([]),[quote.id]);
 const selectedKeys=new Set(selected.map(keyOf));
 const choose=(ref:QuoteScopeRowRef,checked:boolean)=>setSelected(old=>checked?
  [...old.filter(x=>keyOf(x)!==keyOf(ref)),ref]:old.filter(x=>keyOf(x)!==keyOf(ref)));
 const tick=(ref:QuoteScopeRowRef)=> <input type="checkbox" aria-label={'Select '+ref.kind+' '+ref.id}
  checked={selectedKeys.has(keyOf(ref))} onChange={e=>choose(ref,e.target.checked)}/>;
 const strike=(ref:QuoteScopeRowRef,excluded:boolean)=> <button type="button" className="qmx-strike"
  disabled={!editable} onClick={()=>store.bulkScopeRows(quote.id,[ref],excluded?'restore':'exclude')}>
  {excluded?'Restore':'Strike out'}</button>;
 const addPiece=(id:string)=>{
  const section=quote.sections.find(s=>s.id===id);
  if(!section)return;
  const existing=section.scope?.takeoffPieces??[];
  store.updateTakeoffPieces(quote.id,id,[...existing,newTakeoffPiece(existing.length+1)]);
 };
 const addSink=(id:string,kind:'kitchen'|'vanity'='kitchen')=>{
  const section=quote.sections.find(s=>s.id===id);
  if(!section)return;
  store.updateTakeoffSinks(quote.id,id,[...(section.scope?.takeoffSinks??[]),
   {...newTakeoffSink(),category:kind}]);
 };
 const addCharge=(id:string|undefined,kind:'item'|'discount'='item')=>store.addLine(quote.id,kind,id);
 const addMiter=(id:string)=>{
  if(quote.lines.some(l=>l.sectionId===id&&l.costCategory==='miter'&&l.quantitySource?.syncMode==='live'))return;
  const section=quote.sections.find(s=>s.id===id);
  if(!section)return;
  const count=(section.scope?.takeoffPieces??[]).reduce((n,p)=>n+(p.excludedFromQuote?0:takeoffPieceMiterInches(p)),0);
  const lineId=store.addLine(quote.id,'rate',id);
  store.updateLine(quote.id,lineId,{description:'Mitered edge',costCategory:'miter',
   pricingMode:'quantity-rate',quantity:round(count),rate:undefined,unitLabel:'IN',
   quantitySource:{kind:'area-scope',sectionId:id,field:'miterInches',syncMode:'live',
    capturedValue:round(count),appliedAt:new Date().toISOString()}});
 };
 const addOther=(id:string|undefined,category:NonNullable<QuoteLine['costCategory']>)=>{
  const lineId=store.addLine(quote.id,category==='tax'?'tax':'item',id);
  store.updateLine(quote.id,lineId,{description:category.charAt(0).toUpperCase()+category.slice(1),
   costCategory:category,pricingMode:category==='product'?'quantity-rate':'direct',
   quantity:category==='product'?1:undefined,rate:undefined,
   amount:category==='product'?undefined:0,
   unitLabel:category==='product'?'EA':undefined});
 };
 const toggleAll=selected.length===0?[]:selected;
 const applyBulk=()=>{
  if(!editable||!toggleAll.length)return;
  if(operation==='move'&&!target)return;
  if(operation==='move'&&toggleAll.some(r=>r.kind==='splash'&&!toggleAll.some(p=>
   p.kind==='piece'&&p.id===r.id&&p.sectionId===r.sectionId)))return;
  store.bulkScopeRows(quote.id,toggleAll,operation,operation==='move'?target==='__general'?undefined:target:undefined);
  setSelected([]);
 };
 const onSheetKey=(e:KeyboardEvent<HTMLDivElement>)=>{
  if(e.key!=='Enter'||!(e.target instanceof HTMLInputElement)||e.target.type==='checkbox')return;
  e.preventDefault();e.currentTarget.querySelectorAll<HTMLInputElement>('input.qmx-edit:not(:disabled)');
  e.currentTarget.querySelector<HTMLElement>('.qmx-detail-row:focus-within')?.nextElementSibling?.querySelector<HTMLInputElement>('input.qmx-edit')?.focus();
 };
 return <div className="qmx-workspace">
  <header className="qmx-intro"><div><div className="qmb-kicker">QUICK QUOTE · SPREADSHEET WORKSPACE</div>
   <h2>Quote Builder</h2><p>Area decisions flow into every takeoff row. Edit the cells; no separate measurement or material screen required.</p>
   </div><button type="button" disabled={!editable} onClick={onLayouts}>Saved layouts</button></header>
  <section className="qmx-panel" aria-label="Areas and General summary">
   <header className="qmx-panel-head"><div><h3>1 · Areas &amp; General</h3>
    <p>One row per Area · material, billable SF, fixture pricing and customer total</p></div>
    <button type="button" disabled={!editable} onClick={onAddArea}>+ Area</button></header>
   <div className="qmx-hscroll" role="region" aria-label="Scroll Area summary columns horizontally" tabIndex={0}>
    <div className="qmx-area-grid">
     <div className="qmx-grid qmx-area-groups" aria-hidden="true">
      <span className="qmx-sticky-area">Area / Room</span><span className="qmx-sticky-material">Stone selection</span>
      <span className="qmx-span-4">Stone / Square Feet</span>
      <span className="qmx-span-4">Kitchen sink</span><span className="qmx-span-4">Vanity sink</span>
      <span>Specialty</span><span>Calculator</span><span>Total</span></div>
     <div className="qmx-grid qmx-area-columns" role="row">
      {['Area / contract','Material','Measured SF','Billable SF','Sell / SF','Stone price',
       'Model #','Qty','Unit price','Sink total',
       'Model #','Qty','Unit price','Sink total','Other charges','Private estimator','Customer total']
       .map((label,i)=><span key={i} className={i===0?'qmx-sticky-area':i===1?'qmx-sticky-material':''}>{label}</span>)}
     </div>
     {areas.map(section=><AreaRow key={section.id} quote={quote} section={section}
      editable={editable} onCalculator={id=>setCalculator(id)}/>)}
     <GeneralRow quote={quote} onCalculator={()=>setCalculator('general')}/>
    </div>
   </div>
   <footer className="qmx-table-foot"><span>Scroll horizontally for sink and specialty columns. The Area and Material columns stay visible.</span>
    <strong>Quote total {cash.format(quoteTotal(quote))}</strong></footer>
  </section>
  <section className="qmx-panel" aria-label="Takeoffs selections and pricing spreadsheet">
   <header className="qmx-panel-head"><div><h3>2 · Takeoffs, Selections &amp; Pricing</h3>
    <p>One measured piece, sink or charge per editable row. Exclusions preserve every measurement.</p></div>
    <strong>{cash.format(quoteTotal(quote))}</strong></header>
   <div className="qmx-sheet-toolbar">
    <label>New line in <select value={destination} onChange={e=>setDestination(e.target.value)}>
     <option value="">Choose Area…</option>
     {areas.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
     <option value="general">General</option>
    </select></label>
    <button type="button" disabled={!editable||!destination||destination==='general'} onClick={()=>addPiece(destination)}>+ Piece</button>
    <button type="button" disabled={!editable||!destination||destination==='general'} onClick={()=>addSink(destination)}>+ Sink</button>
    <button type="button" disabled={!editable||!destination} onClick={()=>addCharge(destination==='general'?general?.id:destination)}>+ Charge</button>
    <button type="button" disabled={!editable||!destination} onClick={()=>addCharge(destination==='general'?general?.id:destination,'discount')}>+ Discount</button>
    <button type="button" disabled={!editable||!destination||destination==='general'} onClick={()=>addMiter(destination)}>+ Linked miter</button>
    <details className="qmx-more"><summary>+ Specialty</summary><div>
     {(['product','specialty','freight','tax','tariff','breakage'] as const).map(type=>
      <button key={type} type="button" disabled={!editable||!destination}
       onClick={()=>addOther(destination==='general'?general?.id:destination,type)}>+ {type}</button>)}
    </div></details>
   </div>
   {!!selected.length&&<div className="qmx-bulk" role="toolbar" aria-label="Bulk operations">
     <strong>{selected.length} selected</strong>
     <select aria-label="Bulk operation" value={operation}
      onChange={e=>setOperation(e.target.value as QuoteScopeBulkOperation)}>
      <option value="exclude">Strike out</option><option value="restore">Restore</option><option value="move">Move to Area</option>
     </select>
     {operation==='move'&&<select aria-label="Destination Area" value={target} onChange={e=>setTarget(e.target.value)}>
      <option value="">Choose destination</option>
      {areas.map(s=><option value={s.id} key={s.id}>{s.title}</option>)}
      <option value="__general">General</option>
     </select>}
     <button type="button" onClick={applyBulk} disabled={!editable||(operation==='move'&&!target)}>Apply</button>
     <button type="button" onClick={()=>setSelected([])}>Clear</button></div>}
   <div className="qmx-hscroll" role="region" aria-label="Scroll detailed takeoff columns horizontally" tabIndex={0}>
    <div className="qmx-details-grid" onKeyDown={onSheetKey}>
     <div className="qmx-grid qmx-detail-groups" aria-hidden="true">
      <span className="qmx-sticky-area">Area / Room</span><span className="qmx-sticky-description">Item</span>
      <span className="qmx-span-5">Takeoff / Measurement</span><span>Material</span><span className="qmx-span-4">Kitchen sink</span>
      <span className="qmx-span-4">Vanity sink</span><span>Miter</span><span>Specialty</span><span>Cost</span><span>Contract</span><span>Price</span>
     </div>
     <div className="qmx-grid qmx-detail-columns" aria-hidden="true">
      {['Area','Piece / model / charge','Qty','Length','Width','Sq inches','Sq feet','Material',
       'Model #','Qty','Unit $','Total','Model #','Qty','Unit $','Total',
       'Miter in','Specialty / Rate','Private cost','Included?','Line $'].map((label,i)=>
       <span className={i===0?'qmx-sticky-area':i===1?'qmx-sticky-description':''} key={i}>{label}</span>)}
     </div>
     {areas.map(section=>{
      const id=section.id,pieces=section.scope?.takeoffPieces??[],sinks=section.scope?.takeoffSinks??[];
      const primary=areaPrimary(quote,id), extras=areaLines(quote,id).filter(l=>l!==primary&&!l.takeoffSinkId);
      const patchPiece=(piece:QuoteTakeoffPiece,patch:Partial<QuoteTakeoffPiece>)=>
       store.updateTakeoffPieces(quote.id,id,pieces.map(p=>p.id===piece.id?{...p,...patch}:p));
      const patchSink=(sink:QuoteTakeoffSink,patch:Partial<QuoteTakeoffSink>)=>
       store.updateTakeoffSinks(quote.id,id,sinks.map(s=>s.id===sink.id?{...s,...patch}:s));
      return <div key={id} className="qmx-area-block">
       <div className="qmx-sheet-group"><strong>{section.title}</strong>
        <span>{section.scope?.takeoffMaterial||'Material not selected'} · {decimal.format(areaMeasured(section))} measured SF ·
        {decimal.format(areaBilled(section))} billed SF</span>
        <strong>{cash.format(quoteLinesTotal(areaLines(quote,id)))}</strong></div>
       {pieces.map((piece,index)=>{
        const ref:QuoteScopeRowRef={kind:'piece',id:piece.id,sectionId:id};
        const sf=takeoffPieceSf(piece),valid=!!piece.lengthIn&&!!piece.widthIn&&piece.count>0;
        return <div key={piece.id}>
         <DetailRow excluded={!!piece.excludedFromQuote} issue={!valid}>
          <ReadCell className="qmx-sticky-area qmx-area-name">{tick(ref)}{section.title}</ReadCell>
          <ReadCell className="qmx-sticky-description"><input className="qmx-edit"
            aria-label={'Piece name '+section.title+' '+(index+1)} disabled={!editable}
            value={piece.name} onChange={e=>patchPiece(piece,{name:e.target.value})}/></ReadCell>
          <ReadCell><CellNumber label="Piece quantity" integer value={piece.count} disabled={!editable}
           onChange={v=>{if(v!==undefined&&v>0)patchPiece(piece,{count:v});}}/></ReadCell>
          <ReadCell><CellNumber label="Length in inches" inches value={piece.lengthIn} disabled={!editable}
           onChange={v=>patchPiece(piece,{lengthIn:v})}/></ReadCell>
          <ReadCell><CellNumber label="Width in inches" inches value={piece.widthIn} disabled={!editable}
           onChange={v=>patchPiece(piece,{widthIn:v})}/></ReadCell>
          <ReadCell className="qmx-num">{valid?decimal.format((piece.lengthIn??0)*(piece.widthIn??0)*piece.count):'—'}</ReadCell>
          <ReadCell className="qmx-num">{valid?decimal.format(sf):'—'}</ReadCell>
          <ReadCell className="qmx-material-read">{section.scope?.takeoffMaterial||'—'}</ReadCell>
          {Array.from({length:8},(_,i)=><ReadCell key={i}/>)}
          <ReadCell><EdgesCell quote={quote} section={section} piece={piece} editable={editable}/></ReadCell>
          <ReadCell>{piece.edgeProfile??'Flat'}</ReadCell>
          <ReadCell>Area cost</ReadCell>
          <ReadCell>{strike(ref,!!piece.excludedFromQuote)}</ReadCell>
          <ReadCell className="qmx-money">{piece.excludedFromQuote?'Excluded':'In Area total'}</ReadCell>
         </DetailRow>
         {(piece.backsplash||piece.leftSplash||piece.rightSplash)&&<DetailRow
          excluded={!!piece.excludedFromQuote||!!piece.excludeSplashFromQuote}>
          <ReadCell className="qmx-sticky-area qmx-area-name">
           {tick({kind:'splash',id:piece.id,sectionId:id})}{section.title}</ReadCell>
          <ReadCell className="qmx-sticky-description">↳ Splash · {piece.name}</ReadCell>
          <ReadCell>{piece.count}</ReadCell>
          <ReadCell className="qmx-num">{decimal.format((piece.backsplash?piece.lengthIn??0:0)+
           (piece.leftSplash?piece.widthIn??0:0)+(piece.rightSplash?piece.widthIn??0:0))}</ReadCell>
          <ReadCell><CellNumber label={'Splash height for '+piece.name} value={piece.splashHeightIn??4} disabled={!editable}
            onChange={v=>patchPiece(piece,{splashHeightIn:v??4})}/></ReadCell>
          <ReadCell className="qmx-num">{decimal.format(takeoffPieceSplashSf(piece)*144)}</ReadCell>
          <ReadCell className="qmx-num">{decimal.format(takeoffPieceSplashSf(piece))}</ReadCell>
          <ReadCell className="qmx-material-read">{section.scope?.takeoffMaterial||'—'}</ReadCell>
          {Array.from({length:8},(_,i)=><ReadCell key={i}/>)}
          <ReadCell>—</ReadCell><ReadCell>4&quot; splash</ReadCell><ReadCell>Area cost</ReadCell>
          <ReadCell>{strike({kind:'splash',id:piece.id,sectionId:id},!!piece.excludeSplashFromQuote)}</ReadCell>
          <ReadCell>In Area total</ReadCell>
         </DetailRow>}
        </div>;
       })}
       {sinks.map(sink=>{
        const ref:QuoteScopeRowRef={kind:'sink',id:sink.id,sectionId:id};
        const kitchen=sink.category==='kitchen',vanity=sink.category==='vanity';
        return <DetailRow key={sink.id} excluded={!!sink.excludedFromContract}
         issue={sink.includeInPricing&&sink.unitPrice===undefined}>
          <ReadCell className="qmx-sticky-area qmx-area-name">{tick(ref)}{section.title}</ReadCell>
          <ReadCell className="qmx-sticky-description">
           <select aria-label={'Sink category '+sink.name} disabled={!editable} value={sink.category}
            onChange={e=>patchSink(sink,{category:e.target.value as QuoteTakeoffSink['category']})}>
            {SINK_CATEGORIES.map(category=><option key={category} value={category}>
             {SINK_CATEGORY_LABELS[category]} sink</option>)}</select></ReadCell>
          <ReadCell>{sink.count}</ReadCell>
          {Array.from({length:5},(_,i)=><ReadCell key={i}/>)}
          {kitchen?<><ReadCell><SinkModel quote={quote} section={section} sink={sink} editable={editable}/></ReadCell>
           <ReadCell><CellNumber label={'Sink quantity '+sink.name} integer value={sink.count} disabled={!editable}
             onChange={v=>{if(v!==undefined&&v>0)patchSink(sink,{count:v});}}/></ReadCell>
           <ReadCell><CellNumber label={'Sink unit price '+sink.name} value={sink.unitPrice} disabled={!editable}
             onChange={v=>patchSink(sink,{unitPrice:v})}/></ReadCell>
           <ReadCell className="qmx-money">{cash.format(sinkSell(quote,id,sink))}</ReadCell>
           {Array.from({length:4},(_,i)=><ReadCell key={i}/>)}</>:
          vanity?<>{Array.from({length:4},(_,i)=><ReadCell key={i}/>)}
           <ReadCell><SinkModel quote={quote} section={section} sink={sink} editable={editable}/></ReadCell>
           <ReadCell><CellNumber label={'Vanity quantity '+sink.name} integer value={sink.count} disabled={!editable}
             onChange={v=>{if(v!==undefined&&v>0)patchSink(sink,{count:v});}}/></ReadCell>
           <ReadCell><CellNumber label={'Vanity unit price '+sink.name} value={sink.unitPrice} disabled={!editable}
             onChange={v=>patchSink(sink,{unitPrice:v})}/></ReadCell>
           <ReadCell className="qmx-money">{cash.format(sinkSell(quote,id,sink))}</ReadCell></>:
           <>{Array.from({length:8},(_,i)=><ReadCell key={i}/>)}</>}
          <ReadCell/><ReadCell>{!kitchen&&!vanity?sink.name:null}</ReadCell>
          <ReadCell><CellNumber label={'Private sink cost '+sink.name} value={sink.internalCostOverride} disabled={!editable}
            onChange={v=>patchSink(sink,{internalCostOverride:v})}/></ReadCell>
          <ReadCell>{strike(ref,!!sink.excludedFromContract)}</ReadCell>
          <ReadCell className="qmx-money">{cash.format(sinkSell(quote,id,sink))}</ReadCell>
         </DetailRow>;
       })}
       {extras.map(line=>renderCharge(line,section.title))}
       {editable&&!pieces.length&&!sinks.length&&!extras.length&&
        <div className="qmx-inline-empty">No lines in {section.title}. Use the Add Line toolbar above.</div>}
      </div>;
     })}
     <div className="qmx-area-block"><div className="qmx-sheet-group"><strong>General</strong>
      <span>Project-wide charges, discounts and allowances</span></div>
      {quote.lines.filter(l=>!l.sectionId||!quote.sections.some(s=>s.id===l.sectionId)
       ||quote.sections.some(s=>s.id===l.sectionId&&isGeneralTakeoffSection(s))).map(line=>renderCharge(line,'General'))}
     </div>
    </div>
   </div>
   {editable&&!general&&<button type="button" className="qmx-general-start" onClick={onGeneralTakeoff}>+ General measured takeoff</button>}
   <footer className="qmx-table-foot"><span>All geometry is kept when you strike out a row. Customer totals exclude struck-out lines.</span>
     <strong>Quote total {cash.format(quoteTotal(quote))}</strong></footer>
  </section>
  {calculator!==null&&<CalculatorDrawer quote={quote}
   section={calculator==='general'?null:quote.sections.find(s=>s.id===calculator)??null}
   onClose={()=>setCalculator(null)} onAdvanced={onAdvanced}/>}
 </div>;
 function renderCharge(line:QuoteLine,area:string){
  const ref:QuoteScopeRowRef={kind:'line',id:line.id,sectionId:line.sectionId};
  const change=(patch:Partial<QuoteLine>)=>store.updateLine(quote.id,line.id,patch);
  const generalArea=area==='General';
  const kind=line.costCategory??line.kind;
  return <DetailRow key={line.id} excluded={!line.includeInTotal}
   issue={line.includeInTotal&&line.pricingMode!=='none'&&
    (line.pricingMode==='quantity-rate'?line.rate===undefined:line.amount===undefined)}>
   <ReadCell className="qmx-sticky-area qmx-area-name">{tick(ref)}{area}</ReadCell>
   <ReadCell className="qmx-sticky-description"><input className="qmx-edit" aria-label="Charge description"
    value={line.description} disabled={!editable} onChange={e=>change({description:e.target.value})}/></ReadCell>
   <ReadCell>{line.pricingMode==='quantity-rate'?
    <CellNumber label={'Quantity '+line.description} value={line.quantity}
     disabled={!editable||line.quantitySource?.syncMode==='live'} onChange={v=>change({quantity:v})}/>:1}</ReadCell>
   <ReadCell>{line.costCategory==='product'?<input className="qmx-edit" placeholder="Supplier"
    aria-label="Product supplier" disabled={!editable} value={line.supplierName??''}
    onChange={e=>change({supplierName:e.target.value})}/>:null}</ReadCell>
   <ReadCell>{line.costCategory==='product'?<input className="qmx-edit" placeholder="SKU"
    aria-label="Product SKU" disabled={!editable} value={line.productCode??''}
    onChange={e=>change({productCode:e.target.value})}/>:null}</ReadCell>
   <ReadCell/><ReadCell/><ReadCell>{generalArea?'General':null}</ReadCell>
   {Array.from({length:8},(_,i)=><ReadCell key={i}/>)}
   <ReadCell>{line.costCategory==='miter'?(line.quantity??0)+' in':'—'}</ReadCell>
   <ReadCell><select aria-label={'Pricing mode for '+line.description} disabled={!editable}
      value={line.pricingMode} onChange={e=>change({pricingMode:e.target.value as QuoteLine['pricingMode']})}>
     <option value="direct">Amount</option><option value="quantity-rate">Qty × rate</option>
     <option value="none">Notes only</option></select>
    {line.pricingMode==='quantity-rate'
     ?<CellNumber label={'Unit rate '+line.description} value={line.rate} disabled={!editable}
       onChange={v=>change({rate:v})}/>
     :line.pricingMode==='direct'?<CellNumber label={'Amount '+line.description} value={line.amount}
       disabled={!editable} onChange={v=>change({amount:v})}/>:null}
    <small>{kind}</small></ReadCell>
   <ReadCell><CellNumber label={'Private cost '+line.description}
    value={line.costCategory==='product'?line.unitCost:line.internalCost}
    disabled={!editable} onChange={v=>change(line.costCategory==='product'?{unitCost:v}:{internalCost:v})}/></ReadCell>
   <ReadCell>{strike(ref,!line.includeInTotal)}</ReadCell>
   <ReadCell className="qmx-money">{cash.format(line.includeInTotal?quoteLineAmount(line):0)}</ReadCell>
  </DetailRow>;
 }
}
