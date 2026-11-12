import {useRef,type ReactNode} from 'react';
import {useDismissibleDetails} from './useDismissibleDetails';

export const WORKTABLE_PAGE_SIZES=[25,50,100] as const;
export const DEFAULT_WORKTABLE_PAGE_SIZE=50;

export function worktablePageRange(total:number,requestedPage:number,pageSize:number){
 const safeSize=WORKTABLE_PAGE_SIZES.includes(pageSize as typeof WORKTABLE_PAGE_SIZES[number])
  ?pageSize:DEFAULT_WORKTABLE_PAGE_SIZE;
 const pageCount=Math.max(1,Math.ceil(total/safeSize));
 const page=Math.max(1,Math.min(requestedPage,pageCount));
 const start=(page-1)*safeSize;
 return {page,pageCount,start,end:Math.min(start+safeSize,total),
  first:total===0?0:start+1,last:Math.min(start+safeSize,total)};
}

/** One accessible pagination control for every Records/Catalog worktable. */
export function WorktablePagination({label,total,page,pageSize,onPageChange,onPageSizeChange}:{
 label:string;total:number;page:number;pageSize:number;
 onPageChange:(page:number)=>void;onPageSizeChange:(size:number)=>void;
}){
 const range=worktablePageRange(total,page,pageSize);
 return <div className="ss-worktable-pagination" role="group" aria-label={label+' pagination'}>
  <span className="ss-worktable-page-count">{range.first}–{range.last} of {total}</span>
  <label className="ss-worktable-page-size"><span>Show</span>
   <select aria-label={label+' per page'} value={pageSize}
    onChange={event=>onPageSizeChange(Number(event.target.value))}>
    {WORKTABLE_PAGE_SIZES.map(size=><option key={size} value={size}>{size}</option>)}
   </select>
  </label>
  <div className="ss-worktable-page-steps">
   <button type="button" disabled={range.page<=1} onClick={()=>onPageChange(range.page-1)}
    aria-label={'Previous '+label+' page'} title="Previous page">‹</button>
   <span aria-live="polite">{range.page} / {range.pageCount}</span>
   <button type="button" disabled={range.page>=range.pageCount} onClick={()=>onPageChange(range.page+1)}
    aria-label={'Next '+label+' page'} title="Next page">›</button>
  </div>
 </div>;
}

/** A single reusable filter trigger and bounded, keyboard-dismissable panel.
 * Filters remain mounted so changing views does not reset draft selections. */
export function WorktableFilterMenu({children,activeCount=0,label='Filters',className=''}:{
 children:ReactNode;activeCount?:number;label?:string;className?:string;
}){
 const ref=useRef<HTMLDetailsElement>(null);
 useDismissibleDetails(ref);
 return <details className={'ss-worktable-filter-menu '+className} ref={ref}>
  <summary aria-label={label+(activeCount?' · '+activeCount+' active':'')}>
   {label}{activeCount>0&&<span className="ss-worktable-filter-count">{activeCount}</span>}
  </summary>
  <div className="ss-worktable-filter-panel" role="group" aria-label={label+' options'}>
   {children}
  </div>
 </details>;
}

/** Shared rounded table surface used by CRM, Quotes and Catalog rows. */
export function WorktableSurface({children,className='',label}:{
 children:ReactNode;className?:string;label:string;
}){
 return <div className={'ss-worktable-surface '+className} role="region" aria-label={label} tabIndex={0}>
  {children}
 </div>;
}
