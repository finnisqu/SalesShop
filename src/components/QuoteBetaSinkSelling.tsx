import type {Quote,QuoteSection,QuoteTakeoffSink} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {takeoffSinkIncludedInQuote,quoteTakeoffSinkChargeConfirmation} from '../services/quoteTakeoffsLite';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
/** The right half of each desktop Sink row, wired to the same takeoff source as
 * the left-hand Type / Model / faucet-hole fields. */
export function QuoteBetaSinkSelling({quote,section,editable,view='selling'}:{
  quote:Quote;section:QuoteSection;editable:boolean;view?:'selling'|'cost';
}){
  const update=useQuoteStore(s=>s.updateTakeoffSinks);
  const setCharge=useQuoteStore(s=>s.setTakeoffSinkCharge);
  const sinks=section.scope?.takeoffSinks??[];
  const patch=(id:string,change:Partial<QuoteTakeoffSink>)=>
    update(quote.id,section.id,sinks.map(s=>s.id===id?{...s,...change}:s));
  return <div className={'qmb-sink-selling-sheet qmb-sink-selling-'+view} aria-label={view==='cost'?'Sink buying costs':'Sink quantities and selling prices'}>
    <div className="qmb-grid-toolbar"><div>
      <strong>{view==='cost'?'Sink buying costs':'Sink pricing'}</strong>
      <small>{view==='cost'?'Source costs and margin inputs':'Customer selling prices'}</small>
    </div></div>
    <div className="qmb-sink-selling-rows">
      {sinks.map((sink,index)=>{
        const sourceCost=sink.internalCostOverride??sink.sinkReference?.snapshot?.internalCost;
        const included=takeoffSinkIncludedInQuote(quote,section.id,sink.id);
        const total=!included?undefined:sink.unitPrice===undefined?undefined:sink.count*sink.unitPrice;
        return <div className="qmb-sink-selling-row" key={sink.id}>
          <div className="qmb-sink-sell-main">
            <label>Qty<input type="number" min="1" max="1000" step="1"
              aria-label={'Sink '+(index+1)+' quantity'} value={sink.count} disabled={!editable}
              onChange={e=>{const v=Number(e.target.value);
                if(Number.isInteger(v)&&v>=1&&v<=1000)patch(sink.id,{count:v});}}/></label>
            <label>Sell / each<div className="qmb-currency-field"><span aria-hidden="true">$</span>
              <input aria-label={'Sink '+(index+1)+' sell price'} type="number" min="0" step=".01"
                value={sink.unitPrice??''} placeholder="Not priced" disabled={!editable||!included}
                onChange={e=>{const raw=e.target.value;const n=raw===''?undefined:Number(raw);
                  if(n===undefined||(Number.isFinite(n)&&n>=0))patch(sink.id,{unitPrice:n});}}/>
            </div></label>
          </div>
          <label className="qmb-sink-inclusion">
            <input type="checkbox" disabled={!editable} checked={included}
              aria-label={'Include sink '+(index+1)+' in quote total'}
              onChange={event=>{
                const include=event.target.checked;
                if(window.confirm(quoteTakeoffSinkChargeConfirmation(quote,section.id,sink.id,include)))
                  setCharge(quote.id,section.id,sink.id,include);
              }}/>
            <span>{included?'Included in quote':'Specification only · not charged'}</span>
          </label>
          <p className="qmb-sink-selling-total">{!included?'Specification only · not charged':total===undefined?'Selling price missing':
            sink.count+' × '+money.format(sink.unitPrice!)+' = '+money.format(total)}</p>
          {view==='cost'?<div className="qmb-sink-cost-editor">
            <label>Buying cost / each<div className="qmb-currency-field"><span aria-hidden="true">$</span>
              <input aria-label={'Sink '+(index+1)+' buying cost'} type="number" min="0" step=".01"
                value={sink.internalCostOverride??''} placeholder={sink.sinkReference?.snapshot?.internalCost?.toFixed(2)??'Unknown'}
                disabled={!editable}
                onChange={e=>{const n=e.target.value===''?undefined:Number(e.target.value);
                  if(n===undefined||(Number.isFinite(n)&&n>=0))patch(sink.id,{internalCostOverride:n});}}/>
            </div></label>
            <strong>{sourceCost!==undefined?money.format(sourceCost*sink.count):'Buying cost missing'}</strong>
          </div>:<small className="qmb-sink-selling-cost">
            Buying cost {sourceCost!==undefined?money.format(sourceCost*sink.count):'not set'}
          </small>}
        </div>;
      })}
      {!sinks.length&&<div className="qmb-grid-empty">Add a sink on the left to set its selling price.</div>}
    </div>
  </div>;
}
