import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Quote,QuoteSection,QuoteTakeoffPiece,QuoteTakeoffSink,QuoteLine} from '../types/quote';
import {quoteLineAmount,quoteLinesTotal,quoteTotal} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {auditQuoteDraft} from '../services/quoteDraftAudit';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
import {newTakeoffPiece,newTakeoffSink,parseInches,takeoffPieceSf,takeoffPieceSplashSf,
 totalBillableTakeoffSf,totalBillableMiterInches,roundedBillableTakeoffSf,takeoffPieceMiterInches} from '../services/quoteTakeoffsLite';
import {calculateAreaCustomerPrice,projectAreaCost} from '../services/quoteAreaCost';
import {savedAreaMultiplier} from '../services/quotePriceInput';
import {TakeoffMaterialCatalog,TakeoffSinkCatalog} from './TakeoffCatalogPickers';
import {SINK_CATEGORIES,SINK_CATEGORY_LABELS} from '../types/sink';
import {QuoteInlineAreaName,QuoteInlineAreaRate} from './QuoteInlineAreaEditing';
import {QuoteBetaDesktopPricing} from './QuoteBetaDesktopPricing';
import {QuoteBetaMaterials} from './QuoteBetaMaterials';
import {QuoteSharedSlabPools} from './QuoteSharedSlabPools';
import type {QuoteScopeRowRef,QuoteScopeBulkOperation} from '../services/quoteScopeRowBatch';
import './quote-work-tables.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const sf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const rowKey=(row:QuoteScopeRowRef)=>[row.kind,row.sectionId??'general',row.id].join(':');
type ScopeTableProps={
 quote:Quote;section:QuoteSection|null;general?:boolean;view:'summary'|'lines';showColumns?:boolean;selected:Set<string>;
 onSelect:(row:QuoteScopeRowRef,checked:boolean)=>void;onSelectMany:(rows:QuoteScopeRowRef[],checked:boolean)=>void;
 onCalc:(id:string|null)=>void;onAdvanced:(id:string)=>void;
};

