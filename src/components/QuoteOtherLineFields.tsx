import {useEffect,useMemo,useRef,useState} from 'react';
import type {QuoteLine} from '../types/quote';
import type {OtherCatalogItem,OtherCatalogVariant} from '../store/otherCatalogStore';
import {useOtherCatalogStore} from '../store/otherCatalogStore';
import {useQuoteStore} from '../store/quoteStore';
import {catalogSellingOverride} from '../services/quoteCatalogLineEditing';
import {compareQuoteOtherSnapshot,createQuoteOtherSnapshot} from '../services/quoteOtherSnapshot';
import {quoteOtherSourcePatch,quoteOtherCatalogPricePatch} from '../services/quoteOtherSelection';
import './quote-other-line-fields.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});

export function QuoteOtherLineFields({quoteId,line,disabled=false}:{
 quoteId:string;line:QuoteLine;disabled?:boolean;
}){
 const items=useOtherCatalogStore(s=>s.items);
 const hydrated=useOtherCatalogStore(s=>s.hydrated);
 const loadError=useOtherCatalogStore(s=>s.error);
 const hydrate=useOtherCatalogStore(s=>s.hydrate);
 const update=useQuoteStore(s=>s.updateLine);
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState('');
 const [error,setError]=useState('');
 const root=useRef<HTMLDivElement>(null);
 const input=useRef<HTMLInputElement>(null);
 const snapshot=line.otherReference?.snapshot;

 useEffect(()=>{void hydrate();},[hydrate]);
 useEffect(()=>{
  if(!open)return;
  input.current?.focus({preventScroll:true});
  const pointer=(event:PointerEvent)=>{
   if(root.current?.contains(event.target as Node))return;
   setOpen(false);setQuery('');setError('');
  };
  document.addEventListener('pointerdown',pointer);
  return()=>document.removeEventListener('pointerdown',pointer);
 },[open]);
 useEffect(()=>{
  const close=()=>{setOpen(false);setQuery('');setError('');};
  window.addEventListener('sales-shop:quote-collapse-all',close);
  return()=>window.removeEventListener('sales-shop:quote-collapse-all',close);
 },[]);

 const item=items.find(x=>x.id===line.otherReference?.itemId&&x.active);
 const variant=item?.variants.find(x=>x.id===line.otherReference?.variantId&&x.active);
 const current=item&&variant?createQuoteOtherSnapshot(item,variant):undefined;
 const comparison=snapshot&&current?compareQuoteOtherSnapshot(snapshot,current):undefined;
 const results=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  return items.filter(x=>x.active).flatMap(item=>item.variants.filter(v=>v.active)
   .map(variant=>({item,variant})))
   .filter(({item,variant})=>[item.name,item.brand,item.sku,item.category,
    variant.label,variant.sku,variant.material,variant.finish]
    .filter(Boolean).join(' ').toLowerCase().includes(needle))
   .sort((a,b)=>a.item.name.localeCompare(b.item.name)||
    a.variant.label.localeCompare(b.variant.label)).slice(0,24);
 },[items,query]);

 const change=(nextItem:OtherCatalogItem,nextVariant:OtherCatalogVariant)=>{
  if(disabled)return;
  try{
   update(quoteId,line.id,quoteOtherSourcePatch(line,nextItem,nextVariant));
   setOpen(false);setQuery('');setError('');
  }catch(cause){
   setError(cause instanceof Error?cause.message:'Unable to update Catalog selection.');
  }
 };
 const catalogPrice=()=>{
  if(disabled)return;
  try{update(quoteId,line.id,quoteOtherCatalogPricePatch(line));setError('');}
  catch(cause){setError(cause instanceof Error?cause.message:'Unable to apply Catalog price.');}
 };
 const expand=()=>{if(disabled)return;setOpen(o=>!o);setError('');setQuery('');};

 if(!snapshot)return null;
 return <div className="quote-other-source" ref={root} data-quote-other-source={line.id}>
  <div className="quote-other-source-main">
   <div className="quote-other-source-title">
    <strong>{[snapshot.brand,snapshot.itemName,snapshot.variantLabel].filter(Boolean).join(' · ')}</strong>
    <small>{snapshot.unit??'each'} · Private unit cost {snapshot.internalCost===undefined?'not recorded':money.format(snapshot.internalCost)}
     {' · '}Catalog sell {snapshot.sellPrice===undefined?'not set':money.format(snapshot.sellPrice)}</small>
   </div>
   <button type="button" className="quote-other-source-change" disabled={disabled}
    aria-expanded={open} aria-controls={'other-search-'+line.id}
    onClick={expand}>{open?'Close selector':'Change / refresh'}</button>
  </div>
  <div className="quote-other-source-status" aria-live="polite">
   {!hydrated&&<span>Checking Catalog source…</span>}
   {hydrated&&!variant&&<span className="is-warning">
    {loadError?'Catalog lookup unavailable':'Catalog source unavailable'} · quoted values retained
   </span>
   {comparison?.changed&&<span>Catalog updated · quote remains unchanged</span>}
   {catalogSellingOverride(line)&&<span>Manual selling price · quoted source retained</span>}
  </div>
  {open&&<div id={'other-search-'+line.id} className="quote-other-source-picker"
    role="group" aria-label="Change OTHER Catalog source">
   <p>Updating a source refreshes product details and private unit cost, but preserves the quoted selling price. Apply a new sell price separately.</p>
   {variant&&comparison?.changed&&<button type="button" className="quote-other-source-refresh"
    disabled={disabled} onClick={()=>change(item!,variant)}>
    Refresh this Catalog variant · keep quoted price
   </button>}
   <div className="quote-other-source-search">
    <input ref={input} type="search" value={query} maxLength={160}
     aria-label="Search OTHER Catalog variants" placeholder="Search item, SKU, finish…"
     onChange={event=>{setQuery(event.target.value);setError('');}}
     onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);}}}/>
   </div>
   <div className="quote-other-source-results">
    {results.map(({item:choice,variant:option})=>{
     const sameUnit=(choice.unit??'each')===(snapshot.unit??'each');
     return <button key={choice.id+':'+option.id} type="button"
      disabled={disabled||!sameUnit} onClick={()=>change(choice,option)}>
      <span><strong>{choice.name} · {option.label}</strong>
       <small>{choice.sku||option.sku||choice.category} · {choice.unit??'each'}</small></span>
      <span><strong>{option.sellPrice===undefined?'Unpriced':money.format(option.sellPrice)}</strong>
       <small>{sameUnit?'Keep quoted price':'Different unit · add as new charge'}</small></span>
     </button>;
    })}
    {!results.length&&<p>No active Catalog variants match.</p>}
   </div>
   {error&&<p role="alert" className="quote-other-source-error">{error}</p>}
  </div>}
  {line.pricingMode==='quantity-rate'&&snapshot.sellPrice!==undefined&&
   (catalogSellingOverride(line)||line.rate===undefined)&&
   <button type="button" className="quote-other-source-price" disabled={disabled}
    onClick={catalogPrice}>
    Use current Catalog sell price {money.format(snapshot.sellPrice)}
   </button>}
 </div>;
}
