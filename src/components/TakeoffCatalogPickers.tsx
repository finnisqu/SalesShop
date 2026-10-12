import { useEffect,useMemo,useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useSinkCatalogStore } from '../store/sinkCatalogStore';
import { createQuoteMaterialCostSnapshot } from '../services/quoteMaterialSnapshot';
import { createQuoteSinkSnapshot,sinkSnapshotDescription } from '../services/quoteSinkSnapshot';
import {
  defaultMaterialPurchaseOption,resolveStockMaterialCostReference,
  type StockMaterial,type MaterialVariant,type MaterialPurchaseOption,
} from '../types/settings';
import type { QuoteLineMaterialReference,QuoteTakeoffSink } from '../types/quote';
import { SINK_CATEGORY_LABELS,type SinkModel,type SinkVariant } from '../types/sink';

const labelMaterial=(material:StockMaterial,variant:MaterialVariant)=>
  [material.brand,material.name,variant.thickness,variant.finish].filter(Boolean).join(' · ');

/** Reads the exact shared Company Catalog source used by regular Quote Material rows. */
export function TakeoffMaterialCatalog({disabled,selected,onSelect}:{
  disabled:boolean;selected?:QuoteLineMaterialReference;
  onSelect:(reference:QuoteLineMaterialReference,label:string)=>void;
}){
  const materials=useCompanySettingsStore(s=>s.settings.stockMaterials);
  const hydrate=useCompanySettingsStore(s=>s.hydrate);
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [materialId,setMaterialId]=useState<string|null>(null);
  const [variantId,setVariantId]=useState<string|null>(null);
  useEffect(()=>{void hydrate();},[hydrate]);
  const active=useMemo(()=>materials.filter(m=>m.active),[materials]);
  const results=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return active.filter(m=>!q || [m.brand,m.name,m.supplier,m.materialType,m.collection,
      ...(m.variants??[]).flatMap(v=>[v.thickness,v.finish,v.sku])].filter(Boolean)
      .join(' ').toLowerCase().includes(q))
      .sort((a,b)=>Number(b.stockProgram)-Number(a.stockProgram)||a.name.localeCompare(b.name)).slice(0,30);
  },[active,search]);
  const material=active.find(m=>m.id===materialId);
  const variants=(material?.variants??[]).filter(v=>v.active!==false);
  const variant=variants.find(v=>v.id===variantId);
  const complete=(m:StockMaterial,v:MaterialVariant,option?:MaterialPurchaseOption)=>{
    const cost=resolveStockMaterialCostReference(m,v.id,option?.id);
    const ref:QuoteLineMaterialReference={
      materialId:m.id,variantId:v.id,purchaseOptionId:cost.purchaseOption?.id,
      stockProgram:m.stockProgram,pricingSource:'manual-line-rate',
      sourceCostPerSf:cost.costPerSf,catalogSlabCost:cost.slabCost,
      snapshot:createQuoteMaterialCostSnapshot(m,cost),
    };
    onSelect(ref,labelMaterial(m,v));setOpen(false);setSearch('');setMaterialId(null);setVariantId(null);
  };
  const chooseVariant=(m:StockMaterial,v:MaterialVariant)=>{
    const options=(v.purchaseOptions??[]).filter(o=>o.active!==false);
    if(options.length>1){setVariantId(v.id);return;}
    complete(m,v,defaultMaterialPurchaseOption(v));
  };
  return <div className="qtl-catalog-pick">
    <button type="button" className="qtl-catalog-trigger" disabled={disabled} aria-expanded={open}
      onClick={()=>{setOpen(o=>!o);setMaterialId(null);setVariantId(null);}}>
      ◇ {selected?.materialId?'Change catalog material':'Select from Materials Catalog'}
    </button>
    {open&&<div className="qtl-catalog-menu">
      {material ? <div className="qtl-catalog-choices">
        <button type="button" className="qtl-catalog-back" onClick={()=>{if(variant)setVariantId(null);else setMaterialId(null);}}>
          ← {variant?'Variants':'Materials'}
        </button>
        <strong>{material.brand} {material.name}</strong>
        {variant
          ? (variant.purchaseOptions??[]).filter(o=>o.active!==false).map(o=>
              <button type="button" key={o.id} onClick={()=>complete(material,variant,o)}>
                <strong>{o.label}</strong><small>{o.pricingBasis}</small>
              </button>)
          : variants.map(v=><button type="button" key={v.id} onClick={()=>chooseVariant(material,v)}>
              <strong>{[v.thickness,v.finish,v.formatName].filter(Boolean).join(' · ')||'Standard variant'}</strong>
              <small>{v.sku||'Choose variant'}</small>
            </button>)}
        {!variants.length&&<p>No active variants. Add one in Catalog first.</p>}
      </div>:<>
        <input autoFocus type="search" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search material, brand, color…" aria-label="Find catalog material"/>
        <div className="qtl-catalog-choices">
          {results.map(m=><button type="button" key={m.id}
            onClick={()=>setMaterialId(m.id)}><strong>{[m.brand,m.name].filter(Boolean).join(' ')}</strong>
            <small>{[m.materialType,m.supplier].filter(Boolean).join(' · ')}</small></button>)}
          {!results.length&&<p>No matching active catalog materials.</p>}
        </div>
      </>}
      <button type="button" className="qtl-catalog-back" onClick={()=>setOpen(false)}>Close catalog</button>
    </div>}
  </div>;
}

