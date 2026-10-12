import { useEffect, useMemo, useState } from 'react';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { builderLevelRateReference, selectableBuilderLevels } from '../services/builderLevelRate';
import { materialLevelCostBand, resolveMaterialPricingRecommendation } from '../types/materialLevelGuide';
import type { QuoteLineRateReference } from '../types/quote';
import type { RateBookDivision } from '../types/rateBook';

export function BuilderLevelChoices({division,selectedRateId,onSelect,materialType,materialCostPerSf}:{
  division?:RateBookDivision;
  selectedRateId?:string;
  materialType?:string;
  materialCostPerSf?:number;
  onSelect:(rate:number,reference:QuoteLineRateReference)=>void;
}) {
  const guide=useMaterialLevelGuideStore(state=>state.guide);
  const hydrate=useMaterialLevelGuideStore(state=>state.hydrate);
  const levels=useMemo(()=>selectableBuilderLevels(guide.rules),[guide.rules]);
  const recommendation=materialCostPerSf!==undefined
    ?resolveMaterialPricingRecommendation(guide,materialCostPerSf,undefined,materialType)
    :undefined;
  useEffect(()=>{hydrate();},[hydrate]);

  return <div className="qmb-builder-levels">
    <div className="qmb-builder-levels-heading">
      <strong>Stock / Builder levels</strong>
      <small>Catalog → Rates → Material Pricing</small>
    </div>
    <div className="qmb-builder-cost-context" aria-label="Buying cost comparison">
      <div>
        <span>Material cost / SF</span>
        <strong>{materialCostPerSf!==undefined
          ?('$'+materialCostPerSf.toFixed(2)):'Not selected'}</strong>
      </div>
      {recommendation?.mode==='level'
        ?<small>Cost band suggests {recommendation.level.rule.label} · {'$'+recommendation.level.customerRate.toFixed(2)+'/SF'}</small>
        :recommendation?.mode==='slab-review'
          ?<small>Above Level guide · Check slab pricing</small>
          :<small>Choose a catalog material with a recorded cost for a level suggestion.</small>}
    </div>
    <div className="qmb-builder-level-grid" role="group" aria-label="Stock Builder pricing levels">
      {levels.map(rule=><button type="button" key={rule.id}
        disabled={Boolean(rule.graniteOnly&&materialType&&materialType.toLowerCase()!=='granite')}
        title={rule.graniteOnly?'Granite only':rule.label==='Level 1'?'First quartz level':undefined}
        className={'qmb-builder-level-choice'
          +(selectedRateId===rule.id?' is-active':'')
          +(recommendation?.mode==='level'&&recommendation.level.rule.id===rule.id?' is-suggested':'')}
        aria-pressed={selectedRateId===rule.id}
        onClick={()=>onSelect(rule.customerRate,builderLevelRateReference(guide,rule,division))}>
        <span>{rule.label}{recommendation?.mode==='level'&&recommendation.level.rule.id===rule.id?' ★':''}</span>
        <strong>{'$'+rule.customerRate.toFixed(2)+'/SF'}</strong>
        <small className="qmb-builder-cost">{materialLevelCostBand(guide.rules,rule)}</small>
      </button>)}
    </div>
    {!levels.length&&<p>No active builder levels. Configure Rates → Material Pricing.</p>}
  </div>;
}

export function BuilderLevelRateButton({division,selectedRateId,disabled,onSelect,materialType,materialCostPerSf}:{
  division?:RateBookDivision;
  selectedRateId?:string;
  disabled:boolean;
  materialType?:string;
  materialCostPerSf?:number;
  onSelect:(rate:number,reference:QuoteLineRateReference)=>void;
}){
  const [open,setOpen]=useState(false);
  return <div className="qmb-builder-rate-control">
    <button type="button" aria-expanded={open} disabled={disabled}
      onClick={()=>setOpen(value=>!value)} className="qmb-builder-rate-toggle">RATE ▾</button>
    {open&&<div className="qmb-builder-rate-menu">
      <BuilderLevelChoices division={division} selectedRateId={selectedRateId}
        materialType={materialType} materialCostPerSf={materialCostPerSf}
        onSelect={(rate,reference)=>{onSelect(rate,reference);setOpen(false);}}/>
    </div>}
  </div>;
}
