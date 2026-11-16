import {useId,useState} from 'react';
import {
 activeCrmFieldsForRecord,applyCrmFieldInput,formatCrmFieldInput,
 type CrmCustomFieldValues,
} from '../services/crmFieldEditor352d1';
import {CRM_FIELD_VISIBILITIES,
 type CrmCustomField,type CrmFieldTarget} from '../services/crmFieldBlueprint352b';

/** Controlled, typed controls shared by the blueprint sample and eventual
 * real CRM editors. This component has NO persistence or Supabase access.
 * A future save handler must honor onValidityChange before submitting. */
export function CrmCustomFieldEditor({fields,target,values,onChange,disabled=false,onValidityChange}:{
 fields:readonly CrmCustomField[];
 target:CrmFieldTarget;
 values:CrmCustomFieldValues;
 onChange:(next:CrmCustomFieldValues)=>void;
 disabled?:boolean;
 onValidityChange?:(errors:Record<string,string>)=>void;
}){
 const prefix=useId();
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [errors,setErrors]=useState<Record<string,string>>({});
 const available=activeCrmFieldsForRecord(fields,target);
 const edit=(field:CrmCustomField,raw:string)=>{
  if(disabled)return;
  setDrafts(current=>({...current,[field.id]:raw}));
  const result=applyCrmFieldInput(values,field,raw);
  const nextErrors={...errors};
  if(result.valid)delete nextErrors[field.id];
  else nextErrors[field.id]=result.error;
  setErrors(nextErrors);
  onValidityChange?.(nextErrors);
  if(result.valid)onChange(result.values);
 };
 const endEdit=(id:string)=>{
  if(errors[id])return;
  setDrafts(current=>{
   if(!(id in current))return current;
   const next={...current};delete next[id];return next;
  });
 };
 if(!available.length){
  return <p className="crm-custom-field-empty">
   No active custom fields are defined for this record type.
  </p>;
 }
 return <div className="crm-custom-field-editor" aria-label="Custom record fields">
  {available.map(field=>{
   const id=prefix+'-'+field.id;
   const value=drafts[field.id]??formatCrmFieldInput(values[field.id]??null);
   const error=errors[field.id];
   const controls={
    id,disabled,'aria-invalid':Boolean(error),
    'aria-describedby':error?id+'-error':field.description?id+'-description':undefined,
   } as const;
   return <div className="crm-custom-field-control" key={field.id}>
    <label htmlFor={id}>{field.label}</label>
    {field.type==='choice'?<select {...controls} value={value}
      onChange={event=>edit(field,event.target.value)}
      onBlur={()=>endEdit(field.id)}>
      <option value="">Not selected</option>
      {(field.options??[]).map(option=>
       <option key={option} value={option}>{option}</option>)}
     </select>:field.type==='boolean'?<select {...controls} value={value}
      onChange={event=>edit(field,event.target.value)}
      onBlur={()=>endEdit(field.id)}>
      <option value="">Not selected</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
     </select>:<input {...controls}
      type={field.type==='date'?'date':'text'}
      inputMode={field.type==='number'?'decimal':undefined}
      maxLength={field.type==='text'?500:undefined}
      placeholder={field.type==='number'?'Enter a number':field.type==='text'?'Optional':undefined}
      value={value}
      onChange={event=>edit(field,event.target.value)}
      onBlur={()=>endEdit(field.id)}/>}
    {field.description&&<small id={id+'-description'}>{field.description}</small>}
    {error&&<small className="crm-custom-field-error"
      id={id+'-error'} role="alert">{error}</small>}
    <small className="crm-custom-field-visibility">
     {CRM_FIELD_VISIBILITIES.find(item=>item.id===field.visibility)?.label??
      'CRM editors and admins'}
    </small>
   </div>;
  })}
 </div>;
}
