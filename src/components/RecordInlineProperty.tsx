import {useEffect,useState,type ReactNode,type FormEvent} from 'react';
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
 useEffect(()=>{if(!editing)setDraft(value);},[value,editing]);
 const close=()=>{setEditing(false);setDraft(value);setError('');};
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(saving)return;
  const message=validate?.(draft);
  if(message){setError(message);return;}
  setSaving(true);setError('');
  try{await onSave(draft);setEditing(false);}
  catch(e){setError(e instanceof Error?e.message:'Unable to update '+label);}
  finally{setSaving(false);}
 };
 return <div className={'connections-record-property ss-record-inline-property'+(editing?' is-editing':'')}>
  <span>{label}</span>
  {!editing?<div className="ss-record-inline-value">
   <strong>{display??(value||placeholder)}</strong>
   {!disabled&&<button type="button" className="ss-record-pencil" aria-label={'Edit '+label}
     title={'Edit '+label} onClick={()=>{setDraft(value);setError('');setEditing(true);}}>
     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 4 4 4-11 11-5 1 1-5L16 4Z"/><path d="m14 6 4 4"/>
     </svg>
   </button>}
  </div>:<form className="ss-record-inline-editor" onSubmit={event=>void submit(event)}>
    {type==='select'?<select aria-label={label} value={draft} disabled={saving}
      onChange={event=>setDraft(event.target.value)}>
      {options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
    </select>:<input autoFocus aria-label={label} type={type} value={draft}
      disabled={saving} onChange={event=>{setDraft(event.target.value);setError('');}}
      onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();close();}}}
      {...(type==='number'?{step:'any',min:'0'}:{})}/>}
    <button type="submit" disabled={saving} aria-label={'Save '+label}>✓</button>
    <button type="button" disabled={saving} aria-label={'Cancel '+label} onClick={close}>×</button>
    {error&&<small role="alert">{error}</small>}
  </form>}
 </div>;
}
