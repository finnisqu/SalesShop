/** Consistent inline icons for shared workspace controls.
 * Decorative by design: button labels supply accessible names.
 */
export type WorkspaceChromeIconName='more'|'columns'|'chevron-down'|'chevron-left'|'chevron-right'|'pin'|'sort'|'sort-asc'|'sort-desc';

export function WorkspaceChromeIcon({name}:{name:WorkspaceChromeIconName}){
 return <svg className={'ss-chrome-icon ss-chrome-icon-'+name}
  width="16" height="16" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
  strokeLinejoin="round" aria-hidden="true" focusable="false">
  {name==='more'&&<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6"/>
   <circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></g>}
  {name==='columns'&&<><rect x="3" y="4" width="18" height="16" rx="2"/>
   <path d="M9 4v16M15 4v16"/></>}
  {name==='chevron-down'&&<path d="m6 9 6 6 6-6"/>}
  {name==='chevron-left'&&<path d="m15 6-6 6 6 6"/>}
  {name==='chevron-right'&&<path d="m9 6 6 6-6 6"/>}
  {name==='pin'&&<><path d="M9 3h6v6l3 4v2H6v-2l3-4V3Z"/><path d="M12 15v6"/></>}
  {name==='sort'&&<path d="m7 7 4-4 4 4M11 3v18m6-4-4 4-4-4"/>}
  {name==='sort-asc'&&<path d="m6 15 6-6 6 6"/>}
  {name==='sort-desc'&&<path d="m6 9 6 6 6-6"/>}
 </svg>;
}
