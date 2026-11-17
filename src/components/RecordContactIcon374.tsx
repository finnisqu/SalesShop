/** Compact, accessible record header contact icons; caller supplies link/button labels. */
export function RecordContactIcon374({kind}:{kind:'email'|'call'|'text'|'activity'}){
 return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"
  width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8"
  strokeLinecap="round" strokeLinejoin="round">
  {kind==='email'?<><rect x="3" y="5" width="18" height="14" rx="2"/>
    <path d="m4 7 8 6 8-6"/></>:
   kind==='call'?<path d="M6.3 3.4h3.2l1.6 4.4-2.1 2.3a15 15 0 0 0 5 5l2.3-2.1 4.4 1.6v3.2a2.3 2.3 0 0 1-2.5 2.3C10.6 19.6 4.4 13.4 4 5.9a2.3 2.3 0 0 1 2.3-2.5Z"/>:
   kind==='text'?<path d="M20 11.2a8.3 8.3 0 0 1-8.5 8.1c-1.5 0-2.7-.2-3.9-.8L3 20l1.5-4.2A8.4 8.4 0 1 1 20 11.2Z"/>:
   <><path d="m4 19 4-.8L19 7.2 15.8 4 4.8 15z"/><path d="m13.8 6 4.2 4.2M4 21h16"/></>}
 </svg>;
}
