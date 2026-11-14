import {useEffect,useRef,useState,type ReactNode,type FormEvent} from 'react';
import {useRecordInlineEditScope} from './RecordInlineEditScope';
import {MOBILE_SHEET_MEDIA_QUERY} from '../lib/mobileSheetViewport';
import {recordInlineScrollDelta} from '../services/recordInlineViewport';
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
 const formRef=useRef<HTMLFormElement>(null);
 const restoreFocus=useRef(false);
 const {id,activeId,claim,release}=useRecordInlineEditScope();
 const anotherFieldEditing=activeId!==null&&activeId!==id;
 // This editor must relinquish the shared lock on unmount (e.g. when a
 // conditional Account forecast panel disappears during a saved change).
 useEffect(()=>()=>release?.(id),[id,release]);
 // Permission/perspective changes must not leave a previously opened
 // inline field actionable after its editing rights were withdrawn.
 useEffect(()=>{
  if(disabled&&editing&&!saving){
   restoreFocus.current=false;
   setEditing(false);setDraft(value);setError('');
   release?.(id);
  }
 },[disabled,editing,saving,value,release,id]);
 useEffect(()=>{if(!editing)setDraft(value);},[value,editing]);
 // On mobile Safari the keyboard can open AFTER autofocus, shrinking the
 // visual viewport. Keep the active inline field above the keyboard without
 // scrolling the entire Record when no field has focus.
 useEffect(()=>{
  if(!editing||!window.matchMedia?.(MOBILE_SHEET_MEDIA_QUERY).matches)return;
  const control=formRef.current?.querySelector<HTMLInputElement|HTMLSelectElement>('input,select');
  if(!control)return;
  const visual=window.visualViewport;
  const ensureVisible=()=>{
   if(document.activeElement!==control)return;
   const rect=control.getBoundingClientRect();
   const delta=recordInlineScrollDelta(rect,{
    top:visual?.offsetTop??0,height:visual?.height??window.innerHeight,
   });
   if(!delta)return;
   let parent:HTMLElement|null=control.parentElement;
   while(parent){
    const overflow=window.getComputedStyle(parent).overflowY;
    if((overflow==='auto'||overflow==='scroll')&&parent.scrollHeight>parent.clientHeight+2)break;
    parent=parent.parentElement;
   }
   if(parent)parent.scrollTop+=delta;
   else window.scrollBy({top:delta,behavior:'auto'});
  };
  const frame=window.requestAnimationFrame(ensureVisible);
  visual?.addEventListener('resize',ensureVisible);
  visual?.addEventListener('scroll',ensureVisible);
  window.addEventListener('resize',ensureVisible);
  return()=>{
   window.cancelAnimationFrame(frame);
   visual?.removeEventListener('resize',ensureVisible);
   visual?.removeEventListener('scroll',ensureVisible);
   window.removeEventListener('resize',ensureVisible);
  };
 },[editing]);
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
  release?.(id);
 };
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(saving||disabled)return;
  const message=validate?.(draft);
  if(message){setError(message);return;}
  setSaving(true);setError('');
  try{await onSave(draft);restoreFocus.current=true;setEditing(false);release?.(id);}
  catch(e){setError(e instanceof Error?e.message:'Unable to update '+label);}
  finally{setSaving(false);}
 };
 return <div className={'connections-record-property ss-record-inline-property'+(editing?' is-editing':'')}>
  <span>{label}</span>
  {!editing?<div className="ss-record-inline-value">
   <strong>{display??(value||placeholder)}</strong>
   {!disabled&&<button ref={pencilRef} type="button" className="ss-record-pencil"
     disabled={anotherFieldEditing} aria-label={'Edit '+label}
     title={anotherFieldEditing?'Finish or cancel the current field edit first':'Edit '+label}
     onClick={()=>{
      if(claim&&!claim(id))return;
      setDraft(value);setError('');setEditing(true);
     }}>
     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 4 4 4-11 11-5 1 1-5L16 4Z"/><path d="m14 6 4 4"/>
     </svg>
   </button>}
  </div>:<form ref={formRef} className="ss-record-inline-editor" aria-busy={saving}
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
