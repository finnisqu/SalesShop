import {useEffect,useState,type ReactNode} from 'react';
import {WorktablePagination,WORKTABLE_PAGE_SIZES,DEFAULT_WORKTABLE_PAGE_SIZE,
 worktablePageRange} from './WorktableChrome';

export const CATALOG_PAGE_SIZES=WORKTABLE_PAGE_SIZES;
export const DEFAULT_CATALOG_PAGE_SIZE=DEFAULT_WORKTABLE_PAGE_SIZE;
export const catalogPageRange=worktablePageRange;

/** Catalog and Records share one source of pagination math and controls. */
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
 return <nav className="materials-page-controls catalog-pagination ss-worktable-top-pagination"
   aria-label={label+' pagination'}>
   <WorktablePagination label={label} total={total} page={page} pageSize={pageSize}
    onPageChange={onPageChange} onPageSizeChange={onPageSizeChange}/>
   {extraActions&&<div className="catalog-pagination-extras">{extraActions}</div>}
 </nav>;
}
