import { useEffect,useMemo,useState } from 'react';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { builderLevelRateReference, selectableBuilderLevels } from '../services/builderLevelRate';
import type { QuoteLineRateReference } from '../types/quote';
import type { RateBookDivision } from '../types/rateBook';

export function BuilderLevelChoices({division,selectedRateId,onSelect}:{
  division?:RateBookDivision;selectedRateId?:string;
  onSelect:(rate:number,reference:QuoteLineRateReference)=>void;
}){
  const guide=useMaterialLevelGuideStore(s=>s.guide);
  const hydrate=useMaterialLevelGuideStore(s=>s.hydrate);
  const levels=useMemo(()=>selectableBuilderLevels(guide.rules),[guide.rules]);
  useEffect(()=>{hydrate();},[hydrate]);
  return <div className="qmb-builder-levels">
    <div className="qmb-builder-levels-heading"><strong>Stock / Builder levels</strong>
      <small>Editable under Rates → Materials</small></div>
    <div className="qmb-builder-level-grid" role="group" aria-label="Stock Builder pricing levels">
      {levels.map(rule=><button type="button" key={rule.id}
        className={'qmb-builder-level-choice'+(selectedRateId===rule.id?' is-active':'')}
        aria-pressed={selectedRateId===rule.id}
        onClick={()=>onSelect(rule.customerRate,builderLevelRateReference(guide,rule,division))}>
        <span>{rule.label}</span><strong>{'$'+rule.customerRate.toFixed(2)}/SF</strong>
      </button>)}
    </div>
    {!levels.length&&<p>No active builder levels. Set rates under Rates → Materials.</p>}
  </div>;
}

/** Smaller line-item RATE control; uses exactly the same guide as the SF takeoff picker. */
export function BuilderLevelRateButton({division,selectedRateId,disabled,onSelect}:{
  division?:RateBookDivision;selectedRateId?:string;disabled:boolean;
  onSelect:(rate:number,reference:QuoteLineRateReference)=>void;
}){
  const [open,setOpen]=useState(false);
  return <div className="qmb-builder-rate-control">
    <button type="button" aria-expanded={open} disabled={disabled}
      onClick={()=>setOpen(v=>!v)} className="qmb-builder-rate-toggle">RATE ▾</button>
    {open&&<div className="qmb-builder-rate-menu">
      <BuilderLevelChoices division={division} selectedRateId={selectedRateId}
        onSelect={(rate,reference)=>{onSelect(rate,reference);setOpen(false);}}/>
    </div>}
  </div>;
}
