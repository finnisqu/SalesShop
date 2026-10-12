import { useEffect,useMemo,useRef,useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useSinkCatalogStore } from '../store/sinkCatalogStore';
import { createQuoteMaterialCostSnapshot } from '../services/quoteMaterialSnapshot';
import { createQuoteSinkSnapshot,sinkSnapshotDescription } from '../services/quoteSinkSnapshot';
import {
  defaultMaterialPurchaseOption,resolveStockMaterialCostReference,
  type StockMaterial,type MaterialVariant,type MaterialPurchaseOption,
} from '../types/settings';
import type { QuoteLineMaterialReference,QuoteProjectMaterial,QuoteTakeoffSink } from '../types/quote';
import { SINK_CATEGORY_LABELS,type SinkModel,type SinkVariant } from '../types/sink';
const materialLabel=(m:StockMaterial,v:MaterialVariant)=>
  [m.brand,m.name,v.thickness,v.finish].filter(Boolean).join(' · ');

export function TakeoffMaterialCatalog({disabled,value,selected,pinned,onSelect,onTextChange}:{
  disabled:boolean;value:string;selected?:QuoteLineMaterialReference;pinned:QuoteProjectMaterial[];
  onSelect:(ref:QuoteLineMaterialReference,label:string)=>void;
  onTextChange:(text:string)=>void;
}){
  const materials=useCompanySettingsStore(s=>s.settings.stockMaterials);
  const hydrate=useCompanySettingsStore(s=>s.hydrate);
  const root=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);
  const [searchTerm,setSearchTerm]=useState('');
  const [materialId,setMaterialId]=useState<string|null>(null);
  const [variantId,setVariantId]=useState<string|null>(null);
  useEffect(()=>{void hydrate();},[hydrate]);
  useEffect(()=>{if(!open)return;
    const dismiss=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)){setOpen(false);setMaterialId(null);setVariantId(null);}};
    document.addEventListener('pointerdown',dismiss);
    return()=>document.removeEventListener('pointerdown',dismiss);
  },[open]);
  const active=useMemo(()=>materials.filter(m=>m.active),[materials]);
  const query=searchTerm.trim().toLowerCase();
  const ordered=useMemo(()=>{
    const pinnedIds=new Set(pinned.map(m=>m.reference?.materialId).filter(Boolean));
    return active.filter(m=>!query||[
      m.brand,m.name,m.supplier,m.materialType,m.collection,
      ...(m.variants??[]).flatMap(v=>[v.thickness,v.finish,v.sku]),
    ].filter(Boolean).join(' ').toLowerCase().includes(query))
      .sort((a,b)=>Number(pinnedIds.has(b.id))-Number(pinnedIds.has(a.id))
        ||Number(b.stockProgram)-Number(a.stockProgram)||a.name.localeCompare(b.name)).slice(0,35);
  },[active,pinned,query]);
  const material=active.find(m=>m.id===materialId);
  const variants=(material?.variants??[]).filter(v=>v.active!==false);
  const variant=variants.find(v=>v.id===variantId);
  const complete=(m:StockMaterial,v:MaterialVariant,o?:MaterialPurchaseOption)=>{
    const resolved=resolveStockMaterialCostReference(m,v.id,o?.id);
    onSelect({
      materialId:m.id,variantId:v.id,purchaseOptionId:resolved.purchaseOption?.id,
      stockProgram:m.stockProgram,pricingSource:'manual-line-rate',
      sourceCostPerSf:resolved.costPerSf,catalogSlabCost:resolved.slabCost,
      snapshot:createQuoteMaterialCostSnapshot(m,resolved),
    },materialLabel(m,v));
    setOpen(false);setMaterialId(null);setVariantId(null);
  };
  return <div className="qtl-combobox" ref={root}>
    <input type="text" role="combobox" aria-expanded={open} aria-controls="qtl-material-choices"
      autoComplete="off" disabled={disabled} value={value} maxLength={300}
      placeholder="Search catalog colors or type a custom material…"
      aria-label="Material: type to search Catalog" onFocus={e=>{e.currentTarget.select();setSearchTerm('');setOpen(true);}}
      onChange={e=>{onTextChange(e.target.value);setSearchTerm(e.target.value);setMaterialId(null);setVariantId(null);setOpen(true);}}/>
    {open&&<div className="qtl-combobox-menu" id="qtl-material-choices" role="listbox">
      {material?<div className="qtl-combobox-results">
        <button type="button" onClick={()=>{if(variant)setVariantId(null);else setMaterialId(null);}}>← Back to {variant?'variants':'materials'}</button>
        <strong className="qtl-step-title">{[material.brand,material.name].filter(Boolean).join(' ')}</strong>
        {variant?(variant.purchaseOptions??[]).filter(o=>o.active!==false).map(o=>
          <button key={o.id} type="button" onClick={()=>complete(material,variant,o)}>{o.label}<small>{o.pricingBasis}</small></button>)
          :variants.map(v=><button key={v.id} type="button" onClick={()=>{
            const options=(v.purchaseOptions??[]).filter(o=>o.active!==false);
            if(options.length>1)setVariantId(v.id);else complete(material,v,defaultMaterialPurchaseOption(v));
          }}>{[v.thickness,v.finish,v.formatName].filter(Boolean).join(' · ')||'Standard variant'}
          <small>{v.sku||'Choose variant'}</small></button>)}
        {!variants.length&&<p>No active variants available.</p>}
      </div>:<div className="qtl-combobox-results">
        {pinned.filter(p=>!p.reference?.materialId && (!query||p.label.toLowerCase().includes(query))).map(p=>
          <button type="button" key={p.id} onClick={()=>{onTextChange(p.label);setOpen(false);}}>
            <strong>★ {p.label}</strong><small>Project material · Custom</small>
          </button>)}
        {ordered.map(m=><button type="button" key={m.id} onClick={()=>{
          setMaterialId(m.id);setVariantId(null);
        }}><strong>{pinned.some(p=>p.reference?.materialId===m.id)?'★ ':''}{[m.brand,m.name].filter(Boolean).join(' ')}</strong>
          <small>{[m.materialType,m.supplier].filter(Boolean).join(' · ')}</small></button>)}
        {!ordered.length&&<p>No matching Catalog items. Custom names are allowed.</p>}
        {value.trim()&&<button type="button" onClick={()=>setOpen(false)}>
          Use custom material “{value.trim()}”</button>}
      </div>}
    </div>}
    {selected?.materialId&&<small className="qtl-catalog-selected">✓ Linked to Materials Catalog</small>}
  </div>;
}

