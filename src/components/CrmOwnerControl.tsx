import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {useAuthStore} from '../store/authStore';
import {useCrmStore} from '../store/crmStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canReassignCrmOwner,crmOwnerDisplay,type CrmOwnerMember} from '../services/crmRecordOwnership';
import './crm-owner-assignment.css';

type MemberRow={user_id:string;role:'owner'|'admin'|'member'|'viewer'};
type OwnerTarget='company'|'contact';

/** Only organization members are eligible owners. A failed directory load
 * disables reassignment rather than accepting a guessed identifier.
 */
function useCrmOwnerDirectory(){
 const mode=useAuthStore(state=>state.mode);
 const orgId=useAuthStore(state=>state.organizationId);
 const userId=useAuthStore(state=>state.user?.id);
 const [members,setMembers]=useState<CrmOwnerMember[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;
  setMembers([]);setError('');
  if(mode!=='cloud'||!orgId||!supabase){setLoading(false);return;}
  const client=supabase;
  setLoading(true);
  void (async()=>{
   try{
    const {data:rows,error:rosterError}=await client.from('organization_members')
      .select('user_id,role').eq('organization_id',orgId);
    if(rosterError)throw rosterError;
    const valid=(rows??[]) as MemberRow[];
    const profiles=valid.length?await client.from('profiles')
      .select('user_id,display_name')
      .in('user_id',valid.map(member=>member.user_id)):null;
    // The membership list is authoritative; incomplete profile labels must
    // not prevent selecting a known member of the correct organization.
    const names=new Map<string,string>(
      (profiles?.error?[]:profiles?.data??[]).map(person=>[
        String(person.user_id),String(person.display_name??'').trim(),
      ] as const));
    if(cancelled)return;
    setMembers(valid.map(member=>({
      userId:member.user_id,role:member.role,
      name:member.user_id===userId?'You':names.get(member.user_id)||
        'Team member '+member.user_id.slice(0,8),
    })).sort((a,b)=>a.name.localeCompare(b.name)));
   }catch(reason){
    if(!cancelled)setError(reason instanceof Error?reason.message:'Team directory unavailable.');
   }finally{if(!cancelled)setLoading(false);}
  })();
  return()=>{cancelled=true;};
 },[mode,orgId,userId]);
 return {members,loading,error};
}

/** Compact owner row for full Company and Person record pages.
 * Owner updates are confirmed by Supabase before updating the CRM cache.
 */
export function CrmOwnerControl({kind,recordId,ownerUserId}:{
 kind:OwnerTarget;recordId:string;ownerUserId?:string;
}){
 const mode=useAuthStore(state=>state.mode);
 const role=useAuthStore(state=>state.teamRole);
 const userId=useAuthStore(state=>state.user?.id);
 const rolePreview=Boolean(useRolePerspectiveStore(state=>state.activePerspective));
 const assign=useCrmStore(state=>state.assignCrmRecordOwner);
 const {members,loading,error:directoryError}=useCrmOwnerDirectory();
 const canManage=canReassignCrmOwner(role,mode,rolePreview);
 const [editing,setEditing]=useState(false);
 const [selected,setSelected]=useState(ownerUserId??'');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  setEditing(false);setSaving(false);setError('');setNotice('');
  setSelected(ownerUserId??'');
 },[recordId,kind]);
 useEffect(()=>{if(!editing)setSelected(ownerUserId??'');},[ownerUserId,editing]);
 const ownerName=crmOwnerDisplay(ownerUserId,userId,mode,members);
 const changed=selected!==(ownerUserId??'');
 const selectedKnown=!selected||members.some(member=>member.userId===selected);
 const save=async()=>{
  if(!canManage||saving||loading||directoryError||!selectedKnown||!changed)return;
  setSaving(true);setError('');setNotice('');
  try{
   await assign(kind,recordId,selected||undefined);
   setEditing(false);
   setNotice('Assignment confirmed in cloud.');
  }catch(reason){
   setError(reason instanceof Error?reason.message:'Could not save the assignment.');
  }finally{setSaving(false);}
 };
 return <div className="connections-record-property crm-owner-control">
  <span>Assigned to</span>
  <div className="crm-owner-current">
   <strong>{ownerName}</strong>
   {canManage&&!editing&&<button type="button" onClick={()=>{
     setSelected(ownerUserId??'');setError('');setNotice('');setEditing(true);
   }}>Change</button>}
  </div>
  {notice&&<small role="status" className="crm-owner-feedback is-success">{notice}</small>}
  {editing&&canManage&&<div className="crm-owner-editor" role="group"
    aria-label={kind==='company'?'Change company owner':'Change person owner'}>
   <label>
    <span>Assign to teammate</span>
    <select value={selected} disabled={saving||loading||Boolean(directoryError)}
      aria-label="Assign record owner"
      onChange={event=>{setSelected(event.target.value);setError('');}}>
     <option value="">Unassigned</option>
     {ownerUserId&&!members.some(member=>member.userId===ownerUserId)&&
       <option value={ownerUserId}>Current owner · unavailable</option>}
     {members.map(member=><option key={member.userId} value={member.userId}>
       {member.name}</option>)}
    </select>
   </label>
   {loading&&<small role="status">Loading teammates…</small>}
   {directoryError&&<small role="alert">{directoryError}</small>}
   {error&&<small role="alert">{error}</small>}
   {!selectedKnown&&<small role="alert">Choose a current organization member.</small>}
   <div className="crm-owner-editor-actions">
    <button type="button" disabled={saving} onClick={()=>{setEditing(false);setError('');}}>
      Cancel</button>
    <button type="button" className="is-primary" onClick={()=>void save()}
      disabled={saving||loading||Boolean(directoryError)||!selectedKnown||!changed}>
      {saving?'Assigning…':'Save assignment'}</button>
   </div>
   <small className="crm-owner-editor-hint">Owner assignment changes who is responsible for the record, not who can view it.</small>
  </div>}
 </div>;
}
