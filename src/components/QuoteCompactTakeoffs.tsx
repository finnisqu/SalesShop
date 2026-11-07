import {useEffect,useRef,useState,type ReactNode,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Quote,QuoteSection,QuoteTakeoffPiece,QuoteTakeoffSink,QuoteLine,QuoteSplashEdge} from '../types/quote';
import {quoteLineAmount,quoteLinesTotal} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
import {handleQuickGridKey} from '../services/quoteGridNavigation';
import {QuoteMobileCellToolbar} from './QuoteMobileCellToolbar';
import {parseQuickGridNumber} from '../services/quoteGridValue';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {newTakeoffPiece,newTakeoffSink,takeoffPieceSf,takeoffPieceSplashSf,
 takeoffPieceSplashEdgeSf,takeoffSplashEdgeHeightIn,takeoffSplashEdgeLengthIn,isSplashEdgeExcluded,
 parseInches,takeoffPieceMiterInches} from '../services/quoteTakeoffsLite';
import {quickAreaSummary} from '../services/quoteQuickAreaSummary';
import {TakeoffSinkCatalog} from './TakeoffCatalogPickers';
import type {QuoteScopeRowRef,QuoteScopeBulkOperation} from '../services/quoteScopeRowBatch';
import {QuoteBulkActionPopover} from './QuoteBulkActionPopover';
import './quote-compact-takeoffs.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const sf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const key=(r:QuoteScopeRowRef)=>[r.kind,r.sectionId??'',r.id,r.edge??''].join(':');
const edgeNames:Record<QuoteSplashEdge,string>={back:'Back',left:'Left',right:'Right'};
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
  const n=inches?parseInches(raw):parseQuickGridNumber(raw);
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
  inputMode={integer?'numeric':'decimal'} value={draft} onChange={e=>setDraft(e.target.value)}
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
function DetailPopup({quote,section,piece,sink,line,rowRef,onClose,onDuplicate,onDelete}:{
 quote:Quote;section:QuoteSection|null;piece?:QuoteTakeoffPiece;sink?:QuoteTakeoffSink;
 line?:QuoteLine;rowRef:QuoteScopeRowRef;onClose:()=>void;
 onDuplicate:()=>void;onDelete:()=>void;
}){
 const editable=quoteIsCommerciallyEditable(quote),store=useQuoteStore.getState();
 const ref=useRef<HTMLDivElement>(null);
 const sheetSwipeStart=useRef<number|null>(null);
 const sheetMode=useRef<'expanded'|'compact'>('expanded');
 const [sheetExpanded,setSheetExpanded]=useState(true);
 const dragGesture=useRef<{pointerId:number;startY:number;startTop:number;lastTop:number}|null>(null);
 const suppressHandleClick=useRef(false);
 const [moveTarget,setMoveTarget]=useState('');
 const sheetBounds=()=>{
  const panel=ref.current;
  const bottom=panel?.getBoundingClientRect().bottom??
   (window.visualViewport?.height??window.innerHeight);
  const height=window.visualViewport?.height??window.innerHeight;
  const expandedTop=Math.max(12,Math.min(28,height*.03));
  const available=Math.max(240,bottom-expandedTop);
  const compactHeight=Math.max(265,Math.min(480,available*.57));
  return {expandedTop,compactTop:Math.max(expandedTop,bottom-compactHeight),bottom};
 };
 const snapSheet=(mode:'expanded'|'compact')=>{
  const panel=ref.current;
  if(!panel)return;
  sheetMode.current=mode;
  setSheetExpanded(mode==='expanded');
  panel.classList.remove('is-dragging');
  const bounds=sheetBounds();
  if(mode==='expanded')panel.style.removeProperty('--qqt-sheet-top');
  else panel.style.setProperty('--qqt-sheet-top',bounds.compactTop+'px');
 };
 const beginHandleDrag=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  if(event.button!==0)return;
  const panel=ref.current;
  if(!panel)return;
  suppressHandleClick.current=false;
  dragGesture.current={pointerId:event.pointerId,startY:event.clientY,
   startTop:panel.getBoundingClientRect().top,lastTop:panel.getBoundingClientRect().top};
  panel.classList.add('is-dragging');
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const moveHandleDrag=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  const gesture=dragGesture.current;
  if(!gesture||gesture.pointerId!==event.pointerId)return;
  const panel=ref.current;
  if(!panel)return;
  const bounds=sheetBounds();
  const maxTop=Math.min(bounds.bottom-125,bounds.compactTop+160);
  const newTop=Math.max(bounds.expandedTop,
   Math.min(maxTop,gesture.startTop+event.clientY-gesture.startY));
  gesture.lastTop=newTop;
  panel.style.setProperty('--qqt-sheet-top',newTop+'px');
 };
 const finishHandleDrag=(event:ReactPointerEvent<HTMLButtonElement>,cancelled=false)=>{
  const gesture=dragGesture.current;
  if(!gesture||gesture.pointerId!==event.pointerId)return;
  dragGesture.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))
   event.currentTarget.releasePointerCapture(event.pointerId);
  const dy=event.clientY-gesture.startY;
  const moved=Math.abs(dy)>7;
  suppressHandleClick.current=moved;
  if(cancelled){snapSheet(sheetMode.current);return;}
  if(!moved){snapSheet(sheetMode.current);return;}
  const bounds=sheetBounds();
  if(dy>0&&gesture.lastTop>bounds.compactTop+75){
   ref.current?.classList.remove('is-dragging');
   onClose();
   return;
  }
  const midpoint=(bounds.expandedTop+bounds.compactTop)/2;
  snapSheet(gesture.lastTop>midpoint?'compact':'expanded');
 };
 const handleGripKey=(event:ReactKeyboardEvent<HTMLButtonElement>)=>{
  if(event.key==='ArrowUp'){event.preventDefault();snapSheet('expanded');}
  if(event.key==='ArrowDown'){event.preventDefault();snapSheet('compact');}
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
 };
 useEffect(()=>{
  const adjust=()=>{
   if(dragGesture.current)return;
   snapSheet(sheetMode.current);
  };
  window.visualViewport?.addEventListener('resize',adjust);
  window.addEventListener('resize',adjust);
  return()=>{
   window.visualViewport?.removeEventListener('resize',adjust);
   window.removeEventListener('resize',adjust);
  };
 },[]);

 const currentAreaId=rowRef.sectionId;
 const eligibleAreas=quote.sections.filter(s=>!isGeneralTakeoffSection(s)&&s.id!==currentAreaId);
 const canChangeRow=editable&&!!(piece||sink||line)&&
  (!line||!line.takeoffSinkId&&line.quantitySource?.syncMode!=='live');
 const excluded=rowRef.kind==='splash'
  ?!!piece&&(rowRef.edge?isSplashEdgeExcluded(piece,rowRef.edge):
    !!piece.excludedFromQuote||!!piece.excludeSplashFromQuote)
  :rowRef.kind==='piece'?!!piece?.excludedFromQuote
  :rowRef.kind==='sink'?!!sink?.excludedFromContract
  :!!line&&!line.includeInTotal;
 const measuredSf=piece?(rowRef.kind==='splash'?(rowRef.edge
  ?takeoffPieceSplashEdgeSf(piece,rowRef.edge):takeoffPieceSplashSf(piece)):takeoffPieceSf(piece)):null;
 const areaSummary=section?quickAreaSummary(quote,section):null;
 const pieceMeasuredTotal=areaSummary?.measuredSf??0;
 const allocatedPiecePrice=piece&&!piece.excludedFromQuote&&areaSummary?.primary?.includeInTotal&&pieceMeasuredTotal>0
  ?quoteLineAmount(areaSummary.primary)*takeoffPieceSf(piece)/pieceMeasuredTotal:0;
 const sinkSellingPrice=sink&&section?quote.lines
  .filter(item=>item.sectionId===section.id&&item.takeoffSinkId===sink.id&&item.includeInTotal)
  .reduce((sum,item)=>sum+quoteLineAmount(item),0):0;
 const priceLabel=rowRef.kind==='splash'?(excluded?'Excluded':'Included with stone'):
  money.format(piece?allocatedPiecePrice:sink?sinkSellingPrice:line&&line.includeInTotal?quoteLineAmount(line):0);
 const canMove=canChangeRow&&(eligibleAreas.length>0||rowRef.kind==='line'&&!!currentAreaId);
 const toggleContract=()=>{
  if(!canChangeRow)return;
  const affected=rowRef.kind==='splash'&&piece?.excludedFromQuote&&excluded
   ?[{...rowRef,kind:'piece' as const,edge:undefined},rowRef]:[rowRef];
  store.bulkScopeRows(quote.id,affected,excluded?'restore':'exclude');
 };
 const moveRow=()=>{
  if(!canMove||!moveTarget)return;
  // Splash geometry belongs to its parent piece. Move them together.
  const sourceRef=rowRef.kind==='splash'?{...rowRef,kind:'piece' as const}:rowRef;
  store.bulkScopeRows(quote.id,[sourceRef],'move',moveTarget==='__general'?undefined:moveTarget);
  onClose();
 };
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
 const title=rowRef.kind==='splash'&&rowRef.edge
  ?edgeNames[rowRef.edge]+' splash · '+(piece?.name||'Piece')
  :piece?.name||sink?.name||line?.description||'Row details';
 return createPortal(<div className="qmb qqt-overlay" onPointerDown={e=>{
  if(e.target===e.currentTarget)onClose();
 }}>
   <div className="qqt-panel" role="dialog" aria-modal="true" ref={ref} aria-label={'Edit '+title}>
    <button type="button" className="qqt-drag-handle" aria-label="Resize details sheet"
     aria-expanded={sheetExpanded}
     aria-description="Drag up to expand, drag down to collapse or dismiss. Use arrow keys to resize."
     onPointerDown={beginHandleDrag} onPointerMove={moveHandleDrag}
     onPointerUp={event=>finishHandleDrag(event)}
     onPointerCancel={event=>finishHandleDrag(event,true)}
     onLostPointerCapture={event=>finishHandleDrag(event,true)}
     onKeyDown={handleGripKey}
     onClick={()=>{
      if(suppressHandleClick.current){suppressHandleClick.current=false;return;}
      snapSheet(sheetMode.current==='expanded'?'compact':'expanded');
     }}>
      <span aria-hidden="true"/>
    </button>
    <header onTouchStart={event=>{
      if((event.target as HTMLElement).closest('button,input,select'))return;
      sheetSwipeStart.current=event.touches[0]?.clientY??null;
     }} onTouchEnd={event=>{
      const start=sheetSwipeStart.current;
      sheetSwipeStart.current=null;
      if(start!==null&&(event.changedTouches[0]?.clientY??start)-start>85)onClose();
     }}><div><small>{section?.title??'General'}</small><h2>{title||'Untitled item'}</h2></div>
     <button className="qqt-close" type="button" onClick={onClose} aria-label="Close line details">×</button></header>
    <div className="qqt-panel-body">
     <div className="qqt-detail-facts" aria-label="Takeoff row information">
      {piece&&<div><small>{rowRef.kind==='splash'?'Splash SF':'Measured SF'}</small>
        <strong>{sf.format(measuredSf??0)} SF</strong></div>}
      <div><small>{piece?'Allocated selling price':'Selling price'}</small>
        <strong>{priceLabel}</strong></div>
      <div><small>Contract</small>
       <strong>{excluded?'Excluded':'Included'}</strong></div>
     </div>
     {piece&&rowRef.kind==='splash'&&rowRef.edge&&<>
       <div className="qqt-panel-section-title">
        <strong>{edgeNames[rowRef.edge]} splash</strong>
        <small>Measured from the {piece.name||'parent piece'} countertop</small>
       </div>
       <div className="qqt-two qqt-panel-compact-fields">
        <label>Edge length (in)
         <span className="qqt-static-field">{sf.format(takeoffSplashEdgeLengthIn(piece,rowRef.edge)/Math.max(1,piece.count))}</span>
        </label>
        <label>Splash height (in)
         <SmallInput alwaysInput label={edgeNames[rowRef.edge]+' splash height'} disabled={!editable}
          value={takeoffSplashEdgeHeightIn(piece,rowRef.edge)}
          commit={v=>patchPiece({splashEdgeHeightsIn:{...piece.splashEdgeHeightsIn,
           [rowRef.edge!]:v??piece.splashHeightIn??4}})}/>
        </label>
       </div>
       <p className="qqt-panel-helper">Edge length and quantity follow the parent top. Height and contract inclusion are independent for this splash.</p>
      </>}
     {piece&&rowRef.kind!=='splash'&&<>
       <div className="qqt-panel-section-title"><strong>Piece details</strong>
        <small>Changes to dimensions update linked measurements</small></div>
       <div className="qqt-panel-fields">
        <label>Piece name<input type="text" disabled={!editable} value={piece.name}
         onChange={e=>patchPiece({name:e.target.value})}/></label>
        <label>Edge profile<input type="text" disabled={!editable} value={piece.edgeProfile??'Flat'}
         onChange={e=>patchPiece({edgeProfile:e.target.value})}/></label>
        <label>Quantity<SmallInput alwaysInput label="Piece quantity" integer disabled={!editable}
         value={piece.count} commit={v=>{if(v!==undefined&&v>=1)patchPiece({count:v});}}/></label>
        <label>Default splash height (in)<SmallInput alwaysInput label="Default splash height" disabled={!editable}
         value={piece.splashHeightIn??4} commit={v=>patchPiece({splashHeightIn:v??4})}/></label>
       </div>
       <div className="qqt-panel-section-title"><strong>Splash edges</strong>
        <small>Each checked edge has its own Takeoffs row</small></div>
       <div className="qqt-edge-options">
       {([['backsplash','Back'],['leftSplash','Left'],['rightSplash','Right']] as const)
        .map(([field,label])=><label className="qqt-check-label" key={field}>
         <input type="checkbox" disabled={!editable} checked={!!piece[field]}
          onChange={e=>patchPiece({[field]:e.target.checked})}/>{label}</label>)}
       </div>
       <div className="qqt-panel-section-title"><strong>Miter edges</strong>
        <small>{sf.format(takeoffPieceMiterInches(piece))} in selected</small></div>
       <div className="qqt-edge-options">
       {([['miterFront','Front'],['miterLeft','Left'],['miterRight','Right']] as const)
        .map(([field,label])=><label className="qqt-check-label" key={field}>
         <input type="checkbox" disabled={!editable} checked={!!piece[field]}
          onChange={e=>patchPiece({[field]:e.target.checked})}/>{label}</label>)}
       </div>
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
     <section className="qqt-sheet-options" aria-label="Takeoff row options">
      <h3>Row options</h3>
      <div className="qqt-sheet-option-buttons">
       <button type="button" disabled={!canChangeRow} onClick={toggleContract}>
        {excluded?'✓ Restore to contract':'Strike out · exclude'}
       </button>
       <button type="button" disabled={!canChangeRow} onClick={()=>{
        onDuplicate();onClose();
       }}>⧉ {rowRef.kind==='splash'?'Duplicate parent':'Duplicate'}</button>
       <button type="button" className="is-danger" disabled={!canChangeRow}
        onClick={onDelete}>{rowRef.kind==='splash'?'Remove splash':'Delete row'}</button>
      </div>
      {canMove&&<div className="qqt-sheet-move">
       <label>Move {rowRef.kind==='splash'?'parent piece and splash':'row'} to
        <select value={moveTarget} aria-label="Move row to Area"
         onChange={event=>setMoveTarget(event.target.value)}>
         <option value="">Choose destination…</option>
         {eligibleAreas.map(area=><option key={area.id} value={area.id}>{area.title}</option>)}
         {rowRef.kind==='line'&&currentAreaId&&<option value="__general">General</option>}
        </select>
       </label>
       <button type="button" disabled={!moveTarget} onClick={moveRow}>Move</button>
      </div>}
     </section>
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
 const [detail,setDetail]=useState<{areaId:string|null;id:string;kind:'piece'|'splash'|'sink'|'line';edge?:QuoteSplashEdge}|null>(null);
 useEffect(()=>{
  if(!focusArea)return;
  const target=Array.from(list.current?.querySelectorAll<HTMLElement>('[data-area-id]')??[])
   .find(el=>el.dataset.areaId===focusArea);
  target?.scrollIntoView({block:'nearest',behavior:'smooth'});
 },[focusArea]);
 const [selected,setSelected]=useState<QuoteScopeRowRef[]>([]);
 const [target,setTarget]=useState('');
 const [moveOpen,setMoveOpen]=useState(false);
 const areas=quote.sections.filter(s=>!isGeneralTakeoffSection(s));
 useEffect(()=>{setSelected([]);setDetail(null);setMoveOpen(false);},[quote.id]);
 const selectedKeys=new Set(selected.map(key));
 const canDuplicateSelection=selected.every(ref=>ref.kind!=='line'||(()=>{
  const line=quote.lines.find(item=>item.id===ref.id);
  return !!line&&!line.takeoffSinkId&&line.quantitySource?.syncMode!=='live';
 })());
 const changeSelected=(ref:QuoteScopeRowRef,on:boolean)=>setSelected(old=>on?
  [...old.filter(r=>key(r)!==key(ref)),ref]:old.filter(r=>key(r)!==key(ref)));
 const select=(ref:QuoteScopeRowRef)=><input type="checkbox" aria-label={'Select '+(ref.edge?edgeNames[ref.edge]+' splash':ref.kind)+' '+ref.id}
  checked={selectedKeys.has(key(ref))} onChange={e=>changeSelected(ref,e.target.checked)}/>;
 const contract=(ref:QuoteScopeRowRef,isExcluded:boolean)=><button type="button"
  className={'qqt-contract'+(isExcluded?' is-excluded':'')}
  disabled={!editable} onClick={()=>{
    const piece=ref.kind==='splash'?quote.sections.find(section=>section.id===ref.sectionId)
      ?.scope?.takeoffPieces?.find(item=>item.id===ref.id):undefined;
    const refs=ref.kind==='splash'&&piece?.excludedFromQuote&&isExcluded
      ?[{...ref,kind:'piece' as const,edge:undefined},ref]:[ref];
    store.bulkScopeRows(quote.id,refs,isExcluded?'restore':'exclude');
   }}>
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
 const duplicateRows=(refs:QuoteScopeRowRef[])=>{
  if(!editable||!refs.length)return;
  const copiesParent=refs.some(ref=>ref.kind==='splash'&&!refs.some(piece=>
    piece.kind==='piece'&&piece.id===ref.id&&piece.sectionId===ref.sectionId));
  if(copiesParent&&!window.confirm(
   'A splash is attached to its measured piece. Duplicating this splash also copies its parent piece and all attached splash edges. Continue?'
  ))return;
  const created=store.duplicateScopeRows(quote.id,refs);
  if(created)setSelected([]);
 };
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
   const description=ref.edge?edgeNames[ref.edge]+' splash':'all splash edges';
   if(window.confirm('Remove '+description+'? The measured top remains, and Undo is available.'))
    store.bulkScopeRows(quote.id,[ref],'delete');
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
  width:ReactNode,sfValue:ReactNode,price:ReactNode,excluded:boolean,edit:()=>void,issue=false,
  remove?:()=>void,duplicate?:()=>void)=>
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
    <button type="button" className="qqt-more-button"
     aria-label={'More options for '+area+' '+(ref.edge?edgeNames[ref.edge]+' splash':ref.kind)+' '+ref.id}
     title="More details and actions" onClick={edit}>⋯</button>
    <button type="button" className="qqt-edit-button qqt-desktop-action"
     aria-label={'More settings for '+area+' '+ref.kind} onClick={edit} title="Detailed settings">✎</button>
    <button type="button" className="qqt-duplicate-button qqt-desktop-action" disabled={!editable||!duplicate}
     aria-label={'Duplicate '+area+' '+ref.kind}
     title={ref.kind==='splash'?'Duplicate parent piece and attached splashes':'Duplicate row (Undo available)'}
     onClick={duplicate}>⧉</button>
    <button type="button" className="qqt-delete-button qqt-desktop-action" disabled={!editable||!remove}
     aria-label={'Delete '+area+' '+ref.kind} title="Delete row (Undo available)"
     onClick={remove}>×</button>
   </div>
  </div>;
 const mobileColumnHeader=(groupLabel:string)=>
  <div className="qqt-mobile-header qqt-workbook-grid" role="row"
   aria-label={'Columns for '+groupLabel+': select, piece name, quantity, length, width and more'}>
   {['','Piece / Item','Qty','L','W',''].map((heading,index)=>
    <div key={index} role="columnheader" className="qqt-mobile-column"
     aria-label={heading||(index===0?'Select':'More options')}>{heading||(
      index===5?<span aria-hidden="true">⋯</span>:null)}</div>)}
  </div>;
 return <section className="qqt-workspace" aria-label="Takeoffs spreadsheet">
  <QuoteMobileCellToolbar grid={list}/>
  <header className="qqt-heading">
   <div className="qqt-heading-instructions"><h3>Takeoffs</h3>
    <span className="qqt-desktop-hint">Click, type or paste to edit · Tab/Enter to move · pencil for more</span>
    <span className="qqt-mobile-hint">Tap a cell to edit · ⋯ for options</span></div>
   <button className="qqt-desktop-advanced" type="button" onClick={()=>areas[0]&&onAdvanced(areas[0].id)}>Advanced fabrication ↗</button>
  </header>
  <QuoteBulkActionPopover count={selected.length}
   onClear={()=>{setSelected([]);setTarget('');setMoveOpen(false);}}
   actions={[
    {id:'duplicate',label:'Duplicate selected takeoff rows',icon:'copy',
     disabled:!editable||!canDuplicateSelection,onClick:()=>duplicateRows(selected)},
    {id:'exclude',label:'Strike out selected rows',icon:'strike',disabled:!editable,onClick:()=>apply('exclude')},
    {id:'restore',label:'Restore selected rows',icon:'restore',disabled:!editable,onClick:()=>apply('restore')},
    {id:'move',label:'Move selected rows to another Area',icon:'move',
     disabled:!editable,active:moveOpen,onClick:()=>setMoveOpen(v=>!v)},
    {id:'delete',label:'Delete selected takeoff rows',icon:'delete',danger:true,
     disabled:!editable,onClick:()=>apply('delete')},
   ]}>
    {moveOpen&&<div className="qba-edit-flyout" role="group" aria-label="Move selected rows">
     <select aria-label="Move selected rows to Area" value={target} onChange={e=>setTarget(e.target.value)}>
      <option value="">Destination…</option>
      {areas.map(area=><option value={area.id} key={area.id}>{area.title}</option>)}
      <option value="general">General · charges only</option>
     </select>
     <button type="button" disabled={!target} onClick={()=>{apply('move');setMoveOpen(false);}}>Move</button>
    </div>}
  </QuoteBulkActionPopover>
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
     <div className="qqt-group">
      <div className="qqt-area-identity"><strong>{section.title}</strong>
       <span>{sf.format(summary.measuredSf)} SF</span></div>
      <div className="qqt-area-actions">
       <button disabled={!editable} type="button" onClick={()=>addPiece(section)}>+ Piece</button>
       <button disabled={!editable} type="button" onClick={()=>addSink(section)}>+ Sink</button>
       <button disabled={!editable} type="button" onClick={()=>addLine(section)}>+ Charge</button>
       <button disabled={!editable} type="button" title="Duplicate this Area"
        onClick={()=>store.duplicateArea(quote.id,section.id)}>⧉ Area</button>
      </div><strong className="qqt-area-price">{money.format(summary.total)}</strong></div>
     {mobileColumnHeader(section.title)}
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
         ()=>deleteRow(ref),()=>duplicateRows([ref]))}
       {([
        ['back','backsplash','Back'],['left','leftSplash','Left'],['right','rightSplash','Right']
        ] as const).filter(([,field])=>piece[field]).map(([edge,,label])=>{
         const splashRef:QuoteScopeRowRef={kind:'splash',edge,id:piece.id,sectionId:section.id};
         const splashExcluded=isSplashEdgeExcluded(piece,edge);
         return row(splashRef,section.title,<span className="qqt-splash-name">↳ {label} splash</span>,
          piece.count,
          edge==='back'?piece.lengthIn??'—':piece.widthIn??'—',
          <SmallInput label={label+' splash height '+piece.name} disabled={!editable}
           value={takeoffSplashEdgeHeightIn(piece,edge)}
           commit={value=>setPiece(section,piece,{splashEdgeHeightsIn:{
            ...piece.splashEdgeHeightsIn,[edge]:value??piece.splashHeightIn??4}})}/>,
          sf.format(takeoffPieceSplashEdgeSf(piece,edge)),
          <span className="qqt-readonly" title="Splash is part of the area's stone price">Included in stone</span>,
          splashExcluded,
          ()=>setDetail({areaId:section.id,id:piece.id,kind:'splash',edge}),false,
          ()=>deleteRow(splashRef),()=>duplicateRows([splashRef]));
       })}
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
       ()=>deleteRow(ref),()=>duplicateRows([ref]));
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
        ()=>deleteRow(ref),line.quantitySource?.syncMode==='live'||line.takeoffSinkId
         ?undefined:()=>duplicateRows([ref]));
      })}
     {!pieces.length&&!sinks.length&&!otherLines.length&&
      <div className="qqt-empty">No takeoffs yet. Add a piece, sink or charge.</div>}
    </div>;
   })}
   <div className="qqt-area-block"><div className="qqt-group qqt-general-group">
    <strong>General</strong><span>Project-wide charges and adjustments</span>
    <div><button type="button" disabled={!editable} onClick={()=>addLine(null)}>+ Charge</button></div></div>
    {mobileColumnHeader('General')}
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
       ()=>deleteRow(ref),line.quantitySource?.syncMode==='live'||line.takeoffSinkId
         ?undefined:()=>duplicateRows([ref]));
     })}
   </div>
  </div>
  {detail&&<DetailPopup quote={quote} section={quote.sections.find(s=>s.id===detail.areaId)??null}
   rowRef={{kind:detail.kind,id:detail.id,sectionId:detail.areaId??undefined,edge:detail.edge}}
   piece={detail.kind==='piece'||detail.kind==='splash'
    ?quote.sections.find(s=>s.id===detail.areaId)?.scope?.takeoffPieces?.find(p=>p.id===detail.id):undefined}
   sink={detail.kind==='sink'?quote.sections.find(s=>s.id===detail.areaId)?.scope?.takeoffSinks?.find(p=>p.id===detail.id):undefined}
   line={detail.kind==='line'?quote.lines.find(l=>l.id===detail.id):undefined}
   onDuplicate={()=>duplicateRows([{kind:detail.kind,id:detail.id,sectionId:detail.areaId??undefined,edge:detail.edge}])}
   onDelete={()=>{deleteRow({kind:detail.kind,id:detail.id,sectionId:detail.areaId??undefined,edge:detail.edge});setDetail(null);}}
   onClose={()=>setDetail(null)}/>}
 </section>;
}
