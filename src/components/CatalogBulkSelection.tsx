import {useEffect,useState} from 'react';

export interface CatalogSelectableRecord {
 id:string;
 active:boolean;
}

/** Selection is scoped to the page currently rendered, never the whole filtered catalog. */
export function catalogPageSelection<T extends CatalogSelectableRecord>(
 rows:readonly T[], selectedIds:readonly string[],
){
 const selected=new Set(selectedIds);
 const pageIds=rows.map(row=>row.id);
 const selectedPageIds=pageIds.filter(id=>selected.has(id));
 return {
  selectedPageIds,
  allSelected:pageIds.length>0&&selectedPageIds.length===pageIds.length,
  activeIds:rows.filter(row=>selected.has(row.id)&&row.active).map(row=>row.id),
  archivedIds:rows.filter(row=>selected.has(row.id)&&!row.active).map(row=>row.id),
 };
}

/** Shared worktable selection logic; filter, sort and pagination changes clear it.
 * Even before that effect runs, all actions are constrained to visible page rows. */
export function useCatalogPageSelection<T extends CatalogSelectableRecord>(
 rows:readonly T[],resetKey:string,
){
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 useEffect(()=>{setSelectedIds([]);},[resetKey]);
 const page=catalogPageSelection(rows,selectedIds);
 const clear=()=>setSelectedIds([]);
 const selectPage=(checked:boolean)=>setSelectedIds(checked?rows.map(row=>row.id):[]);
 const selectRow=(id:string,checked:boolean)=>setSelectedIds(current=>{
  const pageIds=new Set(rows.map(row=>row.id));
  const visible=current.filter(key=>pageIds.has(key));
  if(!pageIds.has(id))return visible;
  return checked?[...new Set([...visible,id])]:visible.filter(key=>key!==id);
 });
 return {...page,selectPage,selectRow,clear};
}

export function CatalogBulkActions({label,selectedCount,activeCount,archivedCount,onArchive,onRestore,onClear}:{
 label:string;selectedCount:number;activeCount:number;archivedCount:number;
 onArchive:()=>void;onRestore:()=>void;onClear:()=>void;
}){
 if(!selectedCount)return null;
 return <div className="catalog-product-bulk-actions" role="group" aria-label={label+' bulk actions'}>
  <span aria-live="polite">{selectedCount} selected</span>
  <button type="button" disabled={!activeCount} onClick={onArchive}>
   Archive ({activeCount})</button>
  <button type="button" disabled={!archivedCount} onClick={onRestore}>
   Restore ({archivedCount})</button>
  <button type="button" onClick={onClear}>Clear selection</button>
 </div>;
}
