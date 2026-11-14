import {Fragment,useEffect,useMemo,useState} from 'react';
import {useSinkCatalogStore} from '../store/sinkCatalogStore';
import {SINK_CATEGORIES,SINK_CATEGORY_LABELS,SINK_CONFIGURATIONS,SINK_CONFIGURATION_LABELS,
 type SinkCategory,type SinkModel,type SinkVariant,type SinkMountType} from '../types/sink';
import {WorkspaceLoadingState} from './WorkspaceLoadingState';
import {scopedStorageKey} from '../lib/developerPlayground';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import '../catalog-product-worktable.css';
import {CatalogPagination,useCatalogPagination} from './CatalogPagination';
import {WorktableFilterMenu,WorktableSurface,WorktableSelectPageCheckbox,WorktableSortButton} from './WorktableChrome';
import {CatalogFilterReset} from './CatalogFilterReset';
import {MobileCatalogActiveFilters} from './MobileCatalogTools';
import {CatalogQuoteLauncher} from './CatalogQuoteInsert';
import {matchesCatalogSearch} from '../services/catalogWorktableSearch';
import {catalogDefaultVariantPrice,compareCatalogVariantPrice,type CatalogSortDirection} from '../services/catalogVariantPriceSort';
import {catalogProductFilterChips} from '../services/catalogProductFilterChips';
import {reorderCatalogPins,shiftCatalogPin} from '../services/catalogComparisonOrder';
import {CatalogLifecycleStatus} from './CatalogLifecycleStatus';
import {CatalogBulkActions,useCatalogPageSelection} from './CatalogBulkSelection';

const PIN_KEY=scopedStorageKey('salesshop-catalog-sink-pins-v1');
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const dim=(value?:number)=>value===undefined?'—':String(value)+'″';
const size=(w?:number,l?:number,h?:number)=>
 [dim(w),dim(l),dim(h)].join(' × ');
