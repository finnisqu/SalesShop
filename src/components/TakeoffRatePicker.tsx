import { useState } from 'react';
import type { QuoteLineRateReference,Quote } from '../types/quote';
import { QuoteSfRateChoices } from './QuoteSfRateChoices';

export function TakeoffRatePicker({quote,rate,disabled,onSelect,selectedRateId,materialType,materialCostPerSf}:{
  quote:Quote;rate?:number;disabled:boolean;
  onSelect:(rate:number|undefined,ref?:QuoteLineRateReference)=>void;
  selectedRateId?:string;materialType?:string;materialCostPerSf?:number;
}){
  const [open,setOpen]=useState(false);
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
        <QuoteSfRateChoices division={quote.pricingDivision}
          selectedRateId={selectedRateId} materialType={materialType}
          materialCostPerSf={materialCostPerSf}
          onSelect={(price,ref)=>{onSelect(price,ref);setOpen(false);}}/>
      </div>}
    </div>
  </div>;
}
