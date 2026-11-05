import type {ReactNode} from 'react';
import {Field,type FieldControlProps} from '../design-system/components/Field';

export type RecordFormNotice={kind:'error'|'saving'|'applied';message:string};

/** Shared validated field for record editors; controls keep their existing handlers. */
export function RecordEditField({label,required=false,error,help,children}:{
 label:string;required?:boolean;error?:string;help?:string;
 children:(props:FieldControlProps)=>ReactNode;
}){
 return <Field className="ss-record-edit-field" label={label} required={required}
   help={help} error={error}>{children}</Field>;
}

/** Applied is intentionally not called cloud-synced: the record repository may
 * still be queued for network persistence after the local mutation returns.
 */
export function RecordFormFeedback({notice,className=''}:{
 notice?:RecordFormNotice|null;className?:string;
}){
 if(!notice)return null;
 return <p className={('ss-record-form-feedback ss-record-form-feedback--'+notice.kind+' '+className).trim()}
   role={notice.kind==='error'?'alert':'status'}
   aria-live={notice.kind==='error'?'assertive':'polite'}
   aria-atomic="true">
   <span aria-hidden="true">{notice.kind==='error'?'!':notice.kind==='saving'?'…':'✓'}</span>
   <span>{notice.message}</span>
 </p>;
}
export const RECORD_CHANGE_APPLIED_MESSAGE='Changes applied in SalesShop. Cloud sync, if enabled, may still be pending.';
export const RECORD_ADDED_MESSAGE='Record added in SalesShop. Cloud sync, if enabled, may still be pending.';

/** Unlike silent numeric guard returns, these messages explain what needs fixing. */
export function nonnegativeFieldError(value:string,label:string,max?:number){
 if(!value.trim())return '';
 const n=Number(value);
 if(!Number.isFinite(n)||n<0)return label+' must be zero or greater.';
 if(max!==undefined&&n>max)return label+' cannot exceed '+max+'.';
 return '';
}

/** Mirrors basic email input validity without requiring a filled-in address. */
export function recordEmailError(value:string){
 if(!value.trim())return '';
 return /^[^\s@]+@[^\s@]+$/.test(value.trim())?'':'Enter a valid email address.';
}
