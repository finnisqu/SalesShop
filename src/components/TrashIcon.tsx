/** Small decorative trash icon for consistent destructive Task actions. */
export function TrashIcon(){
 return <svg className="ss-trash-icon" width="15" height="15" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round"
  strokeLinejoin="round" aria-hidden="true" focusable="false">
  <path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/>
 </svg>;
}

/** Decorative edit icon paired with an accessible Edit label. */
export function PencilIcon(){
 return <svg className="ss-pencil-icon" width="15" height="15" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round"
  strokeLinejoin="round" aria-hidden="true" focusable="false">
  <path d="m15.5 5.5 3 3M4 20l4.5-1 10-10a2.12 2.12 0 0 0-3-3l-10 10L4 20Z"/>
 </svg>;
}
