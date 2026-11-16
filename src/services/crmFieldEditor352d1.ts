import {
 validateCrmCustomFieldValue,
 type CrmCustomField,type CrmFieldTarget,type CrmFieldValue,
} from './crmFieldBlueprint352b';

export type CrmCustomFieldValues=Record<string,CrmFieldValue>;

/** Retain one typed field contract for both sample-record previews and
 * eventual authenticated record editors. This module performs no writes. */
export function activeCrmFieldsForRecord(
 fields:readonly CrmCustomField[],target:CrmFieldTarget,
):CrmCustomField[]{
 return fields.filter(field=>field.target===target&&field.active);
}

/** HTML inputs are text-shaped even for numbers/booleans. Convert values
 * strictly before they reach any future CRM persistence boundary. */
export function parseCrmFieldInput(
 field:CrmCustomField,raw:string,
):{valid:true;value:CrmFieldValue}|{valid:false;error:string}{
 if(raw.trim()==='')return {valid:true,value:null};
 if(field.type==='number'){
  const clean=raw.trim();
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(clean))
   return {valid:false,error:'Enter a valid number for '+field.label+'.'};
  const parsed=Number(clean);
  return validateCrmCustomFieldValue(field,parsed);
 }
 if(field.type==='boolean'){
  if(raw!=='true'&&raw!=='false')
   return {valid:false,error:'Choose Yes, No, or Not selected for '+field.label+'.'};
  return validateCrmCustomFieldValue(field,raw==='true');
 }
 return validateCrmCustomFieldValue(field,raw);
}

export function formatCrmFieldInput(value:CrmFieldValue):string{
 if(value===null)return '';
 if(typeof value==='boolean')return value?'true':'false';
 return String(value);
}

/** A draft never stores invalid values. Returning a fresh object also
 * preserves unrelated, stable field IDs even when the form is reordered. */
export function applyCrmFieldInput(
 values:CrmCustomFieldValues,field:CrmCustomField,raw:string,
):{valid:true;values:CrmCustomFieldValues;value:CrmFieldValue}|
 {valid:false;error:string}{
 if(!field.active)return {valid:false,error:'This field is paused.'};
 const checked=parseCrmFieldInput(field,raw);
 if(!checked.valid)return checked;
 const next={...values};
 if(checked.value===null)delete next[field.id];
 else next[field.id]=checked.value;
 return {valid:true,values:next,value:checked.value};
}

/** Validate every value against its CURRENT field, not the type/options
 * saved in an old form. This is a client preflight only; DB RLS remains
 * mandatory before shared customer values can be stored. */
export function validateCrmFieldForm(
 fields:readonly CrmCustomField[],target:CrmFieldTarget,
 values:CrmCustomFieldValues,
):{valid:true;values:CrmCustomFieldValues}|
 {valid:false;errors:Record<string,string>}{
 const allowed=activeCrmFieldsForRecord(fields,target);
 const sanitized:CrmCustomFieldValues={};
 const errors:Record<string,string>={};
 for(const field of allowed){
  const raw=values[field.id]??null;
  const checked=validateCrmCustomFieldValue(field,raw);
  if(!checked.valid)errors[field.id]=checked.error;
  else if(checked.value!==null)sanitized[field.id]=checked.value;
 }
 if(Object.keys(errors).length)return {valid:false,errors};
 return {valid:true,values:sanitized};
}