/** Uses the same active models, variants, and sell-price snapshot as QuoteSinkLineFields. */
export function TakeoffSinkCatalog({disabled,onSelect}:{
  disabled:boolean;onSelect:(patch:Partial<QuoteTakeoffSink>)=>void;
}){
  const models=useSinkCatalogStore(s=>s.models);
  const hydrate=useSinkCatalogStore(s=>s.hydrate);
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState('');
  useEffect(()=>{void hydrate();},[hydrate]);
  const results=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return models.filter(m=>m.active).flatMap(model=>
      model.variants.filter(variant=>variant.active).map(variant=>({model,variant})))
      .filter(({model,variant})=>!q||[
        model.brand,model.name,model.modelCode,model.category,model.supplier,
        variant.label,variant.code,variant.configuration,variant.ada?'ADA':'',
      ].filter(Boolean).join(' ').toLowerCase().includes(q))
      .sort((a,b)=>a.model.name.localeCompare(b.model.name)||a.variant.label.localeCompare(b.variant.label))
      .slice(0,40);
  },[models,search]);
  const choose=(model:SinkModel,variant:SinkVariant)=>{
    const snapshot=createQuoteSinkSnapshot(model,variant);
    onSelect({
      name:sinkSnapshotDescription(snapshot),
      category:model.category==='vanity'?'vanity':'kitchen',
      unitPrice:variant.sellPrice,
      sinkReference:{sinkModelId:model.id,variantId:variant.id,snapshot},
    });
    setOpen(false);setSearch('');
  };
  return <div className="qtl-catalog-pick">
    <button type="button" className="qtl-catalog-trigger" disabled={disabled} aria-expanded={open}
      onClick={()=>setOpen(o=>!o)}>◇ Choose from Sinks Catalog</button>
    {open&&<div className="qtl-catalog-menu">
      <input autoFocus type="search" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Model, bowl, ADA, brand…" aria-label="Find catalog sink"/>
      <div className="qtl-catalog-choices">
        {results.map(({model,variant})=><button type="button" key={variant.id}
          onClick={()=>choose(model,variant)}>
          <strong>{[model.brand,model.name,variant.label].filter(Boolean).join(' · ')}</strong>
          <small>{SINK_CATEGORY_LABELS[model.category]} · {variant.configuration}
            {variant.sellPrice!==undefined?` · Sell $ ${variant.sellPrice.toFixed(2)}`:' · Price not set'}</small>
        </button>)}
        {!results.length&&<p>No matching active catalog sink variants.</p>}
      </div>
      <button type="button" className="qtl-catalog-back" onClick={()=>setOpen(false)}>Close catalog</button>
    </div>}
  </div>;
}
