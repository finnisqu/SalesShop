import { useState } from 'react';
import { useQuoteStore } from '../store/quoteStore';
import type { Quote, QuoteSection, QuoteTakeoffSink } from '../types/quote';
import { SINK_CATEGORIES, SINK_CATEGORY_LABELS } from '../types/sink';
import { newTakeoffSink } from '../services/quoteTakeoffsLite';
import { TakeoffMaterialCatalog, TakeoffSinkCatalog } from './TakeoffCatalogPickers';

/** Compact, live-store-connected Material and Sink editor for mobile Quotes Beta. */
export function QuoteBetaMaterials({quote,section,editable}:{
  quote:Quote;section:QuoteSection;editable:boolean;
}) {
  const updateSinks=useQuoteStore(s=>s.updateTakeoffSinks);
  const selectMaterial=useQuoteStore(s=>s.selectTakeoffMaterial);
  const [showHelp,setShowHelp]=useState(false);
  const sinks=section.scope?.takeoffSinks??[];
  const patchSink=(id:string,patch:Partial<QuoteTakeoffSink>)=>
    updateSinks(quote.id,section.id,sinks.map(s=>s.id===id?{...s,...patch}:s));
  const addSink=()=>updateSinks(quote.id,section.id,[...sinks,newTakeoffSink()]);
  return <div className="qmb-materials-sheet">
    <div className="qmb-grid-toolbar">
      <div><strong>Material</strong><small>Catalog search or custom description</small></div>
    </div>
    <div className="qmb-material-picker">
      <TakeoffMaterialCatalog disabled={!editable} value={section.scope?.takeoffMaterial??''}
        selected={section.scope?.takeoffMaterialReference} pinned={quote.projectMaterials??[]}
        onTextChange={name=>selectMaterial(quote.id,section.id,name)}
        onSelect={(reference,label)=>selectMaterial(quote.id,section.id,label,reference)}/>
    </div>
    <div className="qmb-grid-toolbar qmb-sink-headline">
      <div><strong>Sinks</strong><small>{sinks.length} selected · optional specifications</small></div>
      <button className="qmb-quiet" type="button" onClick={()=>setShowHelp(v=>!v)}
        aria-expanded={showHelp}>ⓘ</button>
    </div>
    {showHelp&&<p className="qmb-help">Charge on quote creates a normal priced sink line. Leave it unchecked when its price is already built into another charge. Customer visibility is chosen separately on the Pricing tab. Hiding a priced sink on the customer quote rolls that charge into the main visible line.</p>}
    <div className="qmb-sinks-sheet">
      {sinks.map((sink,index)=><div className="qmb-sink-line" key={sink.id}>
        <div className="qmb-sink-primary">
          <select aria-label={'Sink '+(index+1)+' type'} disabled={!editable} value={sink.category}
            onChange={e=>patchSink(sink.id,{category:e.target.value as QuoteTakeoffSink['category'],sinkReference:undefined})}>
            {SINK_CATEGORIES.map(c=><option value={c} key={c}>{SINK_CATEGORY_LABELS[c]}</option>)}
          </select>
          <div className="qmb-sink-catalog">
            <TakeoffSinkCatalog disabled={!editable} value={sink.name}
              onTextChange={name=>patchSink(sink.id,{name,sinkReference:undefined})}
              onSelect={patch=>patchSink(sink.id,patch)}/>
          </div>
          <button type="button" aria-label={'Remove sink '+(index+1)} className="qmb-sink-remove"
            disabled={!editable} onClick={()=>updateSinks(quote.id,section.id,sinks.filter(s=>s.id!==sink.id))}>×</button>
        </div>
        <div className="qmb-sink-secondary">
          <label className="qmb-sink-qty">Qty <input type="number" inputMode="numeric" min="1" max="1000"
            aria-label={'Sink '+(index+1)+' quantity'} value={sink.count} disabled={!editable}
            onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=1000)patchSink(sink.id,{count:n});}}/></label>
          <label className="qmb-sink-charge"><input type="checkbox" checked={sink.includeInPricing} disabled={!editable}
            onChange={e=>patchSink(sink.id,{includeInPricing:e.target.checked})}/> Charge on quote</label>
          {sink.includeInPricing&&<label className="qmb-sink-price">
            $/each <input aria-label={'Sink '+(index+1)+' sell price'} type="number" inputMode="decimal"
              min="0" step=".01" value={sink.unitPrice??''} placeholder="—" disabled={!editable}
              onChange={e=>{const n=Number(e.target.value);if(e.target.value===''||(Number.isFinite(n)&&n>=0))patchSink(sink.id,{unitPrice:e.target.value===''?undefined:n});}}/>
          </label>}
        </div>
      </div>)}
      {!sinks.length&&<div className="qmb-grid-empty">No sinks yet. You can leave this empty.</div>}
      <button type="button" className="qmb-grid-add" disabled={!editable||sinks.length>=100}
        onClick={addSink}>+ Add sink</button>
    </div>
  </div>;
}
