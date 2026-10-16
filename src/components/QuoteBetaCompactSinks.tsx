import type {Quote,QuoteSection,QuoteTakeoffSink} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {SINK_CATEGORIES,SINK_CATEGORY_LABELS} from '../types/sink';
import {FAUCET_HOLE_OFFSETS_IN,newTakeoffSink} from '../services/quoteTakeoffsLite';
import {TakeoffSinkCatalog} from './TakeoffCatalogPickers';
import {FloatingRowMenu} from './QuoteBetaMeasureGrid';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});

/** Spreadsheet density with stable rows: model and Qty in Measure; the same
 * source rows gain editable selling prices in Materials. */
export function QuoteBetaCompactSinks({quote,section,editable,stage}:{
  quote:Quote;section:QuoteSection;editable:boolean;stage:'measure'|'materials';
}){
  const update=useQuoteStore(s=>s.updateTakeoffSinks);
  const sinks=section.scope?.takeoffSinks??[];
  const patch=(id:string,next:Partial<QuoteTakeoffSink>)=>
    update(quote.id,section.id,sinks.map(s=>s.id===id?{...s,...next}:s));
  return <div className={'qmb-compact-table qmb-compact-sinks is-'+stage}
    aria-label="Area sink table">
    <div className="qmb-compact-sink-columns" aria-hidden="true">
      <span>Type</span><span>Model</span><span>Qty</span>
      {stage==='materials'&&<span>Sell / each</span>}
      <span>Holes</span><span></span>
    </div>
    {sinks.map((sink,index)=><div className="qmb-compact-sink-row" key={sink.id}>
      <select aria-label={'Sink '+(index+1)+' type'} disabled={!editable} value={sink.category}
        onChange={e=>patch(sink.id,{category:e.target.value as QuoteTakeoffSink['category'],
          sinkReference:undefined})}>
        {SINK_CATEGORIES.map(category=><option key={category} value={category}>
          {SINK_CATEGORY_LABELS[category]}</option>)}
      </select>
      <div className="qmb-compact-sink-model">
        <TakeoffSinkCatalog disabled={!editable} value={sink.name}
          onTextChange={name=>patch(sink.id,{name,sinkReference:undefined})}
          onSelect={next=>patch(sink.id,next)}/>
      </div>
      <input type="number" min="1" max="1000" step="1" inputMode="numeric"
        aria-label={'Sink '+(index+1)+' quantity'} disabled={!editable} value={sink.count}
        onChange={e=>{const v=Number(e.target.value);
          if(Number.isInteger(v)&&v>=1&&v<=1000)patch(sink.id,{count:v});}}/>
      {stage==='materials'&&<div className="qmb-compact-sink-sell">
        <input type="number" min="0" step=".01" inputMode="decimal"
          aria-label={'Sink '+(index+1)+' sell price'} disabled={!editable}
          placeholder="Set price" value={sink.unitPrice??''}
          onChange={e=>{const n=e.target.value===''?undefined:Number(e.target.value);
            if(n===undefined||(Number.isFinite(n)&&n>=0))patch(sink.id,{unitPrice:n});}}/>
        <small>{sink.unitPrice!==undefined?money.format(sink.count*sink.unitPrice):'Unpriced'}</small>
      </div>}
      <FloatingRowMenu width={290} label={'Faucet holes for Sink '+(index+1)}
        caption={String((sink.faucetHoleOffsetsIn??[0]).length)+' holes'}>
        {close=><div className="qmb-holes-menu">
          <div className="qmb-row-menu-title"><strong>Faucet holes</strong>
            <small>Toggle positions. Saves on the same sink.</small></div>
          <div className="qmb-hole-positions" role="group" aria-label={'Sink '+(index+1)+' faucet hole spread'}>
            {FAUCET_HOLE_OFFSETS_IN.map(offset=><label key={offset}>
              <input type="checkbox" checked={(sink.faucetHoleOffsetsIn??[0]).includes(offset)}
                disabled={!editable}
                aria-label={offset===0?'Center hole':offset<0?Math.abs(offset)+' inches left':offset+' inches right'}
                onChange={e=>{
                  const current=sink.faucetHoleOffsetsIn??[0];
                  patch(sink.id,{faucetHoleOffsetsIn:e.target.checked
                    ?[...new Set([...current,offset])].sort((a,b)=>a-b)
                    :current.filter(v=>v!==offset)});
                }}/>
              <small>{offset===0?'C':offset>0?'+'+offset:String(offset)}</small>
            </label>)}
          </div>
          <div className="qmb-row-menu-buttons"><button type="button" onClick={close}>Done</button></div>
        </div>}
      </FloatingRowMenu>
      <button type="button" className="qmb-compact-remove" disabled={!editable}
        aria-label={'Remove sink '+(index+1)} title="Remove sink"
        onClick={()=>update(quote.id,section.id,sinks.filter(s=>s.id!==sink.id))}>×</button>
    </div>)}
    {!sinks.length&&<p className="qmb-grid-empty">No sinks yet.</p>}
    <button type="button" className="qmb-grid-add" disabled={!editable||sinks.length>=100}
      onClick={()=>update(quote.id,section.id,[...sinks,newTakeoffSink()])}>+ Add sink</button>
  </div>;
}