/** Blur commits once, including fractions for cut-piece dimensions. */
function NumberCell({value,label,disabled,min=0,max=10000,integer=false,inches=false,onCommit}:{
 value?:number;label:string;disabled:boolean;min?:number;max?:number;integer?:boolean;inches?:boolean;
 onCommit:(value:number|undefined)=>void;
}){
 const [draft,setDraft]=useState(value===undefined?'':String(value));
 useEffect(()=>setDraft(value===undefined?'':String(value)),[value]);
 const commit=()=>{
  const parsed=draft.trim()===''?undefined:inches?parseInches(draft):Number(draft);
  if(parsed===undefined&&draft.trim()===''){if(value!==undefined)onCommit(undefined);return;}
  if(parsed!==undefined&&Number.isFinite(parsed)&&parsed>=min&&parsed<=max&&(!integer||Number.isInteger(parsed))){
    if(parsed!==value)onCommit(parsed);return;
  }
  setDraft(value===undefined?'':String(value));
 };
 return <input aria-label={label} className="qwt-input qwt-numeric" inputMode="decimal" type="text"
  disabled={disabled} value={draft} placeholder="—" onChange={e=>setDraft(e.target.value)}
  onBlur={commit} onKeyDown={e=>{
   // The parent worktable owns Enter→next-cell navigation; keep Escape local.
   if(e.key==='Escape'){e.preventDefault();setDraft(value===undefined?'':String(value));e.currentTarget.blur();}
  }}/>;
}
function ScopeRows({quote,section,general=false,view,showColumns=false,selected,onSelect,onSelectMany,onCalc,onAdvanced}:ScopeTableProps){
 const editable=quoteIsCommerciallyEditable(quote);
 const [materialOpen,setMaterialOpen]=useState(false);
 const materialAnchor=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!materialOpen)return;
  const dismiss=(event:PointerEvent)=>{
   if(!materialAnchor.current?.contains(event.target as Node))setMaterialOpen(false);
  };
  document.addEventListener('pointerdown',dismiss);
  return()=>document.removeEventListener('pointerdown',dismiss);
 },[materialOpen]);
 const store=useQuoteStore.getState();
 const id=section?.id;
 const pieces=section?.scope?.takeoffPieces??[];
 const sinks=section?.scope?.takeoffSinks??[];
 const lines=quote.lines.filter(line=>general?
  !line.sectionId||!quote.sections.some(s=>s.id===line.sectionId)||line.sectionId===id:
  line.sectionId===id);
 const primary=general?undefined:lines.find(line=>line.quantitySource?.syncMode==='live'
   &&line.quantitySource.field==='countertopSf')
  ??lines.find(line=>line.kind==='material'&&!line.takeoffSinkId);
 const extras=lines.filter(line=>line!==primary&&!line.takeoffSinkId);
 const cost=section&&!general?projectAreaCost(quote,section):null;
 const amount=quoteLinesTotal(lines);
 const billedSf=pieces.length?roundedBillableTakeoffSf(pieces,section?.scope?.billableSfRounding):
   section?.scope?.countertopSf??0;
 const effectiveSellSf=primary?.includeInTotal&&billedSf>0
   ?quoteLineAmount(primary)/billedSf:undefined;
 const miterInches=totalBillableMiterInches(pieces);
 const issue=section&&!general?auditQuoteDraft(quote).blockers.find(item=>
  item.destination.view==='area'&&item.destination.areaId===id):undefined;
 const excludedMeasuredWork=pieces.some(p=>p.excludedFromQuote||p.excludeSplashFromQuote);
 const excludedSinkWork=sinks.some(p=>p.excludedFromContract);
 const manualExclusionReview=Boolean((excludedMeasuredWork&&primary&&primary.pricingMode!=='quantity-rate'
   ||excludedSinkWork&&primary)&&!section?.scope?.exclusionPricingReviewed);
 const refs:QuoteScopeRowRef[]=[
  ...pieces.flatMap(piece=>([
   {kind:'piece' as const,id:piece.id,sectionId:id},
   ...((piece.backsplash||piece.leftSplash||piece.rightSplash)?
    [{kind:'splash' as const,id:piece.id,sectionId:id}]:[]),
  ])),
  ...sinks.map(sink=>({kind:'sink' as const,id:sink.id,sectionId:id})),
  ...extras.map(line=>({kind:'line' as const,id:line.id,sectionId:line.sectionId})),
 ];
 const patchPiece=(piece:QuoteTakeoffPiece,patch:Partial<QuoteTakeoffPiece>)=>{
  if(!id)return;store.updateTakeoffPieces(quote.id,id,pieces.map(p=>p.id===piece.id?{...p,...patch}:p));
 };
 const patchSink=(sink:QuoteTakeoffSink,patch:Partial<QuoteTakeoffSink>)=>{
  if(!id)return;store.updateTakeoffSinks(quote.id,id,sinks.map(s=>s.id===sink.id?{...s,...patch}:s));
 };
 const toggle=(ref:QuoteScopeRowRef,excluded:boolean)=>
  store.bulkScopeRows(quote.id,[ref],excluded?'restore':'exclude');
 const box=(ref:QuoteScopeRowRef)=><input type="checkbox" className="qwt-check"
  aria-label={'Select '+ref.kind+' '+ref.id} checked={selected.has(rowKey(ref))}
  onChange={e=>onSelect(ref,e.target.checked)}/>;
 const include=(ref:QuoteScopeRowRef,excluded:boolean)=><button type="button"
  className={'qwt-include'+(excluded?' is-off':'')} disabled={!editable}
  aria-label={(excluded?'Restore ':'Exclude ')+ref.kind+' '+ref.id}
  onClick={()=>toggle(ref,excluded)} title={excluded?'Restore to customer quote':'Keep takeoff but omit from customer quote'}>
  {excluded?'↶ Restore':'Strike out'}</button>;
 const category=(label:string,count:number)=><div className="qwt-kind-head" role="row">
   <strong>{label}</strong><span>{count} {count===1?'item':'items'}</span></div>;
 const addPiece=()=>{if(id&&pieces.length<500)store.updateTakeoffPieces(quote.id,id,
  [...pieces,newTakeoffPiece(pieces.length+1)]);};
 const addSink=()=>{if(id&&sinks.length<100)store.updateTakeoffSinks(quote.id,id,[...sinks,newTakeoffSink()]);};
 const addCharge=(kind:'item'|'discount'|'material'|'sink'='item')=>store.addLine(quote.id,kind,id);
 const addSpecial=(type:NonNullable<QuoteLine['costCategory']>)=>{
  const lineId=store.addLine(quote.id,type==='tax'?'tax':type==='miter'?'rate':'item',id);
  const titles:Record<NonNullable<QuoteLine['costCategory']>,string>={
   product:'Other product',miter:'Mitered edge',specialty:'Special fabrication',
   freight:'Freight / shipping',tax:'Tax',tariff:'Tariff',breakage:'Breakage allowance'};
  const linked=type==='miter'&&!!id;
  store.updateLine(quote.id,lineId,{
   description:titles[type],costCategory:type,
   productCode:type==='product'?'':undefined,supplierName:type==='product'?'':undefined,
   unitLabel:type==='miter'?'IN':type==='product'?'EA':undefined,
   pricingMode:linked||type==='product'?'quantity-rate':'direct',
   quantity:linked?miterInches:type==='product'?1:undefined,
   rate:undefined,amount:linked||type==='product'?undefined:0,
   ...(linked?{quantitySource:{kind:'area-scope',sectionId:id!,field:'miterInches',
      syncMode:'live',capturedValue:miterInches,appliedAt:new Date().toISOString()}}:{}),
  });
 };
 const addLinkedMiter=()=>{
  if(!id||lines.some(l=>l.costCategory==='miter'&&l.quantitySource?.syncMode==='live'))return;
  addSpecial('miter');
 };
 const chooseMethod=(mode:QuoteLine['pricingMode'])=>{
  if(!id||!primary||mode===primary.pricingMode)return;
  const multiplier=savedAreaMultiplier(primary.materialReference,2.2);
  const calculated=mode==='slab-multiplier'?calculateAreaCustomerPrice('multiplier',{
   sf:totalBillableTakeoffSf(pieces),slabs:cost?.slabCount,
   costPerSlab:cost?.slabCost,multiplier}):undefined;
  store.updateLine(quote.id,primary.id,{
   pricingMode:mode,rate:mode==='quantity-rate'?primary.rate:undefined,
   amount:mode==='direct'?quoteLineAmount(primary):mode==='slab-multiplier'?calculated:undefined,
   // Existing live links cannot be overwritten through the general line editor.
   // Re-sync them through the takeoff owner after changing modes.
   ...(mode==='quantity-rate'&&pieces.length&&primary.quantitySource?.syncMode!=='live'?{
     quantity:roundedBillableTakeoffSf(pieces,section?.scope?.billableSfRounding),
     quantitySource:{kind:'area-scope' as const,sectionId:id,field:'countertopSf' as const,
       syncMode:'live' as const,capturedValue:roundedBillableTakeoffSf(pieces,section?.scope?.billableSfRounding),
       appliedAt:new Date().toISOString()},
   }:{}),
   materialReference:mode==='slab-multiplier'?{
    ...(primary.materialReference??{stockProgram:false,pricingSource:'slab-multiplier' as const}),
    pricingSource:'slab-multiplier' as const,slabMultiplier:multiplier,
    slabCount:cost?.slabCount,sourceSlabCost:cost?.slabCost}:primary.materialReference,
  });
  if(mode==='quantity-rate'&&pieces.length&&primary.quantitySource?.syncMode==='live')
   store.updateTakeoffPieces(quote.id,id,pieces);
 };
 const setMultiplier=(value:number|undefined)=>{
  if(!primary)return;
  const calculated=calculateAreaCustomerPrice('multiplier',{
   sf:totalBillableTakeoffSf(pieces),slabs:cost?.slabCount,
   costPerSlab:cost?.slabCost,multiplier:value});
  store.updateLine(quote.id,primary.id,{amount:calculated,
    materialReference:{...(primary.materialReference??{stockProgram:false,pricingSource:'slab-multiplier' as const}),
      pricingSource:'slab-multiplier' as const,slabMultiplier:value,
      slabCount:cost?.slabCount,sourceSlabCost:cost?.slabCost}});
 };
 return <section className={'qwt-area qwt-scope-'+view} aria-label={(general?'General':section?.title??'Area')+(view==='summary'?' setup row':' takeoff lines')}>
  {view==='summary'&&<div className="qwt-area-top">
   <div className="qwt-area-label">{section&&!general?<QuoteInlineAreaName quote={quote} section={section}/>:
    <strong>General</strong>}
    <small>{general?'Fees, allowances, discounts and unassigned work':'Measured takeoffs · selling · costs'}</small>
    {section&&!general&&<select aria-label={'Customer display for '+section.title}
      disabled={!editable} value={!section.customerVisible?'hidden':section.customerDisplayMode==='summary'?'summary':'detail'}
      onChange={e=>store.updateSection(quote.id,section.id,{customerVisible:e.target.value!=='hidden',
       ...(e.target.value!=='hidden'?{customerDisplayMode:e.target.value==='summary'?'summary':'detail'}:{})})}>
      <option value="detail">Contract: itemized</option><option value="summary">Contract: lump sum</option>
      <option value="hidden">Hidden from customer</option>
    </select>}
   </div>
   {section&&!general?<div className="qwt-summary-grid">
     <div ref={materialAnchor} className={'qwt-summary-material qwt-material-anchor'+
       (pieces.length>0&&!section.scope?.takeoffMaterial?.trim()?' qwt-needs-review':'')}>
       <span>Material</span>
       <button type="button" className="qwt-material-trigger" disabled={!editable}
        aria-expanded={materialOpen} aria-haspopup="dialog"
        aria-label={'Select material for '+section.title}
        onClick={()=>setMaterialOpen(v=>!v)}>
        <strong>{section.scope?.takeoffMaterial||'Choose material'}</strong><span aria-hidden="true">▾</span>
       </button>
       {section.scope?.takeoffMaterialReference?.materialId&&
         <small>✓ Catalog selection</small>}
       {materialOpen&&<div className="qwt-material-popover" role="dialog"
         aria-label={'Material catalog for '+section.title}>
         <div className="qwt-material-popover-head"><strong>Choose a material</strong>
          <button type="button" onClick={()=>setMaterialOpen(false)} aria-label="Close material picker">×</button></div>
         <TakeoffMaterialCatalog disabled={!editable} value={section.scope?.takeoffMaterial??''}
           selected={section.scope?.takeoffMaterialReference} pinned={quote.projectMaterials??[]}
           onTextChange={name=>store.selectTakeoffMaterial(quote.id,id!,name)}
           onSelect={(reference,label)=>{
             store.selectTakeoffMaterial(quote.id,id!,label,reference);
             setMaterialOpen(false);
           }}/>
       </div>}
     </div>
     <div className="qwt-sf-cell"><span>Measured SF</span>
       <strong>{sf.format(totalBillableTakeoffSf(pieces))}</strong>
       <select aria-label={'SF billing rounding for '+section.title}
        disabled={!editable} value={section.scope?.billableSfRounding??'exact'}
        onChange={e=>{
         store.updateSection(quote.id,id!,{scope:{...section.scope,
          billableSfRounding:e.target.value as NonNullable<typeof section.scope>['billableSfRounding']}});
         store.updateTakeoffPieces(quote.id,id!,pieces);
        }}>
         <option value="exact">Exact SF</option>
         <option value="quarter-up">Up to ¼ SF</option>
         <option value="half-up">Up to ½ SF</option>
         <option value="whole-up">Up to whole SF</option>
       </select>
       {section.scope?.billableSfRounding&&section.scope.billableSfRounding!=='exact'&&
        <small>Billed: {sf.format(roundedBillableTakeoffSf(pieces,section.scope.billableSfRounding))} SF</small>}
      </div>
     <label className="qwt-editable-cell"><span>Pricing method</span>
       <select aria-label={'Pricing method for '+section.title} disabled={!editable||!primary}
        value={primary?.pricingMode??'quantity-rate'}
        onChange={e=>chooseMethod(e.target.value as QuoteLine['pricingMode'])}>
        <option value="quantity-rate">SF rate</option>
        <option value="direct">Manual</option>
        <option value="slab-multiplier">Slab multiplier</option>
       </select></label>
     <label className="qwt-editable-cell"><span>{primary?.pricingMode==='direct'?'Selling amount':
       primary?.pricingMode==='slab-multiplier'?'Multiplier':'Sell / SF'}</span>
       {primary?.pricingMode==='quantity-rate'
        ?<QuoteInlineAreaRate quote={quote} section={section} onOpen={()=>onCalc(id!)}/>
        :primary?.pricingMode==='direct'
        ?<NumberCell label={'Manual selling amount for '+section.title}
           value={primary.amount} disabled={!editable}
           onCommit={value=>store.updateLine(quote.id,primary.id,{amount:value})}/>
        :primary?.pricingMode==='slab-multiplier'
        ?<NumberCell label={'Selling multiplier for '+section.title}
           value={savedAreaMultiplier(primary.materialReference,2.2)}
           min={0.01} max={100} disabled={!editable} onCommit={setMultiplier}/>
        :<button type="button" onClick={()=>onCalc(id!)}>Set a price</button>}
       <small>Effective: {effectiveSellSf!==undefined?money.format(effectiveSellSf)+'/SF':'—'}
         {sinks.length?' · '+sinks.filter(s=>!s.excludedFromContract).length+' sink line(s)':''}</small>
     </label>
     <div className={cost?.marginPercent===undefined?'qwt-needs-cost':cost.marginPercent<(section?.scope?.targetMargin??.30)*100?'qwt-needs-review':'qwt-ok'}>
       <span>Margin</span><strong>{cost?.marginPercent===undefined?'—':cost.marginPercent.toFixed(1)+'%'}</strong></div>
     <div className={issue||manualExclusionReview?'qwt-needs-review':''}><span>Total</span><strong>{money.format(amount)}</strong>
       {issue&&<small title={issue.title}>! Check price</small>}
       {manualExclusionReview&&<small>! Recheck manual price</small>}</div>
   </div>:<div className="qwt-general-total"><span>General charges</span>
    <strong>{money.format(amount)}</strong><small>Quote total {money.format(quoteTotal(quote))}</small></div>}
   <button type="button" className="qwt-calculator" onClick={()=>onCalc(general?null:id!)}>Calculator ↗</button>
  </div>
  {view==='lines'&&<>
  <div className="qwt-sheet-context"><strong>{general?'General charges':section?.title??'Area'}</strong>
   {!general&&<><span>{section?.scope?.takeoffMaterial||'Choose a material in Areas & General'}</span>
    <span>{sf.format(totalBillableTakeoffSf(pieces))} measured SF</span>
    <span>Effective sell / SF: {effectiveSellSf!==undefined?money.format(effectiveSellSf):'—'}</span>
    <span>{primary?.pricingMode==='direct'?'Manual total':primary?.pricingMode==='slab-multiplier'?'Slab multiplier':'SF rate'}</span></>}
   <button type="button" onClick={()=>onCalc(general?null:id!)}>Calculator ↗</button>
  </div>
  {manualExclusionReview&&<div className="qwt-exclusion-warning" role="status">
    <span>Excluded takeoffs are preserved. The selling price may still include excluded work.
      Review it in Calculator; no automatic manual or multiplier repricing has occurred.</span>
    <button type="button" disabled={!editable||!id} onClick={()=>store.updateSection(quote.id,id!,{
      scope:{...section!.scope,exclusionPricingReviewed:true},
    })}>I've reviewed this price</button>
   </div>}
  {refs.length>0&&<div className="qwt-table-selection">
    <label><input type="checkbox" checked={refs.every(row=>selected.has(rowKey(row)))}
     onChange={e=>onSelectMany(refs,e.target.checked)}/> Select all lines</label>
    <small>{refs.filter(row=>selected.has(rowKey(row))).length} selected here</small></div>}
  <div className="qwt-table" role="region" aria-label={(section?.title||'General')+' editable worksheet'}
   onKeyDown={(event:KeyboardEvent<HTMLDivElement>)=>{
   if(!['Enter','ArrowDown','ArrowUp'].includes(event.key)||event.nativeEvent.isComposing
      ||!(event.target instanceof HTMLInputElement)||event.target.type==='checkbox'||event.defaultPrevented)return;
   const cell=event.target;
   const inputs=Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>(
     'input.qwt-input:not(:disabled), input.qwt-description:not(:disabled)'));
   const index=inputs.indexOf(cell);
   if(index<0)return;
   const next=event.key==='ArrowUp'?index-1:index+1;
   if(next<0||next>=inputs.length)return;
   event.preventDefault();cell.blur();
   requestAnimationFrame(()=>inputs[next]?.focus());
  }}>
   {showColumns&&<div className="qwt-columns" aria-hidden="true"><span></span><span>Type / description</span>
    <span>Length</span><span>Width</span><span>Qty</span><span>Detail / rate</span>
    <span>SF / amount</span><span>Private cost</span><span>Contract</span></div>}
   {!!pieces.length&&category('Pieces',pieces.length)}
   {pieces.map((piece,index)=>{
     const ref:QuoteScopeRowRef={kind:'piece',id:piece.id,sectionId:id};
     return <div key={piece.id} className="qwt-piece-block">
      <div className={'qwt-line'+(piece.excludedFromQuote?' is-excluded':'')+
       (!piece.excludedFromQuote&&(!piece.lengthIn||!piece.widthIn)?' has-issue':'')}>
       {box(ref)}<label className="qwt-title-cell"><small>Piece {index+1}</small>
         <input className="qwt-input qwt-description" aria-label={'Piece '+(index+1)+' name'}
          disabled={!editable} placeholder={'Piece '+(index+1)} maxLength={140}
          value={piece.name} onChange={e=>patchPiece(piece,{name:e.target.value})}/></label>
       <NumberCell label={'Piece '+(index+1)+' length inches'} value={piece.lengthIn} inches min={0.01}
          disabled={!editable} onCommit={v=>patchPiece(piece,{lengthIn:v})}/>
       <NumberCell label={'Piece '+(index+1)+' width inches'} value={piece.widthIn} inches min={0.01}
          disabled={!editable} onCommit={v=>patchPiece(piece,{widthIn:v})}/>
       <NumberCell label={'Piece '+(index+1)+' quantity'} value={piece.count} integer min={1} max={1000}
          disabled={!editable} onCommit={v=>{if(v!==undefined)patchPiece(piece,{count:v});}}/>
       <div className="qwt-detail qwt-edge-choices"><small>Top · splash edges</small>
        <div role="group" aria-label={'Piece '+(index+1)+' splash edges'}>
         {([['backsplash','B'],['leftSplash','L'],['rightSplash','R']] as const).map(([flag,label])=>
          <label key={flag} title={flag==='backsplash'?'Back splash':flag==='leftSplash'?'Left splash':'Right splash'}>
           <input type="checkbox" disabled={!editable} checked={!!piece[flag]}
            aria-label={'Piece '+(index+1)+' '+flag}
            onChange={e=>patchPiece(piece,{[flag]:e.target.checked})}/>
           {label}
          </label>)}
        </div>
        <div className="qwt-miter-edges" role="group" aria-label={'Piece '+(index+1)+' miter edges'}>
           {([['miterFront','Front'],['miterLeft','Left'],['miterRight','Right']] as const).map(([flag,label])=>
             <label key={flag} title={'Miter '+label.toLowerCase()+' edge'}>
              <input type="checkbox" disabled={!editable} checked={!!piece[flag]}
               onChange={e=>patchPiece(piece,{[flag]:e.target.checked})}/>{label}</label>)}
           {(piece.miterFront||piece.miterLeft||piece.miterRight)&&
             <small>{takeoffPieceMiterInches(piece).toFixed(1)} IN</small>}
         </div>
         <label className="qwt-edge-field"><small>Edge profile</small>
          <input type="text" className="qwt-input" aria-label={'Edge profile for piece '+(index+1)}
           maxLength={90} disabled={!editable} value={piece.edgeProfile??'Flat'}
           onChange={e=>patchPiece(piece,{edgeProfile:e.target.value})}/></label>
       </div>
       <strong className="qwt-amount">{sf.format(piece.excludedFromQuote?0:takeoffPieceSf(piece))} SF</strong>
       <span className="qwt-muted-cell" title="Part of the Area material cost">Area cost</span>
       {include(ref,!!piece.excludedFromQuote)}
      </div>
      {(piece.backsplash||piece.leftSplash||piece.rightSplash)&&<div className={'qwt-line qwt-splash-line'+
        (piece.excludeSplashFromQuote||piece.excludedFromQuote?' is-excluded':'')}>
       {box({kind:'splash',id:piece.id,sectionId:id})}
       <span className="qwt-title-cell"><small>Splash for {piece.name||'Piece '+(index+1)}</small></span>
       <span>—</span><span>—</span><span>{piece.count}×</span>
       <div className="qwt-detail"><small>Splash height (in)</small>
        <NumberCell label={'Splash height for piece '+(index+1)} min={0} max={120}
         value={piece.splashHeightIn??4} disabled={!editable}
         onCommit={v=>patchPiece(piece,{splashHeightIn:v??4})}/>
        <small>{[piece.backsplash?'Back':null,piece.leftSplash?'Left':null,piece.rightSplash?'Right':null].filter(Boolean).join(' / ')}</small>
       </div>
       <strong className="qwt-amount">{sf.format(piece.excludeSplashFromQuote||piece.excludedFromQuote?0:takeoffPieceSplashSf(piece))} SF</strong>
       <span className="qwt-muted-cell">Area cost</span>
       {include({kind:'splash',id:piece.id,sectionId:id},!!piece.excludeSplashFromQuote)}
      </div>}
     </div>;
   })}
   {!!sinks.length&&category('Sinks',sinks.length)}
   {sinks.map((sink,index)=>{
     const ref:QuoteScopeRowRef={kind:'sink',id:sink.id,sectionId:id};
     const excluded=!!sink.excludedFromContract;
     return <div key={sink.id} className={'qwt-line'+(excluded?' is-excluded':'')+
       (!excluded&&sink.includeInPricing&&sink.unitPrice===undefined?' has-issue':'')}>
      {box(ref)}
      <div className="qwt-title-cell qwt-sink-catalog"><small>Sink {index+1} · model</small>
       <select aria-label={'Sink '+(index+1)+' type'} value={sink.category}
        disabled={!editable} onChange={e=>patchSink(sink,{
         category:e.target.value as QuoteTakeoffSink['category'],sinkReference:undefined,
        })}>
         {SINK_CATEGORIES.map(type=><option key={type} value={type}>{SINK_CATEGORY_LABELS[type]}</option>)}
       </select>
       <TakeoffSinkCatalog disabled={!editable} value={sink.name}
        onTextChange={name=>patchSink(sink,{name,sinkReference:undefined})}
        onSelect={patch=>patchSink(sink,patch)}/>
      </div>
      <span>—</span><span>—</span>
      <NumberCell label={'Sink '+(index+1)+' quantity'} value={sink.count} min={1} max={1000} integer disabled={!editable}
       onCommit={v=>{if(v!==undefined)patchSink(sink,{count:v});}}/>
      <div className="qwt-detail"><small>Sell / each</small>
       <NumberCell label={'Sink '+(index+1)+' price'} value={sink.unitPrice} disabled={!editable}
        onCommit={v=>patchSink(sink,{unitPrice:v})}/></div>
      <strong className="qwt-amount">{excluded?'—':sink.includeInPricing?money.format(sink.count*(sink.unitPrice??0)):'Spec only'}</strong>
      <NumberCell label={'Private sink cost per unit for '+(sink.name||'sink')}
        value={sink.internalCostOverride??sink.sinkReference?.snapshot?.internalCost}
        disabled={!editable} onCommit={value=>patchSink(sink,{internalCostOverride:value})}/>
      {include(ref,excluded)}
     </div>;
   })}
   {!!extras.length&&category('Other charges',extras.length)}
   {extras.map(line=>{
     const ref:QuoteScopeRowRef={kind:'line',id:line.id,sectionId:line.sectionId};
     const excluded=!line.includeInTotal;
     const changes=(patch:Partial<QuoteLine>)=>store.updateLine(quote.id,line.id,patch);
     const incomplete=!excluded&&(line.internalOnlyCost&&line.internalCost===undefined&&line.unitCost===undefined||
      line.pricingMode!=='none'&&(line.pricingMode==='quantity-rate'
       ?line.rate===undefined||line.quantity===undefined:line.amount===undefined));
    return <div className={'qwt-line'+(excluded?' is-excluded':'')+(incomplete?' has-issue':'')} key={line.id}>
       {box(ref)}
       <label className="qwt-title-cell"><small>{line.kind.replace('-',' ')}</small>
       <input className="qwt-input qwt-description" aria-label={'Charge '+line.id+' description'}
        value={line.description} disabled={!editable} onChange={e=>changes({description:e.target.value})}/>
       <select aria-label={'Charge '+line.id+' pricing method'}
        value={line.internalOnlyCost?'internal-only':line.pricingMode}
        disabled={!editable} onChange={e=>{
         const mode=e.target.value as QuoteLine['pricingMode']|'internal-only';
         if(mode==='internal-only')changes({pricingMode:'none',internalOnlyCost:true,
            includeInTotal:true,customerVisible:false,amount:undefined,rate:undefined});
         else if(mode==='quantity-rate')changes({pricingMode:mode,internalOnlyCost:false,
            customerVisible:true,quantity:line.quantity??1,rate:line.rate??undefined});
         else if(mode==='direct')changes({pricingMode:mode,internalOnlyCost:false,
            customerVisible:true,amount:line.amount??quoteLineAmount(line)});
         else changes({pricingMode:mode,internalOnlyCost:false});
        }}>
        <option value="direct">Manual amount</option>
        <option value="quantity-rate">Quantity × rate</option>
        <option value="none">Notes only</option>
        <option value="internal-only">Absorbed cost (private)</option>
        {line.pricingMode==='slab-multiplier'&&<option value="slab-multiplier">Slab multiplier</option>}
       </select>
      </label>
       {line.costCategory==='product'
        ?<input className="qwt-input" aria-label={'Supplier for '+line.description}
           placeholder="Supplier" value={line.supplierName??''} disabled={!editable}
           onChange={e=>changes({supplierName:e.target.value})}/>
        :<span className="qwt-muted-cell">{line.costCategory||'—'}</span>}
       {line.costCategory==='product'
        ?<input className="qwt-input" aria-label={'SKU for '+line.description}
           placeholder="SKU" value={line.productCode??''} disabled={!editable}
           onChange={e=>changes({productCode:e.target.value})}/>
        :<span className="qwt-muted-cell">—</span>}
       {line.pricingMode==='quantity-rate'?<div className="qwt-quantity-cell">
         <NumberCell label={'Charge '+line.id+' quantity'}
          value={line.quantity} min={0} disabled={!editable||line.quantitySource?.syncMode==='live'}
          onCommit={v=>changes({quantity:v})}/>
         {line.costCategory==='product'&&<input className="qwt-input qwt-unit-label"
           aria-label={'Purchase unit for '+line.description} placeholder="EA"
           value={line.unitLabel??''} maxLength={12} disabled={!editable}
           onChange={e=>changes({unitLabel:e.target.value})}/>}
         {line.quantitySource?.field==='miterInches'&&<small>Linked IN</small>}
        </div>:<span>—</span>}
       <div className="qwt-detail">{line.pricingMode==='none'?<span>—</span>:
        line.pricingMode==='quantity-rate'
         ?<NumberCell label={'Charge '+line.id+' rate'} value={line.rate} disabled={!editable}
           onCommit={v=>changes({rate:v})}/>
         :<NumberCell label={'Charge '+line.id+' amount'} value={line.amount} disabled={!editable}
           onCommit={v=>changes({amount:v})}/>}</div>
       <strong className="qwt-amount">{line.internalOnlyCost?'Private cost':money.format(excluded?0:quoteLineAmount(line))}</strong>
       <div className="qwt-private-cost-cell">
        <NumberCell label={(line.costCategory==='product'?'Private unit':'Private total')+' cost for '+line.description}
          value={line.costCategory==='product'?line.unitCost:line.internalCost}
          disabled={!editable} onCommit={value=>changes(line.costCategory==='product'
            ?{unitCost:value,internalCost:undefined}:{internalCost:value})}/>
        {line.costCategory==='product'&&line.unitCost!==undefined&&
         <small>Σ {money.format(line.unitCost*(line.quantity??0))}</small>}
        </div>
       {include(ref,excluded)}
     </div>;
   })}
   {!refs.length&&<p className="qwt-empty">No lines yet. Add a piece, sink or charge to begin.</p>}
  </div>
  {editable&&<div className="qwt-add-row">
    {id&&<><button type="button" onClick={addPiece}>+ Piece</button><button type="button" onClick={addSink}>+ Sink</button></>}
    <button type="button" onClick={()=>addCharge('item')}>+ Charge</button>
    <button type="button" onClick={()=>addCharge('discount')}>+ Discount</button>
    {id&&<button type="button" onClick={addLinkedMiter}
       disabled={lines.some(l=>l.costCategory==='miter'&&l.quantitySource?.syncMode==='live')}>
        + Linked miter</button>}
    <details className="qwt-more-add"><summary>+ More ▾</summary><div>
      {(['product','specialty','freight','tax','tariff','breakage'] as const).map(type=><button
       key={type} type="button" onClick={()=>addSpecial(type)}>
       + {type==='product'?'Other product':type==='freight'?'Shipping':type.charAt(0).toUpperCase()+type.slice(1)}</button>)}
    </div></details>
    {general&&<><button type="button" onClick={()=>addCharge('material')}>+ Material</button>
      <button type="button" onClick={()=>addCharge('sink')}>+ Sink charge</button></>}
  </div>}
  </>}
 </section>;
}
/** Private calculator is a dismissible focus panel, not another quote workflow page. */
function CalculatorDrawer({quote,section,onClose,onAdvanced}:{
 quote:Quote;section:QuoteSection|null;onClose:()=>void;onAdvanced:(id:string)=>void;
}){
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{
  const key=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape')onClose();};
  document.addEventListener('keydown',key);
  ref.current?.querySelector<HTMLElement>('button')?.focus();
  return()=>document.removeEventListener('keydown',key);
 },[onClose]);
 const generalLines=quote.lines.filter(l=>!l.sectionId||!quote.sections.some(s=>s.id===l.sectionId)
  ||quote.sections.some(s=>s.id===l.sectionId&&isGeneralTakeoffSection(s)));
 const cost=generalLines.reduce((n,l)=>n+(l.includeInTotal?l.internalCost??0:0),0);
 const price=quoteLinesTotal(generalLines);
 return createPortal(<div className="qmb qwt-drawer-backdrop" onPointerDown={e=>{
  if(e.target===e.currentTarget)onClose();}}>
  <section ref={ref} role="dialog" aria-modal="true" aria-label={section?'Calculator for '+section.title:'General calculator'}
   className="qwt-drawer">
   <header><div><small>PRIVATE ESTIMATING</small><h2>{section?section.title+' · Calculator':'General · Calculator'}</h2>
    </div><button type="button" aria-label="Close calculator" onClick={onClose}>×</button></header>
   <div className="qwt-drawer-body">
    {section?<><p className="qwt-drawer-note">Choose selling method, then edit the corresponding rate or total.
       The cost estimate and 30% target margin stay private; they do not change customer prices until you apply them.</p>
       <QuoteBetaDesktopPricing quote={quote} section={section}
          editable={quoteIsCommerciallyEditable(quote)} view="selling"/>
       <QuoteBetaDesktopPricing quote={quote} section={section}
          editable={quoteIsCommerciallyEditable(quote)} view="calculator"/>
       <details><summary>Catalog sinks and fabrication details</summary>
        <QuoteBetaMaterials quote={quote} section={section}
         editable={quoteIsCommerciallyEditable(quote)} part="sinks" showHeading={false}/></details>
       <button type="button" className="qwt-advanced-link" onClick={()=>{onAdvanced(section.id);onClose();}}>
        Full fabrication details ↗</button>
      </>:<><p>General charges and known costs are listed below. Missing internal costs are not assumed to be zero for margin decisions.</p>
       <div className="qwt-general-math"><span>General selling total</span><strong>{money.format(price)}</strong>
        <span>Entered internal costs</span><strong>{money.format(cost)}</strong>
        <small>Apply line amounts in the General table. No automatic repricing.</small></div>
       <section className="qwt-general-cost-list" aria-label="General private line costs">
        <strong>Private costs per General line</strong>
        {generalLines.map(line=><label key={line.id}>
          <span>{line.description||'Unnamed charge'}{!line.includeInTotal?' · excluded':''}</span>
          <span className="qwt-general-cost-input">Cost $
           <input type="number" min="0" step=".01" aria-label={'Internal cost for '+line.description}
             disabled={!quoteIsCommerciallyEditable(quote)} value={line.internalCost??''}
             placeholder="Unknown" onChange={e=>{
              const raw=e.target.value;const value=raw===''?undefined:Number(raw);
              if(value===undefined||Number.isFinite(value)&&value>=0)
               useQuoteStore.getState().updateLine(quote.id,line.id,{internalCost:value});
             }}/>
          </span>
        </label>)}
        {!generalLines.length&&<small>No General charges to cost yet.</small>}
        <small>Blank means unknown, not $0. Costs stay private and do not automatically change customer selling prices.</small>
       </section></>}
    <details className="qwt-shared-drawer">
      <summary>Shared slab buying · automatic when compatible</summary>
      <QuoteSharedSlabPools quote={quote}/>
    </details>
   </div>
   <footer><button type="button" onClick={onClose}>Done</button></footer>
  </section>
 </div>,document.querySelector('.sales-app')??document.body);
}
export function QuoteWorkTables({quote,onAddArea,onLayouts,onAdvanced,onGeneralTakeoff}:{
 quote:Quote;onAddArea:()=>void;onLayouts:()=>void;onAdvanced:(id:string)=>void;onGeneralTakeoff:()=>void;
}){
 const [selected,setSelected]=useState<QuoteScopeRowRef[]>([]);
 const [operation,setOperation]=useState<QuoteScopeBulkOperation>('exclude');
 const [target,setTarget]=useState('');
 const [calculator,setCalculator]=useState<string|null|'general'>(null);
 const store=useQuoteStore.getState();
 const editable=quoteIsCommerciallyEditable(quote);
 useEffect(()=>setSelected([]),[quote.id]);
 const ids=new Set(selected.map(rowKey));
 const onSelect=(ref:QuoteScopeRowRef,checked:boolean)=>
  setSelected(old=>checked?[...old.filter(v=>rowKey(v)!==rowKey(ref)),ref]:
   old.filter(v=>rowKey(v)!==rowKey(ref)));
 const onSelectMany=(refs:QuoteScopeRowRef[],checked:boolean)=>{
  const keys=new Set(refs.map(rowKey));
  setSelected(old=>checked?[...old.filter(v=>!keys.has(rowKey(v))),...refs]:
   old.filter(v=>!keys.has(rowKey(v))));
 };
 const areas=quote.sections.filter(s=>!isGeneralTakeoffSection(s));
 const general=quote.sections.find(s=>isGeneralTakeoffSection(s))??null;
 const selectedValid=selected.filter(row=>{
   if(row.kind==='line')return quote.lines.some(l=>l.id===row.id);
   const section=quote.sections.find(s=>s.id===row.sectionId);
   return row.kind==='sink'?section?.scope?.takeoffSinks?.some(s=>s.id===row.id):
    section?.scope?.takeoffPieces?.some(p=>p.id===row.id);
 });
 const commitBulk=()=>{
  if(!editable||!selectedValid.length)return;
  const validTarget=operation!=='move'||(target&&quote.sections.some(s=>s.id===target));
  if(!validTarget||operation==='move'&&selectedValid.some(r=>r.kind==='splash'&&
      !selectedValid.some(p=>p.kind==='piece'&&p.id===r.id&&p.sectionId===r.sectionId)))return;
  store.bulkScopeRows(quote.id,selectedValid,operation,operation==='move'?target:undefined);
  setSelected([]);
 };
 return <div className="qwt-workspace" role="region" aria-label="Takeoffs selections and pricing tables">
  <header className="qwt-intro"><div><div className="qmb-kicker">QUICK QUOTE · SINGLE WORKSPACE</div>
    <h2>Quote Builder</h2>
    <p>Set up Areas once, then edit measurements, selections and prices in one worksheet.
     Struck-out work keeps its measurements and can be restored at any time.</p>
   </div><div className="qwt-intro-actions">
    <button type="button" disabled={!editable} onClick={onLayouts}>Saved layouts</button>
   </div></header>
  {!!selectedValid.length&&<div className="qwt-bulk" role="toolbar" aria-label="Bulk edit selected quote lines">
   <strong>{selectedValid.length} selected</strong>
   <label>Change <select aria-label="Bulk action" value={operation}
    onChange={e=>setOperation(e.target.value as QuoteScopeBulkOperation)}>
    <option value="exclude">Strike out · exclude from contract</option>
    <option value="restore">Restore to contract</option>
    <option value="move">Move to another Area</option>
   </select></label>
   {operation==='move'&&<label>Destination <select aria-label="Destination Area" value={target}
    onChange={e=>setTarget(e.target.value)}><option value="">Select Area</option>
    {quote.sections.map(s=><option value={s.id} key={s.id}>{isGeneralTakeoffSection(s)?'General':s.title}</option>)}
    <option value="__general">General charges</option>
   </select></label>}
   <button type="button" disabled={!editable||(operation==='move'&&(!target||
      selectedValid.some(r=>r.kind==='splash'&&!selectedValid.some(p=>
       p.kind==='piece'&&p.id===r.id&&p.sectionId===r.sectionId))))}
    onClick={()=>{
     if(operation==='move'&&target==='__general'){
       const chargeRows=selectedValid.filter(r=>r.kind==='line');
       if(chargeRows.length===selectedValid.length)
        store.bulkScopeRows(quote.id,chargeRows,operation,undefined);
       else return;
       setSelected([]);
     }else commitBulk();
    }}>Apply to {selectedValid.length} lines</button>
   <button type="button" onClick={()=>setSelected([])}>Clear</button>
   {operation==='move'&&target==='__general'&&selectedValid.some(r=>r.kind!=='line')&&
    <small role="alert">Pieces and sinks need a measured destination Area. Select an Area to move them.</small>}
   {operation==='move'&&selectedValid.some(r=>r.kind==='splash'&&!selectedValid.some(p=>
    p.kind==='piece'&&p.id===r.id&&p.sectionId===r.sectionId))&&
    <small role="alert">Splash subrows stay attached to their Piece. Select the Piece too to move it.</small>}
  </div>}
  <section className="qwt-grid-panel qwt-areas-panel" aria-label="Areas and General setup table">
   <div className="qwt-panel-heading"><div><h3>1 · Areas &amp; General</h3>
    <p>Define each Area, select its material, review totals and open its calculator.</p></div>
    <button type="button" disabled={!editable} onClick={onAddArea}>+ Area</button></div>
   <div className="qwt-overview-labels" aria-hidden="true"><span>Area / contract</span>
    <span>Material &amp; setup</span><span>Measured / buying / selling</span>
    <span>Estimate &amp; calculator</span></div>
   {areas.map(section=><ScopeRows key={section.id} view="summary" quote={quote} section={section}
     selected={ids} onSelect={onSelect} onSelectMany={onSelectMany}
     onCalc={id=>setCalculator(id??'general')} onAdvanced={onAdvanced}/>)}
   {!areas.length&&<p className="qwt-no-areas">No Areas yet. Add one to start measuring and pricing.</p>}
   <ScopeRows quote={quote} section={general} view="summary" general selected={ids}
     onSelect={onSelect} onSelectMany={onSelectMany} onCalc={()=>setCalculator('general')} onAdvanced={onAdvanced}/>
  </section>
  <section className="qwt-grid-panel qwt-lines-panel" aria-label="Takeoffs selections and pricing worksheet">
   <div className="qwt-panel-heading"><div><h3>2 · Takeoffs, Selections &amp; Pricing</h3>
    <p>Edit measurements and prices directly. Material and effective $/SF follow Area settings.</p></div>
    <strong className="qwt-project-total">Quote {money.format(quoteTotal(quote))}</strong></div>
   <div className="qwt-lines-scroll">
    {areas.map((section,index)=><ScopeRows key={section.id} view="lines" showColumns={index===0} quote={quote} section={section}
      selected={ids} onSelect={onSelect} onSelectMany={onSelectMany}
      onCalc={id=>setCalculator(id??'general')} onAdvanced={onAdvanced}/>)}
    <ScopeRows quote={quote} section={general} view="lines" showColumns={!areas.length} general selected={ids}
      onSelect={onSelect} onSelectMany={onSelectMany} onCalc={()=>setCalculator('general')} onAdvanced={onAdvanced}/>
   </div>
   {editable&&!general&&<button type="button" className="qwt-general-start" onClick={onGeneralTakeoff}>
    + General measured takeoff</button>}
  </section>
  {calculator!==null&&<CalculatorDrawer quote={quote}
   section={calculator==='general'?null:quote.sections.find(s=>s.id===calculator)??null}
   onAdvanced={onAdvanced} onClose={()=>setCalculator(null)}/>}
 </div>;
}
