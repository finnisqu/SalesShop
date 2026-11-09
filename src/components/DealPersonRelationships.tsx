import {useEffect,useState} from 'react';
import {useDealPeopleStore,dealPeopleScope} from '../store/dealPeopleStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import type {Contact,Project} from '../types/crm';
import '../deal-person-relationships.css';

function useLinks(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const scope=mode==='cloud'&&!user?null:dealPeopleScope(mode,org);
 const active=useDealPeopleStore(s=>s.scope),loaded=useDealPeopleStore(s=>s.loaded),
  loading=useDealPeopleStore(s=>s.loading),error=useDealPeopleStore(s=>s.error),
  links=useDealPeopleStore(s=>s.links),load=useDealPeopleStore(s=>s.load);
 const add=useDealPeopleStore(s=>s.add),setRole=useDealPeopleStore(s=>s.setRole),
  remove=useDealPeopleStore(s=>s.remove);
 useEffect(()=>{void load(scope);},[load,scope]);
 return {ready:loaded&&active===scope,loading,error,links:active===scope?links:[],
  editable:!perspective&&Boolean(scope)&&(mode==='local'||
    Boolean(user&&org&&canEditTeamArea(role,department,'crm'))),
  add,setRole,remove,retry:()=>void load(scope,true)};
}

export function DealPeopleRelationships({dealId,people,onOpenPerson}:{
 dealId:string;people:readonly Contact[];onOpenPerson:(id:string)=>void;
}){
 const manager=useLinks();
 const [selected,setSelected]=useState(''),[role,setRole]=useState(''),
  [editingRole,setEditingRole]=useState<string|null>(null),[editedRole,setEditedRole]=useState(''),
  [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setSelected('');setRole('');setError('');setEditingRole(null);},[dealId]);
 const direct=manager.links.filter(link=>link.dealId===dealId);
 const linkedIds=new Set(direct.map(link=>link.personId));
 const choices=people.filter(p=>!linkedIds.has(p.id))
  .slice().sort((a,b)=>a.name.localeCompare(b.name));
 const update=async(action:()=>Promise<void>)=>{
  setBusy(true);setError('');
  try{await action();}catch(e){setError(e instanceof Error?e.message:'Unable to update Deal contact.');}
  finally{setBusy(false);}
 };
 return <section className="ss-deal-relations" aria-label="Direct Deal people">
  <div className="ss-deal-relations-heading"><strong>Direct Deal contacts</strong><span>{direct.length}</span></div>
  <p className="connections-record-helper">Shared contact assignments. Link people without creating an Activity or changing a Quote.</p>
  {!manager.ready&&<p role="status" className="connections-record-helper">
   {manager.error?'Unable to load direct links: '+manager.error:'Loading Deal contacts…'}
   {manager.error&&<button type="button" onClick={manager.retry}>Retry</button>}</p>}
  {manager.ready&&<div className="ss-deal-relations-list">
   {direct.map(link=>{
    const person=people.find(p=>p.id===link.personId);
    if(!person)return null;
    const editing=editingRole===person.id;
    return <div key={person.id} className="ss-deal-relations-row">
     <button type="button" className="ss-deal-relations-name"
      onClick={()=>onOpenPerson(person.id)}><strong>{person.name||person.email||'Unnamed person'}</strong>
      <small>{link.role||person.title||'Direct contact'} · Open Person →</small></button>
     {manager.editable&&<div className="ss-deal-relations-row-actions">
      {editing?<><input value={editedRole} aria-label={'Role for '+person.name}
       maxLength={120} onChange={e=>setEditedRole(e.target.value)}/>
       <button type="button" disabled={busy} onClick={()=>void update(async()=>{
        await manager.setRole(dealId,person.id,editedRole);setEditingRole(null);
       })}>Save</button></>:<button type="button"
       onClick={()=>{setEditingRole(person.id);setEditedRole(link.role??'');}}>Role</button>}
      <button type="button" disabled={busy} onClick={()=>{
       if(!window.confirm('Remove '+person.name+' from this Deal? Their Person record and Activities stay intact.'))return;
       void update(()=>manager.remove(dealId,person.id));
      }}>Unlink</button>
     </div>}
    </div>;
   })}
   {!direct.length&&<p className="connections-record-empty">No direct contacts assigned yet.</p>}
  </div>}
  {manager.ready&&manager.editable&&<div className="ss-deal-relations-add">
   <select aria-label="Person to link to Deal" value={selected} disabled={busy}
    onChange={e=>setSelected(e.target.value)}>
    <option value="">Choose a Person…</option>
    {choices.map(person=><option key={person.id} value={person.id}>{person.name||person.email}</option>)}
   </select>
   <input type="text" aria-label="Deal contact role (optional)" value={role} maxLength={120}
    disabled={busy} placeholder="Role (optional)" onChange={e=>setRole(e.target.value)}/>
   <button type="button" disabled={busy||!selected}
    onClick={()=>void update(async()=>{await manager.add(dealId,selected,role);
      setSelected('');setRole('');})}>+ Link Existing Person</button>
  </div>}
  {error&&<p role="alert" className="ss-deal-relations-error">{error}</p>}
 </section>;
}

