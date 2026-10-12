import { useEffect,useMemo,useState } from 'react';
import { useRateBookStore } from '../store/rateBookStore';
import { createQuoteRateSnapshot } from '../services/quoteRateSnapshot';
import type { QuoteLineRateReference,Quote } from '../types/quote';

export function TakeoffRatePicker({quote,rate,disabled,onSelect}:{
  quote:Quote;rate?:number;disabled:boolean;
  onSelect:(rate:number|undefined,ref?:QuoteLineRateReference)=>void;
}){
  const items=useRateBookStore(s=>s.items);
  const hydrate=useRateBookStore(s=>s.hydrate);
  const [open,setOpen]=useState(false);
  useEffect(()=>{hydrate();},[hydrate]);
  const choices=useMemo(()=>items.filter(i=>i.active&&i.unit==='sf').map(item=>({
    item,snapshot:createQuoteRateSnapshot(item,quote.pricingDivision),
  })).filter(x=>x.snapshot.pricingBehavior!=='cost-reference'),[items,quote.pricingDivision]);
  return <div className="qtl-rate-box">
    <label className="qtl-rate-input"><span>Selling price per SF</span>
      <div><strong>$</strong><input aria-label="Takeoff selling rate per square foot"
        type="number" inputMode="decimal" min="0" step=".01" disabled={disabled}
        value={rate??''} placeholder="Enter price / SF"
        onChange={e=>{
          const raw=e.target.value;
          if(raw==='')onSelect(undefined);
          else{const n=Number(raw);if(Number.isFinite(n)&&n>=0)onSelect(n);}
        }}/></div></label>
    <div className="qtl-rate-suggestions">
      <button type="button" disabled={disabled} aria-expanded={open}
        onClick={()=>setOpen(v=>!v)}>Choose from Rates ▾</button>
      {open&&<div className="qtl-rate-options">
        {choices.map(({item,snapshot})=><button type="button" key={item.id}
          onClick={()=>{onSelect(snapshot.sellRate,{rateBookItemId:item.id,snapshot});setOpen(false);}}>
          <strong>{item.name}</strong>
          <small>{snapshot.sellRate===undefined?'Enter rate manually':`$${snapshot.sellRate.toFixed(2)}/SF`}</small>
        </button>)}
        {!choices.length&&<p>No active SF selling rates yet. Enter one manually.</p>}
      </div>}
    </div>
  </div>;
}
