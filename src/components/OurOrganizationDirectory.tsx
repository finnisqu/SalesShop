import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useCrmStore} from '../store/crmStore';
import {ConnectionsTable} from './ConnectionsTable';
import {useNavigationStore} from '../store/navigationStore';
import {isOurCompany} from '../services/companyRelationship';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {OUR_ORG_GROUPS,ensureOurOrgCompany,ourOrgGroup,ourOrgPeople,ourOrgRoles,
 rosterGroupForContact,ourOrgMemberMarker,ourOrgRoleMarker,type RosterGroup}
 from '../services/ourOrganizationDirectory';
import '../our-organization.css';

interface Draft{name:string;email:string;phone:string;title:string;group:RosterGroup;companyName:string;}
const empty=(group:RosterGroup):Draft=>({name:'',email:'',phone:'',title:'',group,companyName:''});
export function OurOrganizationDirectory({onOpenPerson,query,createRequest,onCreateConsumed}:{
 onOpenPerson:(id:string)=>void;query:string;createRequest:number;
 onCreateConsumed:()=>void;
}){
 const companies=useCrmStore(s=>s.companies);
 const openCompany=useNavigationStore(s=>s.openCompany);
 const ownCompany=companies.find(isOurCompany);
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
 const formRef=useRef<HTMLFormElement>(null);
 useEffect(()=>{
  if(!showEditor)return;
  const frame=window.requestAnimationFrame(()=>formRef.current?.scrollIntoView({block:'start',behavior:'smooth'}));
  return()=>window.cancelAnimationFrame(frame);
 },[showEditor,editingId]);
 const [draft,setDraft]=useState<Draft>(()=>empty('employees'));
 const [error,setError]=useState('');
 const [roleCreating,setRoleCreating]=useState(false);
 const [newRole,setNewRole]=useState('');
 const roles=ourOrgRoles(contacts,companies,draft.group);
 const records=ourOrgPeople(contacts,companies,group).filter(c=>
  [c.name,c.title,c.email,c.phone,
    companies.find(company=>company.id===c.companyId&&!ourOrgGroup(company))?.name??'']
   .join(' ').toLowerCase().includes(query.trim().toLowerCase()));
 const count=(name:RosterGroup)=>ourOrgPeople(contacts,companies,name).length;
 useEffect(()=>{
  if(!createRequest||!editable)return;
  setDraft(empty(group));setEditingId(null);setShowEditor(true);setError('');
  setRoleCreating(false);setNewRole('');
  onCreateConsumed();
 },[createRequest,editable,group,onCreateConsumed]);
 const beginEdit=(contactId:string)=>{
  const person=contacts.find(c=>c.id===contactId);if(!person)return;
  const current=companies.find(c=>c.id===person.companyId);
  const category=rosterGroupForContact(person,companies)??group;
  setDraft({name:person.name,email:person.email??'',phone:person.phone??'',
    title:person.title??'',group:category,
    companyName:category==='subcontractors'&&current&&!ourOrgGroup(current)?current.name:''});
  setRoleCreating(false);setNewRole('');
  setEditingId(contactId);setShowEditor(true);setError('');
 };
 const save=(event:FormEvent)=>{
  event.preventDefault();
  if(!editable)return;
  if(!draft.name.trim()){setError('Enter a name.');return;}
  const same=contacts.find(c=>c.id!==editingId&&
   ((draft.email.trim()&&c.email?.toLowerCase()===draft.email.trim().toLowerCase())||
    (c.name.trim().toLowerCase()===draft.name.trim().toLowerCase()&&
     rosterGroupForContact(c,companies)===draft.group)));
  if(same){setError('A person with this name or email already exists. Check the directory first.');return;}
  setError('');
  try{
   const groupId=ensureOurOrgCompany(draft.group,useCrmStore.getState().companies,resolveCompany,updateCompany);
   let companyId=groupId;
   // People belong to Our Organization by membership, while a subcontractor's
   // actual company remains a normal, linkable non-customer CRM Company.
   if(draft.group==='subcontractors'&&draft.companyName.trim()){
    const name=draft.companyName.trim();
    const resolved=resolveCompany(name,'non-customer');
    if(!resolved)throw new Error('Could not link the subcontractor company.');
    if(useCrmStore.getState().companies.some(c=>c.id===resolved&&ourOrgGroup(c)))
      throw new Error('Choose a subcontractor company outside Our Organization.');
    companyId=resolved;
   }
   const personId=editingId??createContact({name:draft.name.trim(),email:draft.email.trim(),
     phone:draft.phone.trim(),title:draft.title.trim(),companyId,source:'manual'});
   if(!personId)throw new Error('Could not create this person.');
   if(editingId)updateContact(editingId,{name:draft.name.trim(),email:draft.email.trim(),
     phone:draft.phone.trim(),title:draft.title.trim(),companyId});
   const saved=useCrmStore.getState().companies;
   const sub=saved.find(c=>ourOrgGroup(c)==='subcontractors');
   const marker=ourOrgMemberMarker(personId);
   if(sub){
    const existing=new Set(sub.aliases??[]);
    if(draft.group==='subcontractors'&&companyId!==groupId)existing.add(marker);
    else existing.delete(marker);
    if(existing.size!==(sub.aliases??[]).length)
      updateCompany(sub.id,{aliases:[...existing]});
   }
   setShowEditor(false);setEditingId(null);setGroup(draft.group);setDraft(empty(draft.group));
  }catch(e){setError(e instanceof Error?e.message:'Unable to save the roster entry.');}
 };
 const addRole=()=>{
  if(!editable)return;
  const role=newRole.trim();
  if(!role||role.length>120){setError('Enter a role under 120 characters.');return;}
  if(roles.some(item=>item.toLowerCase()===role.toLowerCase())){
   setError('That role already exists. Select it above.');return;
  }
  try{
   const id=ensureOurOrgCompany(draft.group,useCrmStore.getState().companies,resolveCompany,updateCompany);
   const existing=useCrmStore.getState().companies.find(c=>c.id===id);
   updateCompany(id,{aliases:[...new Set([...(existing?.aliases??[]),ourOrgRoleMarker(role)])]});
   setDraft(d=>({...d,title:role}));setRoleCreating(false);setNewRole('');setError('');
  }catch(e){setError(e instanceof Error?e.message:'Could not add role.');}
 };
 return <section className="our-org-directory">
  <div className="our-org-heading">
   <div><h2>Our Organization</h2>
    <p>Employees and subcontractors. Separate from customer and partner contacts; not a Team login directory.</p>
   </div>
   <div className="our-org-heading-actions">
    {ownCompany&&<button type="button" className="our-org-self-company-link"
       onClick={()=>openCompany(ownCompany.id)}>
       View {ownCompany.name} · SELF ↗</button>}
    {editable&&<span className="our-org-heading-note">Use + Person in the header to add someone.</span>}
   </div>
  </div>
  <div className="our-org-tabs" role="group" aria-label="Internal people type">
   {OUR_ORG_GROUPS.map(item=><button type="button" key={item.id}
    aria-pressed={group===item.id} onClick={()=>{setGroup(item.id);setShowEditor(false);setError('');}}>
    {item.title} <span>{count(item.id)}</span></button>)}
  </div>
  {showEditor&&editable&&<form ref={formRef} className="our-org-form" onSubmit={save}>
   <div className="our-org-form-title"><strong>{editingId?'Edit':'Add'} person</strong>
    <button type="button" onClick={()=>{setShowEditor(false);setError('');}}>Cancel</button></div>
   <label>Name<input required maxLength={180} value={draft.name}
    onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></label>
   <label>Relationship<select value={draft.group} onChange={e=>setDraft(d=>({...d,group:e.target.value as RosterGroup,title:''}))}>
    {OUR_ORG_GROUPS.map(item=><option key={item.id} value={item.id}>{item.title.slice(0,-1)}</option>)}
   </select></label>
   <label>Role / trade
    <select value={draft.title} onChange={e=>{
      if(e.target.value==='__add_role__'){setRoleCreating(true);setNewRole('');}
      else{setRoleCreating(false);setDraft(d=>({...d,title:e.target.value}));}
    }}>
     <option value="">Select role</option>
     {draft.title&&!roles.includes(draft.title)&&<option value={draft.title}>{draft.title}</option>}
     {roles.map(item=><option key={item} value={item}>{item}</option>)}
     <option value="__add_role__">+ Add role…</option>
    </select>
   </label>
   {roleCreating&&<div className="our-org-inline-option" role="group" aria-label="Add role option">
    <input type="text" value={newRole} maxLength={120} placeholder="New role or trade"
     onChange={e=>setNewRole(e.target.value)}
     onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();addRole();}}}/>
    <button type="button" disabled={!newRole.trim()} onClick={addRole}>+ Save role</button>
    <button type="button" onClick={()=>setRoleCreating(false)}>Cancel</button>
   </div>}
   {draft.group==='subcontractors'&&<label>Subcontractor company
    <input value={draft.companyName} maxLength={180}
     placeholder="Company / trade firm" onChange={e=>setDraft(d=>({...d,companyName:e.target.value}))}/>
   </label>}
   <label>Email<input type="email" value={draft.email} onChange={e=>setDraft(d=>({...d,email:e.target.value}))}/></label>
   <label>Phone<input type="tel" value={draft.phone} onChange={e=>setDraft(d=>({...d,phone:e.target.value}))}/></label>
   {error&&<p role="alert" className="our-org-error">{error}</p>}
   <div className="our-org-form-actions"><button type="submit">Save person</button></div>
  </form>}
  <ConnectionsTable tableKey="organization" onOpen={onOpenPerson}
   onRecordEdit={editable?beginEdit:undefined}
   columns={[
    {key:'name',label:'Person'},{key:'role',label:'Role / trade'},
    {key:'company',label:'Company'},{key:'email',label:'Email'},{key:'phone',label:'Phone'}
   ]}
   rows={records.map(person=>({
    id:person.id,name:person.name,
    values:{name:person.name,role:person.title||'—',
     company:group==='subcontractors'
      ?companies.find(item=>item.id===person.companyId&&!ourOrgGroup(item))?.name||'—'
      :ownCompany?.name||'Our Organization',
     email:person.email||'—',phone:person.phone||'—'}
   }))}/>
  <div className="our-org-mobile-cards" aria-label={group+' mobile directory'}>
   {records.map(person=><article key={person.id} className="connections-mobile-record-group">
    <button type="button" className="connections-record" onClick={()=>onOpenPerson(person.id)}>
     <span className="connections-record-eyebrow">{person.title||(group==='employees'?'Employee':'Subcontractor')}</span>
     <strong>{person.name}</strong>
     <small>{[
      group==='subcontractors'?companies.find(item=>item.id===person.companyId&&!ourOrgGroup(item))?.name:undefined,
      person.email,person.phone
     ].filter(Boolean).join(' · ')||'Open person'}</small>
    </button>
    {editable&&<button type="button" className="connections-mobile-top-action"
      onClick={()=>beginEdit(person.id)} aria-label={'Edit '+person.name}>Edit</button>}
   </article>)}
  </div>
  {!records.length&&<p className="our-org-empty">{query?'No people match this search.':'No '+group+' added yet.'}</p>}
  <p className="our-org-footnote">Stored as shared CRM people and tagged internal directory records. These entries do not grant SalesShop access or change Team permissions.</p>
 </section>;
}
