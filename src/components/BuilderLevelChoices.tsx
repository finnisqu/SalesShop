import { useEffect, useMemo, useState } from 'react';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { builderLevelRateReference, selectableBuilderLevels } from '../services/builderLevelRate';
import { materialLevelCostBand } from '../types/materialLevelGuide';
import type { QuoteLineRateReference } from '../types/quote';
import type { RateBookDivision } from '../types/rateBook';

export function BuilderLevelChoices({division,selectedRateId,onSelect,materialType}:{
  division?: RateBookDivision;
  selectedRateId?: string;
  materialType?: string;
  onSelect:(rate:number,reference:QuoteLineRateReference)=>void;
}) {
  const guide=useMaterialLevelGuideStore(state=>state.guide);
  const hydrate=useMaterialLevelGuideStore(state=>state.hydrate);
  const levels=useMemo(()=>selectableBuilderLevels(guide.rules),[guide.rules]);
  useEffect(()=>{hydrate();},[hydrate]);
  return (
    <div className="qmb-builder-levels">
      <div className="qmb-builder-levels-heading">
        <strong>Stock / Builder levels</strong>
        <small>Catalog → Rates → Material Pricing</small>
      </div>
      <div className="qmb-builder-level-grid" role="group" aria-label="Stock Builder pricing levels">
        {levels.map(rule=><button type="button" key={rule.id}
          disabled={Boolean(rule.graniteOnly && materialType && materialType.toLowerCase()!=='granite')}
          title={rule.graniteOnly?'Granite only':rule.label==='Level 1'?'First quartz level':undefined}
          className={'qmb-builder-level-choice'+(selectedRateId===rule.id?' is-active':'')}
          aria-pressed={selectedRateId===rule.id}
          onClick={()=>onSelect(rule.customerRate,builderLevelRateReference(guide,rule,division))}>
          <span>{rule.label}</span>
          <strong>{'$'+rule.customerRate.toFixed(2)+'/SF'}</strong>
          <small className="qmb-builder-cost">{materialLevelCostBand(guide.rules,rule)}</small>
        </button>)}
      </div>
      {!levels.length&&<p>No active builder levels. Configure Rates → Material Pricing.</p>}
    </div>
  );
}

export function BuilderLevelRateButton({division,selectedRateId,disabled,onSelect,materialType}:{
  division?:RateBookDivision;
  selectedRateId?:string;
  disabled:boolean;
  materialType?:string;
  onSelect:(rate:number,reference:QuoteLineRateReference)=>void;
}){
  const [open,setOpen]=useState(false);
  return <div className="qmb-builder-rate-control">
    <button type="button" aria-expanded={open} disabled={disabled}
      onClick={()=>setOpen(value=>!value)} className="qmb-builder-rate-toggle">RATE ▾</button>
    {open&&<div className="qmb-builder-rate-menu">
      <BuilderLevelChoices division={division} selectedRateId={selectedRateId} materialType={materialType}
        onSelect={(rate,reference)=>{onSelect(rate,reference);setOpen(false);}}/>
    </div>}
  </div>;
}
