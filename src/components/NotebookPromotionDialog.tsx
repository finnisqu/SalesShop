import {useState,type FormEvent} from 'react';
import {usePersonalTaskStore,taskScope,type TaskChanges} from '../store/personalTaskStore';
import {useAuthStore} from '../store/authStore';
import {useCrmStore} from '../store/crmStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {TaskEditor} from './TasksWorkspace';
const titleFor={task:'Task',touchpoint:'Touchpoint',deal:'Deal',contact:'Person',company:'Company'};
export function NotebookPromotionDialog(){
 const draft=usePersonalTaskStore(s=>s.promotion);
 const close=usePersonalTaskStore(s=>s.beginPromotion);
 const createTask=usePersonalTaskStore(s=>s.createTask);
 const scope=usePersonalTaskStore(s=>s.scope);
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId);
 const user=useAuthStore(s=>s.user?.id);
 const role=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 const crm=useCrmStore();
 const [name,setName]=useState('');
 const [companyId,setCompanyId]=useState('');
 const [contactId,setContactId]=useState('');
 const [dealId,setDealId]=useState('');
 const [message,setMessage]=useState('');
 if(!draft||preview)return null;
 const target=draft.target??'task';
 const allowed=mode==='local'||canEditTeamArea(role,department,'crm');
 const taskAllowed=!!scope&&scope===taskScope(mode,org,user);
 if(target==='task'){
   if(!taskAllowed)return <div role="alert" className="tasks-dialog-backdrop"><div className="tasks-editor">
     <p>Your task workspace is still loading. Open Tasks once and retry.</p>
     <button type="button" onClick={()=>close(null)}>Close</button>
   </div></div>;
   return <TaskEditor key={draft.title+':'+(draft.sourceObjectId??'')}
      initial={draft} onCancel={()=>close(null)}
      onSave={(change:TaskChanges&{title:string})=>{createTask(change.title,change);close(null);}}/>;
 }
 const submit=(event:FormEvent)=>{
   event.preventDefault();setMessage('');
   if(!allowed){setMessage('CRM editing is not permitted for this role.');return;}
   const value=(name.trim()||draft.title.trim()).slice(0,240);
   if(!value){setMessage('Enter a name or summary.');return;}
   if(target==='company'){
     const id=crm.resolveCompany(value,'customer');
     if(!id){setMessage('A company with this name may already exist. Review matching records.');return;}
   }else if(target==='contact'){
     const id=crm.createContact({name:value,companyId:companyId||undefined,source:'manual'});
     if(!id){setMessage('Could not create a contact.');return;}
   }else if(target==='deal'){
     const id=crm.createProject(value,'Discovery',{companyName:crm.companies.find(x=>x.id===companyId)?.name,source:'manual'});
     if(!id){setMessage('Could not create a deal.');return;}
   }else if(target==='touchpoint'){
     crm.recordActivity({type:'notebook-touchpoint',summary:value,
       companyId:companyId||undefined,contactId:contactId||undefined,projectId:dealId||undefined,
       metadata:{source:'manual'}});
   }
   close(null);
 };
 return <div className="tasks-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close(null);}}>
   <form className="tasks-editor" role="dialog" aria-modal="true" onSubmit={submit}
     aria-label={'Promote Notebook to '+titleFor[target]}>
     <header><strong>Promote to {titleFor[target]}</strong>
       <button type="button" aria-label="Close" onClick={()=>close(null)}>×</button></header>
     <p className="tasks-editor-source">Source: {draft.sourceLabel??'Notebook'} · Original Notebook content is preserved.</p>
     <label>{target==='touchpoint'?'Interaction summary':'Name'}
       <input autoFocus value={name} onChange={e=>setName(e.target.value)}
         placeholder={draft.title.slice(0,180)} maxLength={240}/></label>
     {target!=='company'&&<label>Related company (optional)
       <select value={companyId} onChange={e=>setCompanyId(e.target.value)}>
         <option value="">No company</option>
         {crm.companies.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
       </select></label>}
     {target==='touchpoint'&&<>
       <label>Related person
         <select value={contactId} onChange={e=>setContactId(e.target.value)}>
           <option value="">No person</option>
           {crm.contacts.filter(c=>!companyId||c.companyId===companyId)
             .map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
         </select>
       </label>
       <label>Related deal
         <select value={dealId} onChange={e=>setDealId(e.target.value)}>
           <option value="">No deal</option>
           {crm.projects.filter(d=>!companyId||d.companyId===companyId)
             .map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
         </select>
       </label>
       <p className="tasks-editor-source">Touchpoints are completed interactions in CRM history, not scheduled Tasks.</p>
     </>}
     {message&&<p role="alert">{message}</p>}
     {!allowed&&<p role="alert">Your role cannot create shared CRM records.</p>}
     <footer><button type="button" onClick={()=>close(null)}>Cancel</button>
       <button type="submit" className="tasks-primary" disabled={!allowed}>Create {titleFor[target]}</button></footer>
   </form>
 </div>;
}