export function TakeoffSinkCatalog({disabled,value,onSelect,onTextChange}:{
  disabled:boolean;value:string;onSelect:(patch:Partial<QuoteTakeoffSink>)=>void;
  onTextChange:(value:string)=>void;
}){
  const models=useSinkCatalogStore(s=>s.models);
  const hydrate=useSinkCatalogStore(s=>s.hydrate);
  const root=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);
  const [searchTerm,setSearchTerm]=useState('');
  useEffect(()=>{void hydrate();},[hydrate]);
  useEffect(()=>{if(!open)return;
    const dismiss=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',dismiss);
    return()=>document.removeEventListener('pointerdown',dismiss);
  },[open]);
  const results=useMemo(()=>{
    const query=searchTerm.trim().toLowerCase();
    return models.filter(m=>m.active).flatMap(model=>
      model.variants.filter(variant=>variant.active).map(variant=>({model,variant})))
      .filter(({model,variant})=>!query||[
        model.brand,model.name,model.modelCode,model.category,model.supplier,
        variant.label,variant.code,variant.configuration,variant.ada?'ADA':'',
      ].filter(Boolean).join(' ').toLowerCase().includes(query))
      .sort((a,b)=>a.model.name.localeCompare(b.model.name)||a.variant.label.localeCompare(b.variant.label))
      .slice(0,40);
  },[models,searchTerm]);
  const choose=(model:SinkModel,variant:SinkVariant)=>{
    const snapshot=createQuoteSinkSnapshot(model,variant);
    onSelect({name:sinkSnapshotDescription(snapshot),category:model.category,
      unitPrice:variant.sellPrice,
      sinkReference:{sinkModelId:model.id,variantId:variant.id,snapshot}});
    setOpen(false);
  };
  return <div className="qtl-combobox" ref={root}>
    <input type="text" role="combobox" aria-expanded={open} aria-controls="qtl-sink-choices"
      autoComplete="off" disabled={disabled} value={value} maxLength={160}
      placeholder="Search sink catalog…" aria-label="Sink model: type to search Catalog"
      onFocus={e=>{e.currentTarget.select();setSearchTerm('');setOpen(true);}}
      onChange={e=>{onTextChange(e.target.value);setSearchTerm(e.target.value);setOpen(true);}}/>
    {open&&<div className="qtl-combobox-menu" id="qtl-sink-choices" role="listbox">
      <div className="qtl-combobox-results">
        {results.map(({model,variant})=><button key={variant.id} type="button"
          onClick={()=>choose(model,variant)}>
          <strong>{[model.brand,model.name,variant.label].filter(Boolean).join(' · ')}</strong>
          <small>{SINK_CATEGORY_LABELS[model.category]} · {variant.configuration}
          {variant.sellPrice!==undefined?` · Sell $${variant.sellPrice.toFixed(2)}`:' · Unpriced'}</small>
        </button>)}
        {!results.length&&<p>No matching active catalog sinks. Custom names are allowed.</p>}
        {value.trim()&&<button type="button" onClick={()=>setOpen(false)}>
          Use custom sink “{value.trim()}”</button>}
      </div>
    </div>}
  </div>;
}