export function PersonDealRelationships({personId,deals,onOpenDeal}:{
 personId:string;deals:readonly Project[];onOpenDeal:(id:string)=>void;
}){
 const manager=useLinks();
 const [selected,setSelected]=useState(''),[role,setRole]=useState(''),
  [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setSelected('');setRole('');setError('');},[personId]);
 const direct=manager.links.filter(link=>link.personId===personId);
 const known=new Set(direct.map(link=>link.dealId));
 const choices=deals.filter(d=>!known.has(d.id)).slice()
  .sort((a,b)=>a.name.localeCompare(b.name));
 const apply=async(action:()=>Promise<void>)=>{
  setBusy(true);setError('');
  try{await action();}catch(e){setError(e instanceof Error?e.message:'Unable to change linked Deal.');}
  finally{setBusy(false);}
 };
 return <section className="ss-deal-relations" aria-label="Directly linked Deals">
  <div className="ss-deal-relations-heading"><strong>Directly linked Deals</strong><span>{direct.length}</span></div>
  {!manager.ready?<p role="status" className="connections-record-helper">
   {manager.error?'Unable to load links: '+manager.error:'Loading shared Deal links…'}
   {manager.error&&<button type="button" onClick={manager.retry}>Retry</button>}</p>:
  <div className="ss-deal-relations-list">
   {direct.map(link=>{
    const deal=deals.find(item=>item.id===link.dealId);
    return deal?<div className="ss-deal-relations-row" key={deal.id}>
      <button type="button" className="ss-deal-relations-name" onClick={()=>onOpenDeal(deal.id)}>
       <strong>{deal.name}</strong><small>{link.role||'Direct contact'} · Open Deal →</small>
      </button>
      {manager.editable&&<button type="button" disabled={busy} onClick={()=>{
       if(!window.confirm('Unlink this Deal? Existing Quotes and Activities are preserved.'))return;
       void apply(()=>manager.remove(deal.id,personId));
      }}>Unlink</button>}
     </div>:null;
   })}
   {!direct.length&&<p className="connections-record-empty">Not assigned directly to any Deals.</p>}
  </div>}
  {manager.ready&&manager.editable&&<div className="ss-deal-relations-add">
    <select aria-label="Deal to link to Person" value={selected} disabled={busy}
     onChange={e=>setSelected(e.target.value)}>
     <option value="">Choose a Deal…</option>
     {choices.map(deal=><option value={deal.id} key={deal.id}>{deal.name}</option>)}
    </select>
    <input type="text" aria-label="Contact role (optional)" value={role} maxLength={120}
     disabled={busy} placeholder="Role (optional)" onChange={e=>setRole(e.target.value)}/>
    <button type="button" disabled={!selected||busy}
     onClick={()=>void apply(async()=>{await manager.add(selected,personId,role);
      setSelected('');setRole('');})}>+ Link Existing Deal</button>
   </div>}
  {error&&<p role="alert" className="ss-deal-relations-error">{error}</p>}
 </section>;
}
