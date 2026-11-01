import { useState } from 'react';
import type { QuoteLineRateReference,Quote } from '../types/quote';
import { QuoteSfRateChoices } from './QuoteSfRateChoices';

export function TakeoffRatePicker({quote,rate,disabled,onSelect,selectedRateId,materialType,materialCostPerSf}:{
  quote:Quote;rate?:number;disabled:boolean;
  onSelect:(rate:number|undefined,ref?:QuoteLineRateReference)=>void;
  selectedRateId?:string;materialType?:string;materialCostPerSf?:number;
}){
  const [open,setOpen]=useState(false);
  return <div className="qtl-rate-box qmb-rate-entry">
    <div className="qmb-rate-entry-heading"><strong>Customer selling rate</strong>
      <small>{rate===undefined?'Not priced yet':selectedRateId?'Rate Book selection':'Custom rate'}</small></div>
    <label className="qtl-rate-input"><span>Price / SF</span>
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
        aria-label="Choose a selling rate from Rate Book"
        onClick={()=>setOpen(v=>!v)}>{open?'Close Rate Book':'Choose from Rate Book'} <span aria-hidden="true">{open?'⌃':'⌄'}</span></button>
      {open&&<div className="qtl-rate-options">
        <QuoteSfRateChoices division={quote.pricingDivision}
          selectedRateId={selectedRateId} materialType={materialType}
          materialCostPerSf={materialCostPerSf}
          onSelect={(price,ref)=>{onSelect(price,ref);setOpen(false);}}/>
      </div>}
    </div>
  </div>;
}
