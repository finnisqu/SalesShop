import {useEffect,useState,type FormEvent} from 'react';
import {useCrmStore} from '../store/crmStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {OUR_ORG_GROUPS,ensureOurOrgCompany,ourOrgGroup,ourOrgPeople,type RosterGroup}
 from '../services/ourOrganizationDirectory';
import '../our-organization.css';

interface Draft{name:string;email:string;phone:string;title:string;group:RosterGroup;}
const empty=(group:RosterGroup):Draft=>({name:'',email:'',phone:'',title:'',group});
export function OurOrganizationDirectory({onOpenPerson,query,createRequest,onCreateConsumed}:{
 onOpenPerson:(id:string)=>void;query:string;createRequest:number;
 onCreateConsumed:()=>void;
}){
 const companies=useCrmStore(s=>s.companies);
 const contacts=useCrmStore(s=>s.contacts);
 const resolveCompany=useCrmStore(s=>s.resolveCompany);
 const updateCompany=useCrmStore(s=>s.updateCompany);
 const createContact=useCrmStore(s=>s.createContact);
 const updateContact=useCrmStore(s=>s.updateContact);
 const mode=useAuthStore(s=>s.mode),role=useAuthStore(s=>s.teamRole);
 const department=useAuthStore(s=>s.teamDepartment);
 const orgId=useAuthStore(s=>s.organizationId),userId=useAuthStore(s=>s.user?.id);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const editable=!perspective&&(mode==='local'||Boolean(orgId&&userId&&
  canEditTeamArea(role,department,'crm')));
 const [group,setGroup]=useState<RosterGroup>('employees');
 const [editingId,setEditingId]=useState<string|null>(null);
 const [showEditor,setShowEditor]=useState(false);
 const [draft,setDraft]=useState<Draft>(()=>empty('employees'));
 const [error,setError]=useState('');
 const records=ourOrgPeople(contacts,companies,group).filter(c=>
  [c.name,c.title,c.email,c.phone].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
 const count=(name:RosterGroup)=>ourOrgPeople(contacts,companies,name).length;
 useEffect(()=>{
  if(!createRequest||!editable)return;
  setDraft(empty(group));setEditingId(null);setShowEditor(true);setError('');
  onCreateConsumed();
 },[createRequest,editable,group,onCreateConsumed]);
 const beginEdit=(contactId:string)=>{
  const person=contacts.find(c=>c.id===contactId);if(!person)return;
  const current=companies.find(c=>c.id===person.companyId);
  setDraft({name:person.name,email:person.email??'',phone:person.phone??'',
    title:person.title??'',group:current?ourOrgGroup(current)??group:group});
  setEditingId(contactId);setShowEditor(true);setError('');
 };
 const save=(event:FormEvent)=>{
  event.preventDefault();
  if(!editable)return;
  if(!draft.name.trim()){setError('Enter a name.');return;}
  const same=contacts.find(c=>c.id!==editingId&&
   ((draft.email.trim()&&c.email?.toLowerCase()===draft.email.trim().toLowerCase())||
    (c.name.trim().toLowerCase()===draft.name.trim().toLowerCase()&&
     companies.some(company=>company.id===c.companyId&&ourOrgGroup(company)===draft.group))));
  if(same){setError('A person with this name or email already exists. Check the directory first.');return;}
  setError('');
  try{
   const companyId=ensureOurOrgCompany(draft.group,companies,resolveCompany,updateCompany);
   if(editingId)updateContact(editingId,{name:draft.name.trim(),email:draft.email.trim(),
     phone:draft.phone.trim(),title:draft.title.trim(),companyId});
   else{
    const id=createContact({name:draft.name.trim(),email:draft.email.trim(),phone:draft.phone.trim(),
     title:draft.title.trim(),companyId,source:'manual'});
    if(!id)throw new Error('Could not create this person.');
   }
   setShowEditor(false);setEditingId(null);setDraft(empty(group));
  }catch(e){setError(e instanceof Error?e.message:'Unable to save the roster entry.');}
 };
 return <section className="our-org-directory">
  <div className="our-org-heading">
   <div><h2>Our Organization</h2>
    <p>Employees and subcontractors. Separate from customer and partner contacts; not a Team login directory.</p>
   </div>
   {editable&&<span className="our-org-heading-note">Use + Person in the header to add someone.</span>}
  </div>
  <div className="our-org-tabs" role="group" aria-label="Internal people type">
   {OUR_ORG_GROUPS.map(item=><button type="button" key={item.id}
    aria-pressed={group===item.id} onClick={()=>{setGroup(item.id);setShowEditor(false);setError('');}}>
    {item.title} <span>{count(item.id)}</span></button>)}
  </div>
  {showEditor&&editable&&<form className="our-org-form" onSubmit={save}>
   <div className="our-org-form-title"><strong>{editingId?'Edit':'Add'} person</strong>
    <button type="button" onClick={()=>{setShowEditor(false);setError('');}}>Cancel</button></div>
   <label>Name<input autoFocus required maxLength={180} value={draft.name}
    onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></label>
   <label>Relationship<select value={draft.group} onChange={e=>setDraft(d=>({...d,group:e.target.value as RosterGroup}))}>
    {OUR_ORG_GROUPS.map(item=><option key={item.id} value={item.id}>{item.title.slice(0,-1)}</option>)}
   </select></label>
   <label>Role / trade<input value={draft.title} maxLength={120}
    placeholder="Project Manager, Installer, Electrical…" onChange={e=>setDraft(d=>({...d,title:e.target.value}))}/></label>
   <label>Email<input type="email" value={draft.email} onChange={e=>setDraft(d=>({...d,email:e.target.value}))}/></label>
   <label>Phone<input type="tel" value={draft.phone} onChange={e=>setDraft(d=>({...d,phone:e.target.value}))}/></label>
   {error&&<p role="alert" className="our-org-error">{error}</p>}
   <div className="our-org-form-actions"><button type="submit">Save person</button></div>
  </form>}
  <div className="our-org-table-scroll" role="region" aria-label={group+' directory'} tabIndex={0}>
   <table className="our-org-table"><thead><tr>
    <th>Person</th><th>Role / trade</th><th>Email</th><th>Phone</th><th>Actions</th>
   </tr></thead><tbody>
    {records.map(person=><tr key={person.id}>
     <th scope="row"><button type="button" className="our-org-person" onClick={()=>onOpenPerson(person.id)}>{person.name}</button></th>
     <td>{person.title??'—'}</td>
     <td>{person.email?<a href={'mailto:'+person.email}>{person.email}</a>:'—'}</td>
     <td>{person.phone?<a href={'tel:'+person.phone}>{person.phone}</a>:'—'}</td>
     <td>{editable&&<button type="button" onClick={()=>beginEdit(person.id)}>Edit</button>}</td>
    </tr>)}
   </tbody></table>
  </div>
  {!records.length&&<p className="our-org-empty">{query?'No people match this search.':'No '+group+' added yet.'}</p>}
  <p className="our-org-footnote">Stored as shared CRM people and tagged internal directory records. These entries do not grant SalesShop access or change Team permissions.</p>
 </section>;
}
