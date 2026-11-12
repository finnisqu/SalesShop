import {Fragment,useEffect,useMemo,useState} from 'react';
import {useOtherCatalogStore,type OtherCatalogItem,type OtherCatalogVariant} from '../store/otherCatalogStore';
import {scopedStorageKey} from '../lib/developerPlayground';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import '../catalog-product-worktable.css';
import {CatalogPagination,useCatalogPagination} from './CatalogPagination';

const PIN_KEY=scopedStorageKey('salesshop-catalog-other-pins-v1');
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const parseNumber=(raw:string)=>raw===''?undefined:Number(raw);
const colors=(raw:string)=>raw.split(',').map(s=>s.trim()).filter(Boolean);
const readPins=()=>{
 try{const raw=JSON.parse(localStorage.getItem(PIN_KEY)??'[]');
  return Array.isArray(raw)?raw.filter((x):x is string=>typeof x==='string'):[];
 }catch{return [] as string[];}
};
const Text=({label,value,change}:{
 label:string;value?:string;change:(value:string)=>void;
})=><label className="catalog-product-property"><span>{label}</span>
 <input value={value??''} onChange={event=>change(event.target.value)}/></label>;
const Price=({label,value,change}:{
 label:string;value?:number;change:(value:number|undefined)=>void;
})=><label className="catalog-product-property"><span>{label}</span>
 <input type="number" min="0" step="0.01" value={value??''} inputMode="decimal"
  onChange={event=>change(parseNumber(event.target.value))}/></label>;

