import type {Company} from '../types/crm';
import {companyAnnualPotential,companyEstimatedAnnualWork} from '../types/crm';
import {useCrmStore} from '../store/crmStore';
import {RecordInlineProperty} from './RecordInlineProperty';
import {RecordProperty} from './RecordPageLayout';

const fmt=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
function parseField(value:string,label:string,{max,integer=false}:{max?:number;integer?:boolean}={}){
 const s=value.trim();if(!s)return undefined;
 const n=Number(s);
 if(!Number.isFinite(n)||n<0||(max!==undefined&&n>max)||(integer&&!Number.isInteger(n)))
  throw new Error(label+' must be '+(integer?'a whole':'a valid')+' number'+
    (max===undefined?' of zero or greater':' between zero and '+max)+'.');
 return n;
}
function fieldError(value:string,label:string,options:{max?:number;integer?:boolean}={}){
 try{parseField(value,label,options);return undefined;}
 catch(error){return error instanceof Error?error.message:'Invalid value.';}
}
/** Identical property row and inline editor treatment as Company About. */
export function CompanyForecastEditor375({company,canEdit}:{company:Company;canEdit:boolean}){
 const updateCompany=useCrmStore(s=>s.updateCompany);
 const potential=companyAnnualPotential(company);
 const expected=companyEstimatedAnnualWork(company);
 return <section className="ss-record-forecast" aria-label="Company account forecast">
  <div className="connections-record-properties-list">
   <RecordInlineProperty label="Annual units" type="number"
    value={company.annualUnits?.toString()??''} disabled={!canEdit}
    validate={value=>fieldError(value,'Annual units',{integer:true})}
    onSave={value=>updateCompany(company.id,{annualUnits:parseField(value,'Annual units',{integer:true})})}/>
   <RecordInlineProperty label="Revenue / unit" type="number"
    value={company.averageUnitValue?.toString()??''}
    display={company.averageUnitValue===undefined?'Not set':fmt.format(company.averageUnitValue)}
    disabled={!canEdit} validate={value=>fieldError(value,'Revenue per unit')}
    onSave={value=>updateCompany(company.id,{averageUnitValue:parseField(value,'Revenue per unit')})}/>
   <RecordInlineProperty label="Expected share (%)" type="number"
    value={company.expectedSharePct?.toString()??''}
    display={company.expectedSharePct===undefined?'Not set':company.expectedSharePct+'%'}
    disabled={!canEdit} validate={value=>fieldError(value,'Expected share (%)',{max:100})}
    onSave={value=>updateCompany(company.id,{expectedSharePct:parseField(value,'Expected share (%)',{max:100})})}/>
   <RecordProperty label="Annual potential">{potential===undefined?'Not set':fmt.format(potential)}</RecordProperty>
   <RecordProperty label="Expected annual work">{expected===undefined?'Not set':fmt.format(expected)}</RecordProperty>
  </div>
 </section>;
}
