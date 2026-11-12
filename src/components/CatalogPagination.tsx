import {useEffect,useState,type ReactNode} from 'react';

export const CATALOG_PAGE_SIZES=[25,50,100] as const;
export const DEFAULT_CATALOG_PAGE_SIZE=50;

export function catalogPageRange(total:number,requestedPage:number,pageSize:number){
 const safeSize=CATALOG_PAGE_SIZES.includes(pageSize as typeof CATALOG_PAGE_SIZES[number])
  ?pageSize:DEFAULT_CATALOG_PAGE_SIZE;
 const pageCount=Math.max(1,Math.ceil(total/safeSize));
 const page=Math.max(1,Math.min(requestedPage,pageCount));
 const start=(page-1)*safeSize;
 return {page,pageCount,start,end:Math.min(start+safeSize,total),
  first:total===0?0:start+1,last:Math.min(start+safeSize,total)};
}

/** One source of paging math for all Catalog worktables; filtering is applied upstream. */
export function useCatalogPagination(total:number,resetKey:string){
 const [requestedPage,setPage]=useState(1);
 const [pageSize,setPageSizeState]=useState(DEFAULT_CATALOG_PAGE_SIZE);
 useEffect(()=>{setPage(1);},[resetKey]);
 const range=catalogPageRange(total,requestedPage,pageSize);
 const setPageSize=(size:number)=>{
  if(!CATALOG_PAGE_SIZES.includes(size as typeof CATALOG_PAGE_SIZES[number]))return;
  setPageSizeState(size);setPage(1);
 };
 return {...range,pageSize,setPage,setPageSize};
}

export function CatalogPagination({label,total,page,pageSize,onPageChange,onPageSizeChange,extraActions}:{
 label:string;total:number;page:number;pageSize:number;
 onPageChange:(page:number)=>void;onPageSizeChange:(size:number)=>void;
 extraActions?:ReactNode;
}){
 const range=catalogPageRange(total,page,pageSize);
 return <nav className="materials-page-controls catalog-pagination"
   aria-label={label+' pagination'}>
   <span className="catalog-pagination-count">Showing {range.first}–{range.last} of {total}</span>
   <label className="catalog-pagination-size">Show
    <select aria-label={label+' per page'} value={pageSize}
      onChange={event=>onPageSizeChange(Number(event.target.value))}>
      {CATALOG_PAGE_SIZES.map(size=><option key={size} value={size}>{size} per page</option>)}
    </select>
   </label>
   <div className="materials-page-actions catalog-pagination-actions">
    <button type="button" disabled={range.page<=1}
      onClick={()=>onPageChange(range.page-1)}>‹ Previous</button>
    <span>Page {range.page} of {range.pageCount}</span>
    <button type="button" disabled={range.page>=range.pageCount}
      onClick={()=>onPageChange(range.page+1)}>Next ›</button>
    {extraActions&&<div className="catalog-pagination-extras">{extraActions}</div>}
   </div>
 </nav>;
}
