import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {Quote,QuoteLine,QuoteSection,QuoteTakeoffSink} from '../types/quote';
import {quoteLineAmount,quoteTotal} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {quickAreaPrimary,quickAreaSummary,quickGeneralSummary,quickRoundedSf} from '../services/quoteQuickAreaSummary';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
import {newTakeoffSink} from '../services/quoteTakeoffsLite';
import {QuoteInlineAreaName} from './QuoteInlineAreaEditing';
import {TakeoffMaterialCatalog,TakeoffSinkCatalog} from './TakeoffCatalogPickers';
import {QuoteBetaDesktopPricing} from './QuoteBetaDesktopPricing';
import {CalculatorDrawer} from './QuoteWorkTables';
import './quote-quick-areas.css';

const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const amount=(v:number)=>currency.format(v);
const sf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
type DetailKind='area'|'material'|'sf'|'price'|'sinks'|'specialty'|'total';
type Detail={areaId:string|null;kind:DetailKind};
const detailName:Record<DetailKind,string>={
 area:'Area settings',material:'Stone selection',sf:'Square feet',
 price:'Material pricing',sinks:'Sinks',specialty:'Specialty charges',total:'Price breakdown',
};
/** Never bind a continually changing currency string to the numeric input. */
function CommitNumber({value,onCommit,label,disabled=false,integer=false}:{
 value?:number;onCommit:(v:number|undefined)=>void;label:string;disabled?:boolean;integer?:boolean;
}){
 const [draft,setDraft]=useState(value===undefined?'':String(value));
 useEffect(()=>setDraft(value===undefined?'':String(value)),[value]);
 const commit=()=>{
  const raw=draft.trim();
  if(!raw){if(value!==undefined)onCommit(undefined);return;}
  const parsed=Number(raw);
  if(Number.isFinite(parsed)&&parsed>=0&&(!integer||Number.isInteger(parsed))){
   if(parsed!==value)onCommit(parsed);
  }else setDraft(value===undefined?'':String(value));
 };
 return <input className="qqs-edit" type="text" inputMode="decimal" aria-label={label}
  value={draft} disabled={disabled} placeholder="—"
  onChange={event=>setDraft(event.target.value)} onBlur={commit}
  onKeyDown={event=>{
   if(event.key==='Enter')event.currentTarget.blur();
   if(event.key==='Escape'){setDraft(value===undefined?'':String(value));event.currentTarget.blur();}
  }}/>;
}
function SummaryCell({value,label,focused,onFocus,onEdit,muted=false,warn=false}:{
 value:ReactNode;label:string;focused:boolean;onFocus:()=>void;onEdit:()=>void;
 muted?:boolean;warn?:boolean;
}){
 return <div className={'qqs-cell qqs-focusable'+(focused?' is-focused':'')+
  (muted?' is-muted':'')+(warn?' is-warning':'')} role="group" aria-label={label}>
  <button type="button" className="qqs-value" title={typeof value==='string'?value:label}
   onClick={onFocus}><span>{value}</span></button>
  <button type="button" className="qqs-pencil" aria-label={'Edit '+label}
   title={'Edit '+label} onClick={onEdit}>✎</button>
 </div>;
}
function DetailPanel({quote,detail,onClose,onCalculator,onTakeoffs,onAdvanced}:{
 quote:Quote;detail:Detail;onClose:()=>void;onCalculator:(id:string|null)=>void;
 onTakeoffs:(id:string)=>void;onAdvanced:(id:string)=>void;
}){
 const store=useQuoteStore.getState(),editable=quoteIsCommerciallyEditable(quote);
 const section=quote.sections.find(s=>s.id===detail.areaId);
 const data=section?quickAreaSummary(quote,section):null;
 const general=quickGeneralSummary(quote);
 const lines=section?quote.lines.filter(l=>l.sectionId===section.id):general.lines;
 const extras=section?data?.specialty??[]:general.lines;
 const title=section?.title??'General';
 const input=useRef<HTMLDivElement>(null);
 const closeRef=useRef(onClose);
 closeRef.current=onClose;
 useEffect(()=>{
  const escape=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape')closeRef.current();};
  document.addEventListener('keydown',escape);
  input.current?.querySelector<HTMLButtonElement>('.qqs-panel-close')?.focus();
  return()=>document.removeEventListener('keydown',escape);
 },[detail.kind,detail.areaId]);
 const addSink=()=>{
  if(!section)return;
  store.updateTakeoffSinks(quote.id,section.id,
   [...(section.scope?.takeoffSinks??[]),newTakeoffSink()]);
 };
 const patchSink=(sink:QuoteTakeoffSink,patch:Partial<QuoteTakeoffSink>)=>{
  if(!section)return;
  store.updateTakeoffSinks(quote.id,section.id,
   (section.scope?.takeoffSinks??[]).map(s=>s.id===sink.id?{...s,...patch}:s));
 };
 const addCharge=(kind:'item'|'discount'|'rate'='item')=>{
  store.addLine(quote.id,kind,section?.id);
 };
 const updateManualSf=(v:number|undefined)=>{
  if(!section||data?.hasMeasuredPieces||!editable)return;
  // Manual SF is owned by the Area until actual takeoff pieces are entered.
  store.updateSection(quote.id,section.id,{scope:{...section.scope,countertopSf:v}});
  const current=quickAreaPrimary(quote,section.id);
  const billed=v===undefined?undefined:quickRoundedSf(v,section.scope?.billableSfRounding);
  if(current?.pricingMode==='quantity-rate'&&current.quantitySource?.syncMode!=='live')
   store.updateLine(quote.id,current.id,{quantity:billed});
  else if(!current&&v!==undefined)
   store.addCatalogLine(quote.id,'material',{
    sectionId:section.id,description:section.scope?.takeoffMaterial||'Countertop material',
    pricingMode:'quantity-rate',quantity:billed,rate:undefined,
    customerVisible:true,includeInTotal:true,materialReference:section.scope?.takeoffMaterialReference,
   });
 };
 const changeLine=(line:QuoteLine,patch:Partial<QuoteLine>)=>
  store.updateLine(quote.id,line.id,patch);
 return createPortal(<div className="qmb qqs-overlay" onPointerDown={event=>{
  if(event.target===event.currentTarget)onClose();
 }}>
   <div className="qqs-panel" role="dialog" aria-modal="true"
    aria-label={detailName[detail.kind]+' for '+title} ref={input}>
    <header><div><small>QUICK QUOTE · {title}</small><h2>{detailName[detail.kind]}</h2></div>
     <button type="button" className="qqs-panel-close" onClick={onClose}
      aria-label="Close editor">×</button></header>
    <div className="qqs-panel-body">
     {section&&detail.kind==='area'&&<>
      <label>Area name<QuoteInlineAreaName quote={quote} section={section}/></label>
      <label>Customer presentation
       <select disabled={!editable} value={!section.customerVisible?'hidden':section.customerDisplayMode??'detail'}
        onChange={e=>store.updateSection(quote.id,section.id,{
         customerVisible:e.target.value!=='hidden',
         ...(e.target.value!=='hidden'?{customerDisplayMode:e.target.value as 'detail'|'summary'}:{})})}>
        <option value="detail">Itemized on contract</option>
        <option value="summary">Lump sum on contract</option>
        <option value="hidden">Hidden from customer</option>
       </select>
      </label>
      <button type="button" className="qqs-secondary" onClick={()=>{onAdvanced(section.id);onClose();}}>
       Advanced Area settings ↗</button>
     </>}
     {section&&detail.kind==='material'&&<>
       <p>Choose a Catalog variant or enter a custom stone name. The choice flows through both worksheets.</p>
       <TakeoffMaterialCatalog disabled={!editable} value={section.scope?.takeoffMaterial??''}
        pinned={quote.projectMaterials??[]} selected={section.scope?.takeoffMaterialReference}
        onTextChange={name=>store.selectTakeoffMaterial(quote.id,section.id,name)}
        onSelect={(ref,label)=>store.selectTakeoffMaterial(quote.id,section.id,label,ref)}/>
       <div className="qqs-metric"><span>Current selection</span>
        <strong>{section.scope?.takeoffMaterial||'Not selected'}</strong></div>
       <small>Source buying costs remain private and are handled in Calculator.</small>
     </>}
     {section&&detail.kind==='sf'&&<>
       <p>Billable square feet drives SF-rate selling. Enter known SF directly, or measure your pieces in Takeoffs.</p>
       <div className="qqs-metrics">
        <div><span>Measured SF</span><strong>{sf.format(data?.measuredSf??0)}</strong></div>
        <div><span>Billable SF</span><strong>{sf.format(data?.billedSf??0)}</strong></div>
       </div>
       {data?.hasMeasuredPieces
        ?<><p>Square feet is linked to {section.scope?.takeoffPieces?.length} measured piece(s).
         Edit their geometry in the Takeoffs tab to preserve calculation accuracy.</p>
         <button className="qqs-secondary" type="button"
          onClick={()=>{onTakeoffs(section.id);onClose();}}>Edit measured pieces ↗</button></>
        :<label>Manual billable SF
          <CommitNumber label={'Manual square feet for '+section.title}
           value={section.scope?.countertopSf??data?.billedSf} disabled={!editable}
           onCommit={updateManualSf}/></label>}
       <label>Billable SF rounding
        <select disabled={!editable} value={section.scope?.billableSfRounding??'exact'}
         onChange={e=>{
          const mode=e.target.value as NonNullable<NonNullable<QuoteSection['scope']>['billableSfRounding']>;
          store.updateSection(quote.id,section.id,{scope:{...section.scope,billableSfRounding:mode}});
          if(data?.hasMeasuredPieces)
           store.updateTakeoffPieces(quote.id,section.id,section.scope?.takeoffPieces??[]);
          else{
           const primary=quickAreaPrimary(quote,section.id);
           if(primary?.pricingMode==='quantity-rate'&&primary.quantitySource?.syncMode!=='live')
            store.updateLine(quote.id,primary.id,{quantity:quickRoundedSf(
             section.scope?.countertopSf??data?.measuredSf??0,mode)});
          }
         }}>
         <option value="exact">Exact measured SF</option><option value="quarter-up">Round up to ¼ SF</option>
         <option value="half-up">Round up to ½ SF</option><option value="whole-up">Round up to whole SF</option>
        </select>
       </label>
     </>}
     {section&&detail.kind==='price'&&<>
       <p>Customer selling method and private cost estimates are separate. Nothing is repriced without an explicit edit.</p>
       <QuoteBetaDesktopPricing quote={quote} section={section} editable={editable} view="selling"/>
       <button type="button" className="qqs-secondary" onClick={()=>{onCalculator(section.id);onClose();}}>
        View private Calculator ↗</button>
     </>}
     {section&&detail.kind==='sinks'&&<>
      <p>Add kitchen, vanity or other fixtures. Their managed quote lines determine the actual customer total.</p>
      {(section.scope?.takeoffSinks??[]).map(sink=><section key={sink.id} className="qqs-item-card">
       <label>Sink model
        <TakeoffSinkCatalog disabled={!editable} value={sink.name}
         onTextChange={name=>patchSink(sink,{name,sinkReference:undefined})}
         onSelect={patch=>patchSink(sink,patch)}/>
       </label>
       <div className="qqs-two">
        <label>Category
         <select disabled={!editable} value={sink.category}
          onChange={e=>patchSink(sink,{category:e.target.value as QuoteTakeoffSink['category']})}>
          <option value="kitchen">Kitchen</option><option value="vanity">Vanity</option>
          <option value="bar-prep">Bar / Prep</option><option value="laundry">Laundry</option>
          <option value="other">Other</option>
         </select>
        </label>
        <label>Quantity
         <CommitNumber label={'Quantity '+sink.name} value={sink.count} disabled={!editable} integer
          onCommit={v=>{if(v!==undefined&&v>=1)patchSink(sink,{count:v});}}/>
        </label>
        <label>Customer unit price
         <CommitNumber label={'Unit price '+sink.name} value={sink.unitPrice}
          disabled={!editable} onCommit={v=>patchSink(sink,{unitPrice:v})}/>
        </label>
        <label>Private unit cost
         <CommitNumber label={'Private cost '+sink.name} value={sink.internalCostOverride}
          disabled={!editable} onCommit={v=>patchSink(sink,{internalCostOverride:v})}/>
        </label>
       </div>
       <div className="qqs-item-total">
        <label><input type="checkbox" disabled={!editable} checked={!!sink.includeInPricing&&!sink.excludedFromContract}
         onChange={e=>store.setTakeoffSinkCharge(quote.id,section.id,sink.id,e.target.checked)}/>
          Include in price</label>
        <strong>{amount(quote.lines.filter(l=>l.sectionId===section.id&&l.takeoffSinkId===sink.id&&l.includeInTotal)
         .reduce((sum,line)=>sum+quoteLineAmount(line),0))}</strong>
       </div>
      </section>)}
      <button className="qqs-secondary" disabled={!editable} type="button" onClick={addSink}>+ Add sink</button>
     </>}
     {(detail.kind==='specialty'||!section&&detail.kind==='total')&&<>
      <p>Specialty charges, products, freight and discounts. Each line remains independently editable.</p>
      {extras.map(line=><section key={line.id} className="qqs-item-card">
       <label>Description
        <input type="text" disabled={!editable} value={line.description}
         onChange={e=>changeLine(line,{description:e.target.value})}/>
       </label>
       <div className="qqs-two">
        <label>Pricing
         <select disabled={!editable} value={line.pricingMode}
          onChange={e=>changeLine(line,{pricingMode:e.target.value as QuoteLine['pricingMode']})}>
          <option value="direct">Fixed total</option><option value="quantity-rate">Qty × rate</option>
          <option value="none">Notes only</option>
          {line.pricingMode==='slab-multiplier'&&<option value="slab-multiplier">Slab multiplier</option>}
         </select>
        </label>
        {line.pricingMode==='quantity-rate'&&<label>Quantity
         <CommitNumber label={'Quantity '+line.description} disabled={!editable||line.quantitySource?.syncMode==='live'}
          value={line.quantity} onCommit={v=>changeLine(line,{quantity:v})}/></label>}
        <label>{line.pricingMode==='quantity-rate'?'Unit rate':'Amount'}
         <CommitNumber label={'Selling price '+line.description}
          value={line.pricingMode==='quantity-rate'?line.rate:line.amount} disabled={!editable}
          onCommit={v=>changeLine(line,line.pricingMode==='quantity-rate'?{rate:v}:{amount:v})}/>
        </label>
        <label>Private cost
         <CommitNumber label={'Private cost '+line.description} value={line.internalCost}
          disabled={!editable} onCommit={v=>changeLine(line,{internalCost:v})}/>
        </label>
       </div>
       <div className="qqs-item-total">
        <label><input type="checkbox" checked={line.includeInTotal} disabled={!editable}
         onChange={e=>changeLine(line,{includeInTotal:e.target.checked})}/> Include in price</label>
        <strong>{amount(line.includeInTotal?quoteLineAmount(line):0)}</strong>
       </div>
      </section>)}
      <div className="qqs-inline-actions">
       <button disabled={!editable} type="button" onClick={()=>addCharge()}>+ Charge</button>
       <button disabled={!editable} type="button" onClick={()=>addCharge('discount')}>+ Discount</button>
      </div>
     </>}
     {section&&detail.kind==='total'&&<>
      <div className="qqs-breakdown">
       <span>Stone / material</span><strong>{amount(data?.materialPrice??0)}</strong>
       <span>Sinks</span><strong>{amount(data?.sinkPrice??0)}</strong>
       <span>Specialty &amp; adjustments</span><strong>{amount(data?.specialtyPrice??0)}</strong>
       <span>Total selling price</span><strong>{amount(data?.total??0)}</strong>
      </div>
      <button type="button" className="qqs-secondary" onClick={()=>{onCalculator(section.id);onClose();}}>
       Open private Calculator ↗</button>
     </>}
    </div>
    <footer><button type="button" onClick={onClose}>Done</button></footer>
   </div>
  </div>,document.querySelector('.sales-app')??document.body);
}
export function QuoteQuickAreaSummary({quote,onAddArea,onLayouts,onTakeoffs,onAdvanced}:{
 quote:Quote;onAddArea:()=>void;onLayouts:()=>void;
 onTakeoffs:(areaId:string)=>void;onAdvanced:(areaId:string)=>void;
}){
 const store=useQuoteStore.getState(),editable=quoteIsCommerciallyEditable(quote);
 const [detail,setDetail]=useState<Detail|null>(null);
 const [calculator,setCalculator]=useState<string|null>(null);
 const [focus,setFocus]=useState('');
 const [selected,setSelected]=useState<string[]>([]);
 const [bulkMode,setBulkMode]=useState<'detail'|'summary'|'hidden'|'visible'>('summary');
 useEffect(()=>{setSelected([]);setDetail(null);setFocus('');},[quote.id]);
 const areas=quote.sections.filter(section=>!isGeneralTakeoffSection(section));
 const general=quickGeneralSummary(quote);
 const choose=(id:string,on:boolean)=>setSelected(old=>on?[...old.filter(x=>x!==id),id]:old.filter(x=>x!==id));
 const open=(areaId:string|null,kind:DetailKind)=>setDetail({areaId,kind});
 const cell=(areaId:string,kind:DetailKind,label:string,value:ReactNode,muted=false,warn=false)=>
  <SummaryCell key={kind} value={value} label={label}
   focused={focus===label} onFocus={()=>setFocus(label)}
   onEdit={()=>open(areaId,kind)} muted={muted} warn={warn}/>;
 const bulkApply=()=>{
  if(!editable||!selected.length)return;
  const count=store.bulkEditAreas(quote.id,selected,
   bulkMode==='detail'?{customerDisplayMode:'detail'}:
   bulkMode==='summary'?{customerDisplayMode:'summary'}:
   bulkMode==='hidden'?{customerVisible:false}:{customerVisible:true});
  if(count===selected.length)setSelected([]);
 };
 return <section className="qqs-summary" aria-label="Quick Quote compact Area summary">
   <header className="qqs-summary-head">
    <div><h3>Areas</h3><span>{areas.length} {areas.length===1?'room':'rooms'} · click a cell to reveal its editor</span></div>
    <div className="qqs-inline-actions">
     <button type="button" disabled={!editable} onClick={onLayouts}>Saved layouts</button>
     <button type="button" className="qqs-accent" disabled={!editable} onClick={onAddArea}>+ Area</button>
    </div>
   </header>
   {!!selected.length&&<div className="qqs-bulk" role="toolbar" aria-label="Bulk Area presentation">
    <strong>{selected.length} selected</strong><select aria-label="Bulk Area action"
     value={bulkMode} onChange={event=>setBulkMode(event.target.value as typeof bulkMode)}>
     <option value="summary">Contract: lump sum</option>
     <option value="detail">Contract: itemized</option>
     <option value="hidden">Hide Areas from contract</option>
     <option value="visible">Show Areas on contract</option>
    </select>
    <button type="button" onClick={bulkApply} disabled={!editable}>Apply</button>
    <button type="button" onClick={()=>setSelected([])}>Clear</button>
   </div>}
   <div className="qqs-scroll" role="region" aria-label="Area summary spreadsheet" tabIndex={0}>
    <div className="qqs-grid qqs-header" role="row">
      <div className="qqs-cell qqs-pin-check"><input type="checkbox" aria-label="Select all Areas"
       checked={areas.length>0&&areas.every(area=>selected.includes(area.id))}
       onChange={event=>setSelected(event.target.checked?areas.map(area=>area.id):[])}/></div>
      {['Area','Stone selection','Square feet','Material price','Sinks qty','Sinks price',
       'Specialty qty','Specialty price','Total price'].map((name,index)=>
       <div className={'qqs-cell'+(index===0?' qqs-pin-area':'')} key={name}>{name}</div>)}
    </div>
    {areas.map(area=>{
     const data=quickAreaSummary(quote,area);
     return <div className="qqs-grid qqs-row" key={area.id} role="row">
      <div className="qqs-cell qqs-pin-check"><input type="checkbox" aria-label={'Select '+area.title}
       checked={selected.includes(area.id)} onChange={event=>choose(area.id,event.target.checked)}/></div>
      <div className="qqs-cell qqs-pin-area qqs-area-name">
       <button type="button" title={area.title}
        onClick={()=>open(area.id,'area')}>{area.title||'New Area'}</button>
       <button type="button" className="qqs-pencil" aria-label={'Edit Area '+area.title}
        onClick={()=>open(area.id,'area')}>✎</button></div>
      {cell(area.id,'material','Stone selection for '+area.title,
        area.scope?.takeoffMaterial||'Choose stone',!area.scope?.takeoffMaterial,!area.scope?.takeoffMaterial)}
      {cell(area.id,'sf','Square feet for '+area.title,
        sf.format(data.billedSf)+(data.measuredSf!==data.billedSf?' / '+sf.format(data.measuredSf):'')+' SF')}
      {cell(area.id,'price','Material price for '+area.title,amount(data.materialPrice),
       !data.primary,data.hasUnpricedMaterial)}
      {cell(area.id,'sinks','Sink quantity for '+area.title,String(data.sinkQuantity),
       !data.sinkQuantity)}
      {cell(area.id,'sinks','Sink price for '+area.title,amount(data.sinkPrice),!data.sinkQuantity)}
      {cell(area.id,'specialty','Specialty quantity for '+area.title,String(data.specialtyQuantity),
       !data.specialtyQuantity)}
      {cell(area.id,'specialty','Specialty price for '+area.title,amount(data.specialtyPrice),
       !data.specialtyQuantity)}
      {cell(area.id,'total','Total price for '+area.title,amount(data.total))}
     </div>;
    })}
    <div className="qqs-grid qqs-row qqs-general" role="row">
     <div className="qqs-cell qqs-pin-check"></div>
     <div className="qqs-cell qqs-pin-area"><button type="button" onClick={()=>open(null,'specialty')}>General</button></div>
     <div className="qqs-cell qqs-general-note">Unassigned charges, freight, discounts and fees</div>
     <div className="qqs-cell qqs-general-spacer"></div>
     <div className="qqs-cell qqs-general-spacer"></div>
     <div className="qqs-cell qqs-general-spacer"></div>
     <div className="qqs-cell qqs-general-spacer"></div>
     <div className="qqs-cell qqs-general-spacer"></div>
     {cell('general','specialty','General charges',amount(general.total),!general.lines.length)}
     {cell('general','total','General total',amount(general.total))}
    </div>
   </div>
   <footer className="qqs-summary-total"><span>Quote total</span><strong>{amount(quoteTotal(quote))}</strong></footer>
   {detail&&<DetailPanel quote={quote} detail={detail} onClose={()=>setDetail(null)}
    onTakeoffs={onTakeoffs} onAdvanced={onAdvanced}
    onCalculator={id=>{setDetail(null);setCalculator(id??'general');}}/>}
   {calculator!==null&&<CalculatorDrawer quote={quote}
    section={calculator==='general'?null:quote.sections.find(s=>s.id===calculator)??null}
    onClose={()=>setCalculator(null)} onAdvanced={onAdvanced}/>}
  </section>;
}
