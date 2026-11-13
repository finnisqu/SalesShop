import {useEffect,useRef,useState,type ReactNode,type FormEvent} from 'react';
/** One-at-a-time editing that preserves the About panel's property positions. */
export function RecordInlineProperty({label,value,display,type='text',options,onSave,
 disabled=false,placeholder='Not set',validate}:{
 label:string;value:string;display?:ReactNode;
 type?:'text'|'number'|'date'|'email'|'select';
 options?:readonly {value:string;label:string}[];
 onSave:(value:string)=>void|Promise<void>;
 disabled?:boolean;placeholder?:string;validate?:(value:string)=>string|undefined;
}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(value),
  [saving,setSaving]=useState(false),[error,setError]=useState('');
 const pencilRef=useRef<HTMLButtonElement>(null);
 const restoreFocus=useRef(false);
 useEffect(()=>{if(!editing)setDraft(value);},[value,editing]);
 // Restore keyboard focus to the same property after saving or cancellation,
 // rather than sending Tab navigation back to the start of the record.
 useEffect(()=>{
  if(!editing&&restoreFocus.current){
   restoreFocus.current=false;
   pencilRef.current?.focus({preventScroll:true});
  }
 },[editing]);
 const close=()=>{
  if(saving)return;
  restoreFocus.current=true;setEditing(false);setDraft(value);setError('');
 };
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(saving)return;
  const message=validate?.(draft);
  if(message){setError(message);return;}
  setSaving(true);setError('');
  try{await onSave(draft);restoreFocus.current=true;setEditing(false);}
  catch(e){setError(e instanceof Error?e.message:'Unable to update '+label);}
  finally{setSaving(false);}
 };
 return <div className={'connections-record-property ss-record-inline-property'+(editing?' is-editing':'')}>
  <span>{label}</span>
  {!editing?<div className="ss-record-inline-value">
   <strong>{display??(value||placeholder)}</strong>
   {!disabled&&<button ref={pencilRef} type="button" className="ss-record-pencil" aria-label={'Edit '+label}
     title={'Edit '+label} onClick={()=>{setDraft(value);setError('');setEditing(true);}}>
     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 4 4 4-11 11-5 1 1-5L16 4Z"/><path d="m14 6 4 4"/>
     </svg>
   </button>}
  </div>:<form className="ss-record-inline-editor" aria-busy={saving}
    onSubmit={event=>void submit(event)}
    onKeyDown={event=>{
     // Escape works for both native select and input fields, but must not
     // dismiss the whole record inspector/drawer.
     if(event.key==='Escape'&&!event.defaultPrevented&&!saving){
      event.preventDefault();event.stopPropagation();close();
     }
    }}>
    {type==='select'?<select autoFocus aria-label={label} value={draft} disabled={saving}
      onChange={event=>{setDraft(event.target.value);setError('');}}>
      {options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
    </select>:<input autoFocus aria-label={label} type={type} value={draft}
      disabled={saving} onChange={event=>{setDraft(event.target.value);setError('');}}
      {...(type==='number'?{step:'any',min:'0'}:{})}/>}
    <button type="submit" disabled={saving} aria-label={'Save '+label}>✓</button>
    <button type="button" disabled={saving} aria-label={'Cancel '+label} onClick={close}>×</button>
    {error&&<small role="alert">{error}</small>}
  </form>}
 </div>;
}