function readPins():string[]{
 try{const value=JSON.parse(localStorage.getItem(PIN_KEY)??'[]');
  return Array.isArray(value)?value.filter((key):key is string=>typeof key==='string'):[];
 }catch{return [];}
}
const numberChange=(value:string)=>value===''?undefined:Number(value);
const colorList=(value:string)=>value.split(',').map(color=>color.trim()).filter(Boolean);
const mountTypes:SinkMountType[]=['undermount','drop-in','apron-front','vessel','other'];
function NumericField({label,value,onChange}:{
 label:string;value?:number;onChange:(value:number|undefined)=>void;
}){
 return <label className="catalog-product-property"><span>{label}</span>
  <input type="number" min="0" step="0.125" inputMode="decimal"
   value={value??''} onChange={event=>onChange(numberChange(event.target.value))}/>
 </label>;
}
function TextField({label,value,onChange,placeholder}:{
 label:string;value?:string;onChange:(value:string)=>void;placeholder?:string;
}){
 return <label className="catalog-product-property"><span>{label}</span>
  <input value={value??''} placeholder={placeholder} onChange={event=>onChange(event.target.value)}/>
 </label>;
}
export function CatalogSinksWorktable({externalQuery='',onClearExternalQuery}:{
 externalQuery?:string;onClearExternalQuery?:()=>void;
}){
 const models=useSinkCatalogStore(s=>s.models);
 const hydrated=useSinkCatalogStore(s=>s.hydrated);
 const hydrate=useSinkCatalogStore(s=>s.hydrate);
 const saving=useSinkCatalogStore(s=>s.saving);
 const error=useSinkCatalogStore(s=>s.error);
 const addModel=useSinkCatalogStore(s=>s.addModel);
 const duplicateModel=useSinkCatalogStore(s=>s.duplicateModel);
 const updateModel=useSinkCatalogStore(s=>s.updateModel);
 const setModelsActive=useSinkCatalogStore(s=>s.setModelsActive);
 const addVariant=useSinkCatalogStore(s=>s.addVariant);
 const updateVariant=useSinkCatalogStore(s=>s.updateVariant);
 const duplicateVariant=useSinkCatalogStore(s=>s.duplicateVariant);
 const deleteVariant=useSinkCatalogStore(s=>s.deleteVariant);
 const authMode=useAuthStore(state=>state.mode);
 const role=useAuthStore(state=>state.teamRole);
 const previewRole=useRolePerspectiveStore(state=>state.activePerspective);
 const canEdit=!previewRole&&(authMode==='local'||role==='owner'||role==='admin');
 const [editing,setEditing]=useState(false);
 const [expanded,setExpanded]=useState<string|null>(null);
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState<'all'|SinkCategory>('all');
 const [showInactive,setShowInactive]=useState(false);
 const [sort,setSort]=useState<'name'|'brand'|'category'|'cost'|'price'>('brand');
 const [sortDirection,setSortDirection]=useState<CatalogSortDirection>('ascending');
 const [pins,setPins]=useState<string[]>(readPins);
 const [dragging,setDragging]=useState<string|null>(null);
 useEffect(()=>{void hydrate();},[hydrate]);
 useEffect(()=>{try{localStorage.setItem(PIN_KEY,JSON.stringify(pins));}catch{/* optional */}},[pins]);
 useEffect(()=>{
  const create=()=>{
   if(!canEdit)return;
   // Keep the selected new-model category, but clear view restrictions
   // before opening the record. Otherwise its edit row can stay hidden.
   const selectedCategory=category==='all'?'kitchen':category;
   setQuery('');setCategory('all');setShowInactive(false);setSort('brand');
  setSortDirection('ascending');
   onClearExternalQuery?.();
   const id=addModel(selectedCategory);
   setExpanded(id);setEditing(true);
  };
  window.addEventListener('sales-shop:catalog-create',create);
  return()=>window.removeEventListener('sales-shop:catalog-create',create);
 },[addModel,category,canEdit,onClearExternalQuery]);
 const duplicateCatalogModel=(modelId:string)=>{
  const id=duplicateModel(modelId);
  if(!id)return;
  setQuery('');setCategory('all');setShowInactive(false);setSort('brand');
  setSortDirection('ascending');
  onClearExternalQuery?.();setExpanded(id);setEditing(true);
 };
 const togglePin=(modelId:string,variantId:string)=>{
  const key=modelId+':'+variantId;
  setPins(current=>current.includes(key)?current.filter(item=>item!==key):[...current,key]);
 };
 const pinRows=useMemo(()=>pins.flatMap(key=>{
  const [modelId,variantId]=key.split(':');
  const model=models.find(x=>x.id===modelId),variant=model?.variants.find(x=>x.id===variantId);
  return model&&variant?[{model,variant,key}]:[];
 }),[pins,models]);
 const shiftPin=(key:string,direction:-1|1)=>{
  setPins(current=>shiftCatalogPin(current,key,direction));
 };
 const sortMultiplier=sortDirection==='descending'?-1:1;
 const filtered=useMemo(()=>{
  return models.filter(model=>(showInactive||model.active)&&
   (category==='all'||model.category===category)&&
   matchesCatalogSearch([model.name,model.modelCode,model.brand,model.supplier,
    model.material,model.mountType,model.notes,SINK_CATEGORY_LABELS[model.category],...(model.availableColors??[]),
    ...model.variants.flatMap(variant=>[variant.label,variant.code,SINK_CONFIGURATION_LABELS[variant.configuration],variant.finish,variant.notes,
      ...(variant.availableColors??[])])],query,externalQuery))
   .sort((a,b)=>sort==='category'?
     (a.category.localeCompare(b.category)||a.name.localeCompare(b.name))*sortMultiplier:
     sort==='name'?a.name.localeCompare(b.name)*sortMultiplier:
     sort==='cost'||sort==='price'?compareCatalogVariantPrice(a,b,sort,sortDirection):
     ((a.brand??a.supplier??'').localeCompare(b.brand??b.supplier??'')||
       a.name.localeCompare(b.name))*sortMultiplier);
 },[models,showInactive,category,query,externalQuery,sort,sortDirection]);
 const filterChips=catalogProductFilterChips({
  localQuery:query,headerQuery:externalQuery,
  category,categoryLabel:category==='all'?'All sink types':SINK_CATEGORY_LABELS[category],
  includeArchived:showInactive,sort,defaultSort:'brand',sortDirection,
  sortLabel:sort==='name'?'Name':sort==='category'?'Category':
   sort==='cost'?'Default cost':sort==='price'?'Customer price':'Brand / name',
  clearLocalQuery:()=>setQuery(''),
  clearHeaderQuery:()=>onClearExternalQuery?.(),
  clearCategory:()=>setCategory('all'),
  clearArchived:()=>setShowInactive(false),
  clearSort:()=>{setExpanded(null);setSort('brand');setSortDirection('ascending');},
 });
 const activeFilterCount=filterChips.length;
 // Sorting closes an expanded editor so its page-follow effect cannot
 // override the newly selected sorted page.
 const chooseSort=(next:typeof sort,toggleCurrent=false)=>{
  setExpanded(null);
  setSortDirection(current=>toggleCurrent&&next===sort?
   (current==='ascending'?'descending':'ascending'):'ascending');
  setSort(next);
 };
 const chooseSortDirection=(next:CatalogSortDirection)=>{
  setExpanded(null);setSortDirection(next);
 };
 const resetCatalogView=()=>{
  setQuery('');setCategory('all');setShowInactive(false);setSort('brand');
  setSortDirection('ascending');
  setExpanded(null);onClearExternalQuery?.();
 };
 const pagination=useCatalogPagination(filtered.length,
  JSON.stringify([query,externalQuery,category,showInactive,sort,sortDirection]));
 const pagedModels=filtered.slice(pagination.start,pagination.end);
 const selecting=canEdit&&editing;
 const pageSelection=useCatalogPageSelection(pagedModels,
  JSON.stringify([query,externalQuery,category,showInactive,sort,sortDirection,pagination.page,pagination.pageSize,selecting]));
 const selectedIds=pageSelection.selectedPageIds;
 const bulkArchive=()=>{
  if(!selecting||!pageSelection.activeIds.length)return;
  const count=pageSelection.activeIds.length;
  if(!window.confirm(`Archive ${count} selected sink model${count===1?'':'s'}? Existing quotes keep their historical selections.`))return;
  setShowInactive(true);
  setModelsActive(pageSelection.activeIds,false);
  pageSelection.clear();
 };
 const bulkRestore=()=>{
  if(!selecting||!pageSelection.archivedIds.length)return;
  setModelsActive(pageSelection.archivedIds,true);
  pageSelection.clear();
 };
 // After creating a record, navigate to its page in the sorted catalog.
 useEffect(()=>{
  if(!expanded)return;
  const index=filtered.findIndex(row=>row.id===expanded);
  if(index>=0)pagination.setPage(Math.floor(index/pagination.pageSize)+1);
 },[expanded,filtered,pagination.pageSize]);

 const setModelActive=(model:SinkModel,active:boolean)=>{
  if(!active)setShowInactive(true);
  updateModel(model.id,{active});
 };
 const setVariantActive=(model:SinkModel,variant:SinkVariant,active:boolean)=>{
  if(!active)setShowInactive(true);
  updateVariant(model.id,variant.id,{active});
 };
 const update=<T extends keyof SinkModel,>(model:SinkModel,key:T,value:SinkModel[T])=>
  updateModel(model.id,{[key]:value});
 const updateV=<T extends keyof SinkVariant,>(model:SinkModel,variant:SinkVariant,key:T,value:SinkVariant[T])=>
  updateVariant(model.id,variant.id,{[key]:value});
 if(!hydrated)return <WorkspaceLoadingState title="Opening Sinks" detail="Loading sink models, variants and supplier costs…"/>;
 return <section className="catalog-product-worktable sinks-product-worktable">
  {filterChips.length>0&&<div className="catalog-product-mobile-filters">
   <MobileCatalogActiveFilters items={filterChips} onClear={resetCatalogView}/>
  </div>}
  {pinRows.length>0&&<section className="materials-comparison-board has-pins catalog-product-pin-board"
    aria-label="Pinned sink comparison">
   <header><div><span className="board-eyebrow">Comparison board</span>
    <strong>{pinRows.length} pinned sink variant{pinRows.length===1?'':'s'}</strong>
    <small>Keep models here while comparing catalog options.</small></div>
    <button type="button" onClick={()=>setPins([])}>Clear all</button>
   </header>
   <div className="materials-comparison-strip">
    {pinRows.map(({model,variant,key},index)=><article
      key={key} className="materials-comparison-card" draggable
      onDragStart={()=>setDragging(key)}
      onDragOver={event=>event.preventDefault()}
      onDrop={event=>{
       event.preventDefault();
       if(dragging)setPins(current=>reorderCatalogPins(current,dragging,key));
       setDragging(null);
      }}
      onDragEnd={()=>setDragging(null)}>
      <div className="catalog-product-pin-actions">
       <button type="button" aria-label={'Move '+model.name+' left'} disabled={index===0}
        onClick={()=>shiftPin(key,-1)}>←</button>
       <button type="button" aria-label={'Move '+model.name+' right'} disabled={index===pinRows.length-1}
        onClick={()=>shiftPin(key,1)}>→</button>
       <button type="button" aria-label={'Unpin '+model.name+' '+variant.label}
        onClick={()=>togglePin(model.id,variant.id)}>×</button>
      </div>
      <span>{model.brand||model.supplier||'Unbranded'} · {SINK_CATEGORY_LABELS[model.category]}</span>
      <strong>{model.name}</strong><b>{variant.label}</b>
      <CatalogLifecycleStatus active={model.active&&variant.active} isDefault={variant.default}/>
      <dl>
       <div><dt>Bowl W × L × H</dt><dd>{size(variant.bowlWidthIn,variant.bowlLengthIn,variant.bowlHeightIn)}</dd></div>
       <div><dt>Total W × L × H</dt><dd>{size(variant.totalWidthIn??model.widthIn,
         variant.totalLengthIn??model.depthIn,variant.totalHeightIn??model.heightIn)}</dd></div>
       <div><dt>Material / finish</dt><dd>{[model.material,variant.finish].filter(Boolean).join(' · ')||'—'}</dd></div>
       <div><dt>Cost / price</dt><dd>{variant.internalCost===undefined?'—':money.format(variant.internalCost)} / {variant.sellPrice===undefined?'—':money.format(variant.sellPrice)}</dd></div>
      </dl>
      <small>{(variant.availableColors?.length?variant.availableColors:model.availableColors??[]).join(', ')||'Colors not listed'}</small>
      {model.active&&variant.active&&<CatalogQuoteLauncher
        source={{kind:'sink',model,variantId:variant.id}}/>}
    </article>)}
   </div>
  </section>}
  <section className="rates-reference-card catalog-product-card">
   <header className="catalog-card-header">
    <div><strong>Sink models</strong><small>{filtered.length} matching model{filtered.length===1?'':'s'}</small></div>
    <div className="catalog-card-actions">
     <span className="catalog-card-hint">Expand models to compare sink dimensions and variants.</span>
     <WorktableFilterMenu className="catalog-card-filter"
      activeCount={activeFilterCount}>
      <div className="catalog-card-filter-panel">
       <label>Find models<input type="search" aria-label="Find sink models" placeholder="Model, finish or SKU…"
        value={query} onChange={event=>setQuery(event.target.value)}/></label>
       <label>Sink type<select aria-label="Filter sink category" value={category}
        onChange={event=>setCategory(event.target.value as typeof category)}>
        <option value="all">All sink types</option>
        {SINK_CATEGORIES.map(key=><option key={key} value={key}>{SINK_CATEGORY_LABELS[key]}</option>)}
       </select></label>
       <label className="catalog-card-checkbox"><input type="checkbox"
         checked={showInactive} onChange={event=>setShowInactive(event.target.checked)}/> Include archived</label>
      </div>
     <label className="catalog-card-sort"><span className="catalog-control-label">Sort</span>
      <select aria-label="Sort sinks" value={sort} onChange={event=>chooseSort(event.target.value as typeof sort)}>
       <option value="brand">Brand / name</option><option value="name">Name</option>
       <option value="category">Category</option><option value="cost">Default cost</option>
       <option value="price">Customer price</option>
      </select>
     </label>
     <label className="catalog-card-sort"><span className="catalog-control-label">Direction</span>
      <select aria-label="Sort sinks direction" value={sortDirection}
       onChange={event=>chooseSortDirection(event.target.value as CatalogSortDirection)}>
       <option value="ascending">Ascending</option><option value="descending">Descending</option>
      </select>
     </label>
     <CatalogFilterReset activeCount={activeFilterCount} onReset={resetCatalogView}/>
     </WorktableFilterMenu>
     {(saving||error)&&<small className="catalog-product-save" role="status">{error?'Cloud issue: '+error:'Saving…'}</small>}
     {canEdit&&<button type="button" className="catalog-card-edit" onClick={()=>{pageSelection.clear();setEditing(x=>!x);}}>
      {editing?'Done editing':'Edit sinks'}</button>}
    </div>
   </header>
   <CatalogPagination label="Sinks" total={filtered.length}
    page={pagination.page} pageSize={pagination.pageSize}
    onPageChange={next=>{pageSelection.clear();pagination.setPage(next);setExpanded(null);}}
    onPageSizeChange={size=>{pageSelection.clear();pagination.setPageSize(size);setExpanded(null);}}
    extraActions={selecting&&selectedIds.length>0&&
     <CatalogBulkActions label="Sink models" selectedCount={selectedIds.length}
      activeCount={pageSelection.activeIds.length} archivedCount={pageSelection.archivedIds.length}
      onArchive={bulkArchive} onRestore={bulkRestore} onClear={pageSelection.clear}/>}/>
   <WorktableSurface className="rates-reference-table-wrap catalog-product-scroll" label="Sinks catalog worktable">
    <table className="rates-reference-table catalog-product-table">
     <thead><tr>{selecting&&<th className="catalog-product-select-cell" scope="col">
      <WorktableSelectPageCheckbox label="Select all sink models on this page"
       allSelected={pageSelection.allSelected} someSelected={selectedIds.length>0}
       disabled={!pagedModels.length} onChange={checked=>pageSelection.selectPage(checked)}/></th>}
      <th scope="col" aria-sort={sort==='brand'?sortDirection:undefined}><WorktableSortButton label="Brand" active={sort==='brand'} direction={sortDirection} onSort={()=>chooseSort('brand',true)}/></th>
      <th scope="col" aria-sort={sort==='name'?sortDirection:undefined}><WorktableSortButton label="Model" active={sort==='name'} direction={sortDirection} onSort={()=>chooseSort('name',true)}/></th>
      <th scope="col" aria-sort={sort==='category'?sortDirection:undefined}><WorktableSortButton label="Category" active={sort==='category'} direction={sortDirection} onSort={()=>chooseSort('category',true)}/></th>
      <th scope="col">Material</th><th scope="col">Mount</th>
      <th scope="col">Total W × L × H</th>
      <th scope="col" aria-sort={sort==='cost'?sortDirection:undefined}><WorktableSortButton label="Default cost" active={sort==='cost'} direction={sortDirection} onSort={()=>chooseSort('cost',true)}/></th>
      <th scope="col" aria-sort={sort==='price'?sortDirection:undefined}><WorktableSortButton label="Customer price" active={sort==='price'} direction={sortDirection} onSort={()=>chooseSort('price',true)}/></th>
      <th scope="col">Variants</th></tr></thead>
     <tbody>
      {pagedModels.map(model=>{
       const open=expanded===model.id,variants=model.variants.filter(v=>editing||showInactive||v.active);
       return <Fragment key={model.id}>
        <tr className={[open?'is-expanded':'',selectedIds.includes(model.id)?'is-bulk-selected':''].filter(Boolean).join(' ')}>
         {selecting&&<td className="catalog-product-select-cell">
          <input type="checkbox" aria-label={'Select sink model '+model.name}
           checked={selectedIds.includes(model.id)}
           onChange={event=>pageSelection.selectRow(model.id,event.target.checked)}/></td>}
         <td>{model.brand||model.supplier||'—'}</td>
         <td className="rates-reference-item"><button type="button" className="materials-name-toggle"
           aria-expanded={open} onClick={()=>setExpanded(open?null:model.id)}><strong>{model.name}</strong></button>
           <small>{model.modelCode||'No SKU'} <CatalogLifecycleStatus active={model.active}/></small></td>
         <td>{SINK_CATEGORY_LABELS[model.category]}</td><td>{model.material||'—'}</td>
         <td>{model.mountType||'—'}</td><td>{size(model.widthIn,model.depthIn,model.heightIn)}</td>
         <td className="catalog-product-currency-cell">{catalogDefaultVariantPrice(model,'cost')===undefined
          ?'—':money.format(catalogDefaultVariantPrice(model,'cost')!)}</td>
         <td className="catalog-product-currency-cell">{catalogDefaultVariantPrice(model,'price')===undefined
          ?'—':money.format(catalogDefaultVariantPrice(model,'price')!)}</td>
         <td><button type="button" className={open?'active':''} onClick={()=>setExpanded(open?null:model.id)}>
           {open?'Hide':'Variants · '+variants.length}</button></td>
        </tr>
        {open&&<tr className="materials-variant-expanded-row"><td colSpan={selecting?10:9}>
         <div className="catalog-product-detail">
          {editing&&<div className="catalog-product-properties">
           <TextField label="Model name" value={model.name} onChange={value=>update(model,'name',value)}/>
           <TextField label="Brand" value={model.brand} onChange={value=>update(model,'brand',value)}/>
           <TextField label="Supplier" value={model.supplier} onChange={value=>update(model,'supplier',value)}/>
           <TextField label="SKU / model code" value={model.modelCode} onChange={value=>update(model,'modelCode',value)}/>
           <label className="catalog-product-property"><span>Category</span><select value={model.category}
             onChange={event=>update(model,'category',event.target.value as SinkCategory)}>
             {SINK_CATEGORIES.map(key=><option key={key} value={key}>{SINK_CATEGORY_LABELS[key]}</option>)}
            </select></label>
           <label className="catalog-product-property"><span>Mount</span><select value={model.mountType??''}
             onChange={event=>update(model,'mountType',event.target.value as SinkMountType||undefined)}>
             <option value="">Not specified</option>{mountTypes.map(type=><option key={type} value={type}>{type}</option>)}
            </select></label>
           <TextField label="Material" value={model.material} onChange={value=>update(model,'material',value)}/>
           <TextField label="Available colors (comma-separated)" value={(model.availableColors??[]).join(', ')}
             onChange={value=>update(model,'availableColors',colorList(value))}/>
           <NumericField label="Total width (in)" value={model.widthIn} onChange={value=>update(model,'widthIn',value)}/>
           <NumericField label="Total length (in)" value={model.depthIn} onChange={value=>update(model,'depthIn',value)}/>
           <NumericField label="Total height (in)" value={model.heightIn} onChange={value=>update(model,'heightIn',value)}/>
           <TextField label="Model notes" value={model.notes} onChange={value=>update(model,'notes',value)}/>
           <label className="catalog-product-property"><span>Active in catalog</span><input type="checkbox" checked={model.active}
             onChange={event=>setModelActive(model,event.target.checked)}/>
             <small className="catalog-product-default-note">{model.active?'Uncheck to archive':'Check to restore'}; saved quotes keep their original selections.</small></label>
          </div>}
          <div className="catalog-product-detail-head"><div><strong>Variants and bowls</strong>
            {editing&&<small className="catalog-product-default-note">
             Choose an available variant as default for new selections.</small>}
             {!model.active&&<small className="catalog-product-default-note">
              Model archived — restore it to include variants in new quotes.</small>}</div>
           {editing&&<span className="catalog-product-variant-operations">
             <button type="button" onClick={()=>duplicateCatalogModel(model.id)}>Duplicate model</button>
             <button type="button" onClick={()=>addVariant(model.id)}>+ Variant</button>
            </span>}
          </div>
          <div className="catalog-product-variant-list">
           {variants.map(variant=>{
            const pinned=pins.includes(model.id+':'+variant.id);
            return <article key={variant.id} className="materials-variant-line catalog-sink-variant">
             <div className="catalog-product-variant-heading">
              <div><strong>{variant.label}</strong><small>
               {variant.code||'No variant SKU'} · {SINK_CONFIGURATION_LABELS[variant.configuration]}
               {variant.ada?' · ADA':''} <CatalogLifecycleStatus active={variant.active} isDefault={variant.default}/>
              </small></div>
              <button type="button" className={'materials-pin-button'+(pinned?' is-pinned':'')}
               aria-pressed={pinned} onClick={()=>togglePin(model.id,variant.id)}>
               {pinned?'Pinned':'Pin'}</button>
              {model.active&&variant.active&&<CatalogQuoteLauncher
                source={{kind:'sink',model,variantId:variant.id}}/>}
             </div>
             {editing?<div className="catalog-product-properties">
              <TextField label="Variant" value={variant.label} onChange={value=>updateV(model,variant,'label',value)}/>
              <TextField label="Code / SKU" value={variant.code} onChange={value=>updateV(model,variant,'code',value)}/>
              <label className="catalog-product-property"><span>Configuration</span><select value={variant.configuration}
                onChange={event=>updateV(model,variant,'configuration',event.target.value as SinkVariant['configuration'])}>
                {SINK_CONFIGURATIONS.map(key=><option key={key} value={key}>{SINK_CONFIGURATION_LABELS[key]}</option>)}
               </select></label>
              <TextField label="Finish" value={variant.finish} onChange={value=>updateV(model,variant,'finish',value)}/>
              <NumericField label="Corner radius (in)" value={variant.cornerRadiusIn} onChange={value=>updateV(model,variant,'cornerRadiusIn',value)}/>
              <NumericField label="Bowl width (in)" value={variant.bowlWidthIn} onChange={value=>updateV(model,variant,'bowlWidthIn',value)}/>
              <NumericField label="Bowl length (in)" value={variant.bowlLengthIn} onChange={value=>updateV(model,variant,'bowlLengthIn',value)}/>
              <NumericField label="Bowl height (in)" value={variant.bowlHeightIn} onChange={value=>updateV(model,variant,'bowlHeightIn',value)}/>
              <NumericField label="Total width override (in)" value={variant.totalWidthIn} onChange={value=>updateV(model,variant,'totalWidthIn',value)}/>
              <NumericField label="Total length override (in)" value={variant.totalLengthIn} onChange={value=>updateV(model,variant,'totalLengthIn',value)}/>
              <NumericField label="Total height override (in)" value={variant.totalHeightIn} onChange={value=>updateV(model,variant,'totalHeightIn',value)}/>
              <TextField label="Colors (comma-separated)" value={(variant.availableColors??[]).join(', ')}
                onChange={value=>updateV(model,variant,'availableColors',colorList(value))}/>
              <NumericField label="Internal cost" value={variant.internalCost} onChange={value=>updateV(model,variant,'internalCost',value)}/>
              <NumericField label="Customer price" value={variant.sellPrice} onChange={value=>updateV(model,variant,'sellPrice',value)}/>
              <TextField label="Notes" value={variant.notes} onChange={value=>updateV(model,variant,'notes',value)}/>
              {(['ada','default'] as const).map(key=><label key={key} className="catalog-product-property">
                <span>{key==='ada'?'ADA':'Default variant'}</span>
                <input type="checkbox" checked={variant[key]}
                 disabled={key==='default'&&(!variant.active||variant.default)}
                 title={key==='default'?variant.active?
                  'Choose another available variant to change the default':
                  'Restore this variant before setting it as default':undefined}
                 onChange={event=>updateV(model,variant,key,event.target.checked)}/>
               </label>)}
              <div className="catalog-product-variant-operations">
               <button type="button" className={variant.active?'catalog-product-archive-action':'catalog-product-restore-action'}
                 aria-label={(variant.active?'Archive ':'Restore ')+variant.label}
                 onClick={()=>setVariantActive(model,variant,!variant.active)}>
                 {variant.active?'Archive variant':'Restore variant'}</button>
                <button type="button" onClick={()=>duplicateVariant(model.id,variant.id)}>Duplicate variant</button>
               <button type="button" className="is-danger" disabled={model.variants.length<=1}
                onClick={()=>{if(window.confirm('Delete this variant? Saved quotes retain their historical snapshots.'))deleteVariant(model.id,variant.id);}}>Delete variant</button>
              </div>
             </div>:<dl className="catalog-product-facts">
               <div><dt>Material / finish</dt><dd>{[model.material,variant.finish].filter(Boolean).join(' · ')||'—'}</dd></div>
               <div><dt>Bowl W × L × H</dt><dd>{size(variant.bowlWidthIn,variant.bowlLengthIn,variant.bowlHeightIn)}</dd></div>
               <div><dt>Total W × L × H</dt><dd>{size(variant.totalWidthIn??model.widthIn,
                variant.totalLengthIn??model.depthIn,variant.totalHeightIn??model.heightIn)}</dd></div>
               <div><dt>Corner radius</dt><dd>{dim(variant.cornerRadiusIn)}</dd></div>
               <div><dt>Colors</dt><dd>{(variant.availableColors?.length?variant.availableColors:model.availableColors??[]).join(', ')||'—'}</dd></div>
               <div><dt>Cost</dt><dd>{variant.internalCost===undefined?'—':money.format(variant.internalCost)}</dd></div>
               <div><dt>Price</dt><dd>{variant.sellPrice===undefined?'—':money.format(variant.sellPrice)}</dd></div>
               <div><dt>Notes</dt><dd>{variant.notes||model.notes||'—'}</dd></div>
              </dl>}
            </article>;
           })}
          </div>
         </div>
        </td></tr>}
       </Fragment>;
      })}
      {!filtered.length&&<tr><td colSpan={selecting?10:9}>
       <div className="catalog-product-empty-results">
        <span role="status">No sink models match. Clear filters or add a sink.</span>
        {activeFilterCount>0&&<CatalogFilterReset activeCount={activeFilterCount} onReset={resetCatalogView}/>}
       </div>
      </td></tr>}
     </tbody>
    </table>
   </WorktableSurface>
  </section>
 </section>;
}
