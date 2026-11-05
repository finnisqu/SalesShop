import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {useCompanySettingsStore} from '../store/companySettingsStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNavigationStore} from '../store/navigationStore';
import {ConnectionsTable,type ConnectionTableRow,type ConnectionColumn} from './ConnectionsTable';
import {PreviewPanelHeading,PreviewPanelClose} from './PreviewPanelChrome';
import type {StockMaterial} from '../types/settings';
import '../catalog-tags-workspace.css';

interface TagStats{
 name:string;description:string;materials:number;variants:number;samples:string[];
}
const columns:ConnectionColumn[]=[
 {key:'name',label:'Tag'},{key:'materials',label:'Materials'},
 {key:'variants',label:'Variants'},{key:'description',label:'Description'},
];
const tagKey='salesshop-catalog-tag-to-filter-v1';

function tagStats(materials:readonly StockMaterial[],
 definitions:Record<string,{description:string}>):TagStats[]{
 const stats=new Map<string,{materialIds:Set<string>;variantIds:Set<string>;samples:Set<string>}>();
 const touch=(tag:string,material:StockMaterial,variantId?:string)=>{
  const key=tag.trim();
  if(!key)return;
  let record=stats.get(key);
  if(!record){
   record={materialIds:new Set(),variantIds:new Set(),samples:new Set()};
   stats.set(key,record);
  }
  record.materialIds.add(material.id);
  if(variantId)record.variantIds.add(material.id+':'+variantId);
  record.samples.add(material.name);
 };
 materials.forEach(material=>{
  material.features?.forEach(tag=>touch(tag,material));
  material.variants?.forEach(variant=>variant.features?.forEach(tag=>touch(tag,material,variant.id)));
 });
 for(const tag of Object.keys(definitions))if(!stats.has(tag)){
  stats.set(tag,{materialIds:new Set(),variantIds:new Set(),samples:new Set()});
 }
 return [...stats.entries()].map(([name,item])=>({
  name,description:definitions[name]?.description??'',
  materials:item.materialIds.size,variants:item.variantIds.size,
  samples:[...item.samples].slice(0,12),
 })).sort((a,b)=>a.name.localeCompare(b.name));
}
export function CatalogTagsWorkspace({externalQuery}:{externalQuery?:string}={}){
 const settings=useCompanySettingsStore(s=>s.settings);
 const hydrated=useCompanySettingsStore(s=>s.hydrated);
 const update=useCompanySettingsStore(s=>s.update);
 const mode=useAuthStore(s=>s.mode),role=useAuthStore(s=>s.teamRole);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const setSection=useNavigationStore(s=>s.setCatalogSection);
 const canEdit=!perspective&&(mode==='local'||role==='owner'||role==='admin');
 const [query,setQuery]=useState('');
 useEffect(()=>{if(externalQuery!==undefined)setQuery(externalQuery);},[externalQuery]);
 const [selected,setSelected]=useState<string|null>(null);
 const [name,setName]=useState('');
 const [description,setDescription]=useState('');
 const [error,setError]=useState('');
 const definitions=settings.materialTagDefinitions??{};
 const stats=useMemo(()=>tagStats(settings.stockMaterials,definitions),
  [settings.stockMaterials,definitions]);
 const selectedInfo=stats.find(tag=>tag.name===selected);
 const filtered=stats.filter(tag=>(tag.name+' '+tag.description).toLowerCase().includes(query.trim().toLowerCase()));
 const rows:ConnectionTableRow[]=filtered.map(tag=>({
  id:tag.name,name:tag.name,
  values:{name:tag.name,materials:String(tag.materials),variants:String(tag.variants),
   description:tag.description||'No description'},
  sortValues:{materials:tag.materials,variants:tag.variants},
 }));
 const open=(tagName:string)=>{
  const item=stats.find(tag=>tag.name===tagName);
  if(!item)return;
  setSelected(tagName);setName(tagName);setDescription(item.description);setError('');
 };
 const startNew=()=>{setSelected('');setName('');setDescription('');setError('');};
 useEffect(()=>{
  if(externalQuery===undefined||!canEdit)return;
  const open=()=>startNew();
  window.addEventListener('sales-shop:catalog-create',open);
  return()=>window.removeEventListener('sales-shop:catalog-create',open);
 },[externalQuery===undefined,canEdit]);
 const close=()=>{setSelected(null);setError('');};
 const save=(event:FormEvent)=>{
  event.preventDefault();
  if(!canEdit)return;
  const clean=name.trim().slice(0,120);
  if(!clean){setError('Enter a tag name.');return;}
  if(stats.some(tag=>tag.name.toLowerCase()===clean.toLowerCase()&&tag.name!==selected)){
   setError('Another tag already uses this name.');return;
  }
  const changedName=!!selected&&selected!==clean;
  if(changedName&&selectedInfo?.materials&&
   !window.confirm('Rename this tag on '+selectedInfo.materials+
    ' materials and all matching variants?'))return;
  const nextDefinitions={...definitions};
  if(changedName&&selected!==null)delete nextDefinitions[selected];
  nextDefinitions[clean]={description:description.trim().slice(0,2000)};
  let nextMaterials=settings.stockMaterials;
  if(changedName){
   const replace=(values?:string[])=>values?.map(tag=>tag===selected?clean:tag);
   nextMaterials=settings.stockMaterials.map(material=>({
    ...material,features:replace(material.features),
    variants:material.variants?.map(variant=>({...variant,features:replace(variant.features)})),
   }));
  }
  update(changedName?{materialTagDefinitions:nextDefinitions,stockMaterials:nextMaterials}
   :{materialTagDefinitions:nextDefinitions});
  setSelected(clean);setName(clean);setError('');
 };
 const inspect=selected!==null;
 return <main className="catalog-tags-workspace" aria-label="Catalog tags">
  <header className="catalog-tags-heading">
   <div><small>CATALOG · TAGS</small><h2>Tags</h2>
    <p>Explore features and classification tags across materials and slab variants.</p></div>
   {canEdit&&<button type="button" onClick={startNew}>+ New tag</button>}
  </header>
  <div className="catalog-tags-summary"><strong>{stats.length} tags</strong>
   <span>Counts reflect unique materials and their variants, including inactive products.</span>
  </div>
  <div className="catalog-tags-search">
   <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
    aria-label="Search catalog tags" placeholder="Search tag or description…"/>
   <span>{filtered.length} shown</span>
  </div>
  {hydrated?<ConnectionsTable tableKey="tags" columns={columns} rows={rows}
   onOpen={open}/>:<p className="catalog-tags-empty">Loading catalog tags…</p>}
  {inspect&&createPortal(<div className="catalog-tags-backdrop" onMouseDown={event=>{
   if(event.target===event.currentTarget)close();
  }}>
   <aside className="catalog-tags-drawer" role="dialog" aria-modal="true"
    aria-label={selected?'Tag '+selected:'Create tag'}>
    <header><PreviewPanelHeading eyebrow="CATALOG · TAG PREVIEW" title={selected||'New tag'}
     detail={<>{selectedInfo?.materials??0} materials · {selectedInfo?.variants??0} variants</>}/>
     <PreviewPanelClose onClose={close} label="Close tag preview"/>
    </header>
    <form onSubmit={save}>
     <section className="catalog-tags-form">
      <label>Tag name<input value={name} maxLength={120} required
       onChange={e=>setName(e.target.value)} disabled={!canEdit}/></label>
      <label>Description<textarea value={description} maxLength={2000} rows={4}
       onChange={e=>setDescription(e.target.value)} disabled={!canEdit}
       placeholder="Describe what this tag means and when to use it…"/></label>
      {!!selectedInfo?.samples.length&&<div className="catalog-tags-examples">
       <strong>Used by</strong>
       {selectedInfo.samples.map(sample=><span key={sample}>{sample}</span>)}
      </div>}
      {selected===''&&<p className="catalog-tags-muted">
       New tags appear in the directory immediately. Apply them to products in the Materials editor.</p>}
      {!!error&&<p role="alert" className="catalog-tags-error">{error}</p>}
     </section>
     <footer>
      {selectedInfo&&<button type="button" onClick={()=>{
       try{sessionStorage.setItem(tagKey,selectedInfo.name);}catch{/* optional */}
       close();setSection('materials');
      }}>View materials ›</button>}
      <button type="button" onClick={close}>Close</button>
      {canEdit&&<button type="submit" className="catalog-tags-save">Save tag</button>}
     </footer>
    </form>
   </aside>
  </div>,document.body)}
 </main>;
}
