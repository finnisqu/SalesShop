import {useRef,type ReactNode} from 'react';
import {useDismissibleDetails} from './useDismissibleDetails';

export const WORKTABLE_PAGE_SIZES=[25,50,100] as const;
export const DEFAULT_WORKTABLE_PAGE_SIZE=50;

export function worktablePageRange(total:number,requestedPage:number,pageSize:number){
 const safeSize=WORKTABLE_PAGE_SIZES.includes(pageSize as typeof WORKTABLE_PAGE_SIZES[number])
  ?pageSize:DEFAULT_WORKTABLE_PAGE_SIZE;
 // External filters, deleted rows and persisted state may temporarily supply
 // stale or invalid totals/page indices. Never produce NaN or fractional slices.
 const count=Number.isFinite(total)&&total>0?Math.floor(total):0;
 const requested=Number.isFinite(requestedPage)?Math.floor(requestedPage):1;
 const pageCount=Math.max(1,Math.ceil(count/safeSize));
 const page=Math.max(1,Math.min(requested,pageCount));
 const start=(page-1)*safeSize;
 return {page,pageCount,start,end:Math.min(start+safeSize,count),
  first:count===0?0:start+1,last:Math.min(start+safeSize,count)};
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

/** Reusable action/view dropdown for worktable toolbars. Separated from Filters
 * because navigation and actions should not be mixed with dataset filters. */
export interface WorktableActionItem{
 label:string;onClick:()=>void;active?:boolean;disabled?:boolean;section?:string;
}
export function WorktableActionMenu({label,items}:{
 label:string;items:readonly WorktableActionItem[];
}){
 const ref=useRef<HTMLDetailsElement>(null);
 useDismissibleDetails(ref);
 return <details className="ss-worktable-action-menu" ref={ref}>
  <summary aria-label={label+' menu'} aria-haspopup="true">
   {label}<span className="ss-worktable-action-chevron" aria-hidden="true">⌄</span>
  </summary>
  <div className="ss-worktable-action-panel" role="group" aria-label={label+' options'}>
   {items.map((item,index)=><div className="ss-worktable-action-entry" key={(item.section??'')+':'+item.label+':'+index}>
    {item.section&&(index===0||items[index-1]?.section!==item.section)&&
     <div className="ss-worktable-action-section">{item.section}</div>}
    <button type="button" disabled={item.disabled}
     aria-pressed={item.active===undefined?undefined:item.active}
     onClick={()=>{
      ref.current?.removeAttribute('open');
      ref.current?.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});
      item.onClick();
     }}>
     <span>{item.label}</span>
     {item.active&&<span className="ss-worktable-action-selected" aria-hidden="true">✓</span>}
    </button>
   </div>)}
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