export function CatalogOtherWorktable({externalQuery=''}:{externalQuery?:string}){
 const items=useOtherCatalogStore(s=>s.items),hydrate=useOtherCatalogStore(s=>s.hydrate);
 const hydrated=useOtherCatalogStore(s=>s.hydrated);
 const saving=useOtherCatalogStore(s=>s.saving),error=useOtherCatalogStore(s=>s.error);
 const addItem=useOtherCatalogStore(s=>s.addItem),updateItem=useOtherCatalogStore(s=>s.updateItem);
 const addVariant=useOtherCatalogStore(s=>s.addVariant),updateVariant=useOtherCatalogStore(s=>s.updateVariant);
 const duplicateVariant=useOtherCatalogStore(s=>s.duplicateVariant);
 const removeVariant=useOtherCatalogStore(s=>s.removeVariant);
 const authMode=useAuthStore(state=>state.mode);
 const role=useAuthStore(state=>state.teamRole);
 const previewRole=useRolePerspectiveStore(state=>state.activePerspective);
 const canEdit=!previewRole&&(authMode==='local'||role==='owner'||role==='admin');
 const [editing,setEditing]=useState(false),[expanded,setExpanded]=useState<string|null>(null);
 const [query,setQuery]=useState(''),[category,setCategory]=useState('all');
 const [showInactive,setShowInactive]=useState(false);
 const [sort,setSort]=useState<'name'|'category'|'brand'>('category');
 const [pins,setPins]=useState<string[]>(readPins);
 useEffect(()=>{void hydrate();},[hydrate]);
 useEffect(()=>{try{localStorage.setItem(PIN_KEY,JSON.stringify(pins));}catch{/* best effort */}},[pins]);
 useEffect(()=>{
  const create=()=>{if(!canEdit)return;const id=addItem();setEditing(true);setExpanded(id);};
  window.addEventListener('sales-shop:catalog-create',create);
  return()=>window.removeEventListener('sales-shop:catalog-create',create);
 },[addItem,canEdit]);
 const categories=useMemo(()=>[...new Set(items.map(item=>item.category))].sort(),[items]);
 const filtered=useMemo(()=>{
  const needle=[query,externalQuery].filter(Boolean).join(' ').toLowerCase().trim();
  return items.filter(item=>(showInactive||item.active)&&
    (category==='all'||item.category===category)&&
    (!needle||[item.name,item.category,item.sku,item.brand,item.supplier,item.unit,item.notes,
     ...item.variants.flatMap(v=>[v.label,v.sku,v.specification,v.material,v.finish,v.notes,
     ...(v.availableColors??[])])].join(' ').toLowerCase().includes(needle)))
   .sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):
    sort==='brand'?(a.brand??'').localeCompare(b.brand??'')||a.name.localeCompare(b.name):
    a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
 },[items,category,query,externalQuery,showInactive,sort]);
 const pagination=useCatalogPagination(filtered.length,
  JSON.stringify([query,externalQuery,category,showInactive,sort]));
 const pagedItems=filtered.slice(pagination.start,pagination.end);
 // After creating a record, navigate to its page in the sorted catalog.
 useEffect(()=>{
  if(!expanded)return;
  const index=filtered.findIndex(row=>row.id===expanded);
  if(index>=0)pagination.setPage(Math.floor(index/pagination.pageSize)+1);
 },[expanded,filtered,pagination.pageSize]);

 const selectedPins=useMemo(()=>pins.flatMap(key=>{
  const [itemId,variantId]=key.split(':');
  const item=items.find(value=>value.id===itemId);
  const variant=item?.variants.find(value=>value.id===variantId);
  return item&&variant?[{item,variant,key}]:[];
 }),[pins,items]);
 const pin=(itemId:string,variantId:string)=>{
  const key=itemId+':'+variantId;setPins(old=>old.includes(key)?old.filter(x=>x!==key):[...old,key]);
 };
 const shift=(key:string,direction:-1|1)=>{
  setPins(old=>{
   const a=old.indexOf(key),b=a+direction;
   if(a<0||b<0||b>=old.length)return old;
   const copy=[...old];[copy[a],copy[b]]=[copy[b],copy[a]];return copy;
  });
 };
 const update=(item:OtherCatalogItem,field:keyof OtherCatalogItem,value:unknown)=>
  updateItem(item.id,{[field]:value});
 const updateV=(item:OtherCatalogItem,variant:OtherCatalogVariant,field:keyof OtherCatalogVariant,value:unknown)=>
  updateVariant(item.id,variant.id,{[field]:value});
 if(!hydrated)return <section className="catalog-product-worktable" role="status">Loading Other catalog…</section>;
 return <section className="catalog-product-worktable catalog-other-worktable">
  {!!selectedPins.length&&<section className="materials-comparison-board has-pins catalog-product-pin-board"
   aria-label="Pinned other catalog comparison">
   <header><div><span className="board-eyebrow">Comparison board</span>
    <strong>{selectedPins.length} pinned item variant{selectedPins.length===1?'':'s'}</strong>
    <small>Compare specifications, costs and customer prices across items.</small></div>
    <button type="button" onClick={()=>setPins([])}>Clear all</button></header>
   <div className="materials-comparison-strip">
    {selectedPins.map(({item,variant,key},index)=><article key={key}
     className="materials-comparison-card" draggable
     onDragStart={event=>event.dataTransfer.setData('text/plain',key)}
     onDragOver={event=>event.preventDefault()}
     onDrop={event=>{
      event.preventDefault();const source=event.dataTransfer.getData('text/plain');
      if(source===key)return;
      setPins(old=>{
       if(!old.includes(source))return old;
       const next=old.filter(x=>x!==source);next.splice(next.indexOf(key),0,source);return next;
      });
     }}>
     <div className="catalog-product-pin-actions">
      <button type="button" disabled={index===0} onClick={()=>shift(key,-1)}
        aria-label={'Move '+item.name+' left'}>←</button>
      <button type="button" disabled={index===selectedPins.length-1} onClick={()=>shift(key,1)}
        aria-label={'Move '+item.name+' right'}>→</button>
      <button type="button" onClick={()=>pin(item.id,variant.id)}
        aria-label={'Unpin '+item.name+' '+variant.label}>×</button>
     </div>
     <span>{item.category} · {item.brand||item.supplier||'Unbranded'}</span>
     <strong>{item.name}</strong><b>{variant.label}</b>
     <dl><div><dt>Specification</dt><dd>{variant.specification||'—'}</dd></div>
      <div><dt>Material / finish</dt><dd>{[variant.material,variant.finish].filter(Boolean).join(' · ')||'—'}</dd></div>
      <div><dt>Cost</dt><dd>{variant.internalCost===undefined?'—':money.format(variant.internalCost)}</dd></div>
      <div><dt>Customer price</dt><dd>{variant.sellPrice===undefined?'—':money.format(variant.sellPrice)}</dd></div></dl>
     <small>{variant.notes||item.notes||'No notes'}</small>
    </article>)}
   </div>
  </section>}
  <section className="rates-reference-card catalog-product-card">
   <header className="catalog-card-header">
    <div><strong>Other products</strong><small>{filtered.length} matching item{filtered.length===1?'':'s'}</small></div>
    <div className="catalog-card-actions">
     <span className="catalog-card-hint">Open a row for variants, costs and specifications.</span>
     <details className="catalog-card-filter">
      <summary>Filter{category!=='all'||query.trim()?' · '+(Number(category!=='all')+Number(!!query.trim())):''}</summary>
      <div className="catalog-card-filter-panel">
       <label>Find items<input type="search" placeholder="Accessories, SKUs, suppliers…" aria-label="Find Other catalog items"
        value={query} onChange={event=>setQuery(event.target.value)}/></label>
       <label>Category<select aria-label="Other category" value={category}
        onChange={event=>setCategory(event.target.value)}>
        <option value="all">All categories</option>
        {categories.map(value=><option key={value} value={value}>{value}</option>)}
       </select></label>
       {editing&&<label className="catalog-card-checkbox"><input type="checkbox"
        checked={showInactive} onChange={event=>setShowInactive(event.target.checked)}/> Show inactive</label>}
      </div>
     </details>
     <label className="catalog-card-sort"><span className="catalog-control-label">Sort</span>
      <select aria-label="Sort other items" value={sort} onChange={event=>setSort(event.target.value as typeof sort)}>
       <option value="category">Category / name</option><option value="name">Name A–Z</option>
       <option value="brand">Brand / supplier</option>
      </select>
     </label>
     {(saving||error)&&<small className="catalog-product-save" role="status">{error?'Sync issue: '+error:'Saving…'}</small>}
     {canEdit&&<button type="button" className="catalog-card-edit" onClick={()=>setEditing(e=>!e)}>
      {editing?'Done editing':'Edit items'}</button>}
    </div>
   </header>
   <CatalogPagination label="Other" total={filtered.length}
    page={pagination.page} pageSize={pagination.pageSize}
    onPageChange={next=>{pagination.setPage(next);setExpanded(null);}}
    onPageSizeChange={size=>{pagination.setPageSize(size);setExpanded(null);}}/>
   <div className="rates-reference-table-wrap catalog-product-scroll ss-worktable-surface">
    <table className="rates-reference-table catalog-product-table">
     <thead><tr><th>Category</th><th>Item</th><th>Brand / supplier</th>
      <th>Unit</th><th>Default cost</th><th>Customer price</th><th>Variants</th></tr></thead>
     <tbody>{pagedItems.map(item=>{
      const open=expanded===item.id,defaultVariant=item.variants.find(v=>v.default)||item.variants[0];
      return <Fragment key={item.id}>
       <tr className={open?'is-expanded':''}>
        <td>{item.category}</td>
        <td className="rates-reference-item"><button type="button" className="materials-name-toggle"
         aria-expanded={open} onClick={()=>setExpanded(open?null:item.id)}><strong>{item.name}</strong></button>
         <small>{item.sku||'No SKU'}{!item.active?' · Inactive':''}</small></td>
        <td>{item.brand||item.supplier||'—'}</td><td>{item.unit||'each'}</td>
        <td>{defaultVariant?.internalCost===undefined?'—':money.format(defaultVariant.internalCost)}</td>
        <td>{defaultVariant?.sellPrice===undefined?'—':money.format(defaultVariant.sellPrice)}</td>
        <td><button type="button" onClick={()=>setExpanded(open?null:item.id)}>
         {open?'Hide':'Variants · '+item.variants.filter(v=>v.active).length}
        </button></td>
       </tr>
       {open&&<tr className="materials-variant-expanded-row"><td colSpan={7}>
        <div className="catalog-product-detail">
         {editing&&<div className="catalog-product-properties">
          <Text label="Item name" value={item.name} change={value=>update(item,'name',value)}/>
          <Text label="Category" value={item.category} change={value=>update(item,'category',value)}/>
          <Text label="Brand" value={item.brand} change={value=>update(item,'brand',value)}/>
          <Text label="Supplier" value={item.supplier} change={value=>update(item,'supplier',value)}/>
          <Text label="SKU / model" value={item.sku} change={value=>update(item,'sku',value)}/>
          <Text label="Unit" value={item.unit} change={value=>update(item,'unit',value)}/>
          <label className="catalog-product-property"><span>General notes</span>
           <textarea rows={2} value={item.notes??''} onChange={event=>update(item,'notes',event.target.value)}/>
          </label>
          <label className="catalog-product-property"><span>Active</span><input type="checkbox"
           checked={item.active} onChange={event=>update(item,'active',event.target.checked)}/></label>
         </div>}
         <div className="catalog-product-detail-head"><strong>Item variants</strong>
          {editing&&<button type="button" onClick={()=>addVariant(item.id)}>+ Variant</button>}
         </div>
         <div className="catalog-product-variant-list">
          {item.variants.filter(v=>showInactive||v.active).map(variant=>{
           const pinned=pins.includes(item.id+':'+variant.id);
           return <article key={variant.id} className="materials-variant-line catalog-sink-variant">
            <div className="catalog-product-variant-heading">
             <div><strong>{variant.label}</strong><small>{variant.sku||item.sku||'No SKU'}
              {variant.default?' · Default':''}{variant.active?'':' · Inactive'}</small></div>
             <button type="button" className={'materials-pin-button'+(pinned?' is-pinned':'')}
              aria-pressed={pinned} onClick={()=>pin(item.id,variant.id)}>{pinned?'Pinned':'Pin'}</button>
            </div>
            {editing?<div className="catalog-product-properties">
             <Text label="Variant" value={variant.label} change={value=>updateV(item,variant,'label',value)}/>
             <Text label="SKU" value={variant.sku} change={value=>updateV(item,variant,'sku',value)}/>
             <Text label="Specification / dimensions" value={variant.specification}
              change={value=>updateV(item,variant,'specification',value)}/>
             <Text label="Material" value={variant.material} change={value=>updateV(item,variant,'material',value)}/>
             <Text label="Finish" value={variant.finish} change={value=>updateV(item,variant,'finish',value)}/>
             <Text label="Colors (comma-separated)" value={(variant.availableColors??[]).join(', ')}
              change={value=>updateV(item,variant,'availableColors',colors(value))}/>
             <Price label="Internal cost" value={variant.internalCost}
              change={value=>updateV(item,variant,'internalCost',value)}/>
             <Price label="Customer price" value={variant.sellPrice}
              change={value=>updateV(item,variant,'sellPrice',value)}/>
             <label className="catalog-product-property"><span>Variant notes</span>
              <textarea rows={2} value={variant.notes??''}
               onChange={event=>updateV(item,variant,'notes',event.target.value)}/></label>
             {(['default','active'] as const).map(key=><label key={key} className="catalog-product-property">
              <span>{key==='default'?'Default variant':'Active'}</span>
              <input type="checkbox" checked={variant[key]} onChange={event=>updateV(item,variant,key,event.target.checked)}/>
             </label>)}
             <div className="catalog-product-variant-operations">
              <button type="button" onClick={()=>duplicateVariant(item.id,variant.id)}>Duplicate</button>
              <button type="button" className="is-danger" disabled={item.variants.length<=1}
               onClick={()=>{if(window.confirm('Delete variant?'))removeVariant(item.id,variant.id);}}>Delete</button>
             </div>
            </div>:<dl className="catalog-product-facts">
             <div><dt>Specification</dt><dd>{variant.specification||'—'}</dd></div>
             <div><dt>Material / finish</dt><dd>{[variant.material,variant.finish].filter(Boolean).join(' · ')||'—'}</dd></div>
             <div><dt>Colors</dt><dd>{variant.availableColors?.join(', ')||'—'}</dd></div>
             <div><dt>Cost</dt><dd>{variant.internalCost===undefined?'—':money.format(variant.internalCost)}</dd></div>
             <div><dt>Customer price</dt><dd>{variant.sellPrice===undefined?'—':money.format(variant.sellPrice)}</dd></div>
             <div><dt>Notes</dt><dd>{variant.notes||item.notes||'—'}</dd></div>
            </dl>}
           </article>;
          })}
         </div>
        </div>
       </td></tr>}
      </Fragment>;
     })}
     {!filtered.length&&<tr><td colSpan={7}>No items match. Use + Item to begin your Other catalog.</td></tr>}
     </tbody>
    </table>
   </div>
  </section>
 </section>;
}
