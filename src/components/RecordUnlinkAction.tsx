import {useState} from 'react';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import type {RelatedEntityKind,RelatedTarget} from './RecordRelatedActions';

/** Explicit links only. Historical Activities and issued/signed Quote snapshots
 * are never changed by a relationship unlink from a record page. */
export function RecordUnlinkAction({source,target}:{
 source:{kind:RelatedEntityKind;id:string;name:string};
 target:{kind:RelatedTarget;id:string;name:string};
}){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  dept=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const canEdit=!perspective&&(mode==='local'||Boolean(org&&user&&canEditTeamArea(role,dept,'crm')));
 const canEditQuote=mode==='local'||Boolean(org&&user&&canEditTeamArea(role,dept,'quotes'));
 const updateContact=useCrmStore(s=>s.updateContact);
 const setProjectCompany=useCrmStore(s=>s.setProjectCompany);
 const updateQuote=useQuoteStore(s=>s.updateQuote);
 const companies=useCrmStore(s=>s.companies);
 const people=useCrmStore(s=>s.contacts);
 const deals=useCrmStore(s=>s.projects);
 const quotes=useQuoteStore(s=>s.quotes);
 const [error,setError]=useState('');
 const person=people.find(p=>p.id===(source.kind==='person'?source.id:target.kind==='person'?target.id:''));
 const deal=deals.find(d=>d.id===(source.kind==='deal'?source.id:target.kind==='deal'?target.id:''));
 const quote=quotes.find(q=>q.id===target.id);
 const editableQuote=Boolean(quote&&!quote.archivedAt&&['Draft','Ready'].includes(quote.status)&&
  (mode!=='cloud'||quote.ownerUserId===user)&&canEditQuote);
 const direct=
  source.kind==='company'&&target.kind==='person'?person?.companyId===source.id:
  source.kind==='company'&&target.kind==='deal'?deal?.companyId===source.id:
  source.kind==='company'&&target.kind==='quote'?quote?.companyId===source.id:
  source.kind==='person'&&target.kind==='company'?person?.companyId===target.id:
  source.kind==='person'&&target.kind==='quote'?quote?.contactId===source.id:
  source.kind==='deal'&&target.kind==='company'?deal?.companyId===target.id:
  source.kind==='deal'&&target.kind==='quote'?quote?.projectId===source.id:false;
 // Roster membership is a separate internal organization identity, not a
 // disposable customer-to-company association.
 const internal=person&&companies.some(c=>c.id===person.companyId&&c.aliases?.includes('__ss_our_company_self_v1__'));
 const safe=Boolean(direct&&canEdit&&
  !(target.kind==='person'&&internal)&&
  (target.kind!=='quote'||editableQuote));
 if(!safe)return null;
 const unlink=()=>{
  if(!window.confirm('Unlink '+target.name+' from '+source.name+'?\n\nThe record, logged Activities, and previously issued Quotes will be preserved.'))return;
  setError('');
  try{
   if(source.kind==='company'&&target.kind==='person')updateContact(target.id,{companyId:undefined});
   else if(source.kind==='company'&&target.kind==='deal')setProjectCompany(target.id,undefined);
   else if(source.kind==='person'&&target.kind==='company')updateContact(source.id,{companyId:undefined});
   else if(source.kind==='deal'&&target.kind==='company')setProjectCompany(source.id,undefined);
   else if(target.kind==='quote'&&quote){
    if(!editableQuote)throw new Error('Issued and archived Quotes are immutable.');
    if(source.kind==='company')updateQuote(target.id,{companyId:undefined,companyName:undefined});
    else if(source.kind==='person')updateQuote(target.id,{contactId:undefined,contactName:undefined,contactEmail:undefined});
    else if(source.kind==='deal')updateQuote(target.id,{projectId:undefined});
   }else throw new Error('This link must be edited in its source record.');
  }catch(e){setError(e instanceof Error?e.message:'Could not unlink this record.');}
 };
 return <span className="ss-record-unlink-control">
  <button type="button" className="ss-record-unlink-button"
    aria-label={'Unlink '+target.name+' from '+source.name}
    title="Remove link, keep records and history" onClick={unlink}>Unlink</button>
  {error&&<small role="alert" className="ss-record-unlink-error">{error}</small>}
 </span>;
}
