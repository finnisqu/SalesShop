import { useState } from 'react';
import { useQuoteStore } from '../store/quoteStore';
import type { Quote, QuoteSection, QuoteTakeoffSink } from '../types/quote';
import { SINK_CATEGORIES, SINK_CATEGORY_LABELS } from '../types/sink';
import { newTakeoffSink, FAUCET_HOLE_OFFSETS_IN } from '../services/quoteTakeoffsLite';
import { FloatingRowMenu } from './QuoteBetaMeasureGrid';
import { TakeoffMaterialCatalog, TakeoffSinkCatalog } from './TakeoffCatalogPickers';
import {projectAreaCost} from '../services/quoteAreaCost';
import {selectedMaterialCost} from '../services/selectedMaterialCost';
import {useCompanySettingsStore} from '../store/companySettingsStore';

/** Compact, live-store-connected Material and Sink editor for mobile Quotes Beta. */
export function QuoteBetaMaterials({quote,section,editable,part='all',separateSinkPricing=false}:{
  quote:Quote;section:QuoteSection;editable:boolean;
  part?:'all'|'material'|'sinks';separateSinkPricing?:boolean;
}) {
  const updateSinks=useQuoteStore(s=>s.updateTakeoffSinks);
  const selectMaterial=useQuoteStore(s=>s.selectTakeoffMaterial);
  const [showHelp,setShowHelp]=useState(false);
  const sinks=section.scope?.takeoffSinks??[];
  const projected=projectAreaCost(quote,section);
  const materials=useCompanySettingsStore(s=>s.settings.stockMaterials);
  const catalogCost=selectedMaterialCost(section.scope?.takeoffMaterial??'',
    section.scope?.takeoffMaterialReference,materials);
  const materialSfCost=catalogCost.quotedCostPerSf??catalogCost.currentCatalogCostPerSf;
  const patchSink=(id:string,patch:Partial<QuoteTakeoffSink>)=>
    updateSinks(quote.id,section.id,sinks.map(s=>s.id===id?{...s,...patch}:s));
  const addSink=()=>updateSinks(quote.id,section.id,[...sinks,newTakeoffSink()]);
  return <div className={'qmb-materials-sheet'+(separateSinkPricing?' qmb-sink-selling-separated':'')}>
    {part!=='sinks'&&<>
    <div className="qmb-grid-toolbar">
      <div><strong>Material</strong><small>Catalog search or custom description</small></div>
    </div>
    <div className="qmb-material-picker">
      <TakeoffMaterialCatalog disabled={!editable} value={section.scope?.takeoffMaterial??''}
        selected={section.scope?.takeoffMaterialReference} pinned={quote.projectMaterials??[]}
        onTextChange={name=>selectMaterial(quote.id,section.id,name)}
        onSelect={(reference,label)=>selectMaterial(quote.id,section.id,label,reference)}/>
      <div className="qmb-material-cost-caption" aria-label="Private material buying cost">
        <strong>Buying cost</strong>
        <span>{materialSfCost===undefined?'$ / SF unknown':'$'+materialSfCost.toFixed(2)+'/SF'}</span>
        <span>{projected.slabCost===undefined?'Slab cost unknown':'$'+projected.slabCost.toFixed(2)+'/slab'}</span>
        <span>{projected.purchaseSlabs??'—'} buying slab(s) · {projected.materialCost===undefined?'Cost incomplete':'$'+projected.materialCost.toFixed(2)+' projected purchase cost'}</span>
      </div>
    </div>
    </>}
    {part!=='material'&&<>
    <div className="qmb-grid-toolbar qmb-sink-headline">
      <div><strong>Sinks</strong><small>{sinks.length} selected · optional specifications</small></div>
      <button className="qmb-quiet" type="button" onClick={()=>setShowHelp(v=>!v)}
        aria-expanded={showHelp}>ⓘ</button>
    </div>
    {showHelp&&<p className="qmb-help">Each selected sink creates a price line automatically. Choose quantities and customer selling prices beside the models; faucet holes are fabrication-only selections.</p>}
    <div className="qmb-sinks-sheet">
      {sinks.map((sink,index)=><div className="qmb-sink-line" key={sink.id}>
        <div className="qmb-sink-primary">
          <label className="qmb-sink-type-field"><small>Type</small><select aria-label={'Sink '+(index+1)+' type'} disabled={!editable} value={sink.category}
            onChange={e=>patchSink(sink.id,{category:e.target.value as QuoteTakeoffSink['category'],sinkReference:undefined})}>
            {SINK_CATEGORIES.map(c=><option value={c} key={c}>{SINK_CATEGORY_LABELS[c]}</option>)}
          </select></label>
          <div className="qmb-sink-catalog"><small>Model</small>
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
          <label className="qmb-sink-price">
            $/each <input aria-label={'Sink '+(index+1)+' sell price'} type="number" inputMode="decimal"
              min="0" step=".01" value={sink.unitPrice??''} placeholder="—" disabled={!editable}
              onChange={e=>{const n=Number(e.target.value);if(e.target.value===''||(Number.isFinite(n)&&n>=0))patchSink(sink.id,{unitPrice:e.target.value===''?undefined:n});}}/>
          </label>
          <FloatingRowMenu width={338} label={'Faucet holes for Sink '+(index+1)}
            caption={'Holes · '+((sink.faucetHoleOffsetsIn??[0]).length||'None')}>
            {close=><div className="qmb-holes-menu">
              <div className="qmb-row-menu-title"><strong>Faucet hole locations</strong>
                <small>Each position is 2″ apart; center = 0. Leave empty if unknown.</small></div>
              <div className="qmb-hole-positions" role="group" aria-label={'Sink '+(index+1)+' faucet hole spread'}>
                {FAUCET_HOLE_OFFSETS_IN.map(offset=><label key={offset} className={offset===0?'is-center':''}>
                  <input type="checkbox" aria-label={offset===0?'Center hole':offset<0?Math.abs(offset)+' inches left':offset+' inches right'}
                    disabled={!editable} checked={(sink.faucetHoleOffsetsIn??[0]).includes(offset)}
                    onChange={e=>{
                      const current=sink.faucetHoleOffsetsIn??[0];
                      const updated=e.target.checked?[...current,offset]:current.filter(v=>v!==offset);
                      patchSink(sink.id,{faucetHoleOffsetsIn:[...new Set(updated)].sort((a,b)=>a-b)});
                    }}/>
                  <small>{offset===0?'C':offset>0?'+'+offset:String(offset)}</small>
                </label>)}
              </div>
              <div className="qmb-row-menu-buttons">
                <button type="button" disabled={!editable} onClick={()=>patchSink(sink.id,{faucetHoleOffsetsIn:[]})}>Clear</button>
                <button type="button" disabled={!editable} onClick={()=>patchSink(sink.id,{faucetHoleOffsetsIn:[-2,0,2]})}>4″ spread</button>
                <button type="button" className="qmb-row-menu-done" onClick={close}>Done</button>
              </div>
            </div>}
          </FloatingRowMenu>
        </div>
        <div className="qmb-sink-private-cost" aria-label={'Sink '+(index+1)+' private buying cost'}>
          <span>Buying cost</span>
          <label>$/each <input type="number" min="0" step=".01"
            aria-label={'Sink '+(index+1)+' buying cost'} disabled={!editable}
            placeholder={sink.sinkReference?.snapshot?.internalCost?.toFixed(2)??'Unknown'}
            value={sink.internalCostOverride??''}
            onChange={e=>{const n=e.target.value===''?undefined:Number(e.target.value);
              if(n===undefined||(Number.isFinite(n)&&n>=0))patchSink(sink.id,{internalCostOverride:n});}}/></label>
          <strong>{(sink.internalCostOverride??sink.sinkReference?.snapshot?.internalCost)!==undefined
            ?'$'+((sink.internalCostOverride??sink.sinkReference!.snapshot!.internalCost!)*sink.count).toFixed(2)
            :'Unknown'}</strong>
          <small>× {sink.count}</small>
        </div>
      </div>)}
      {!sinks.length&&<div className="qmb-grid-empty">No sinks yet. You can leave this empty.</div>}
      <button type="button" className="qmb-grid-add" disabled={!editable||sinks.length>=100}
        onClick={addSink}>+ Add sink</button>
    </div>
    </>}
  </div>;
}
