import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {useAuthStore} from '../store/authStore';
import type {TeamRole} from './teamAccess';
import type {TeamDepartment} from './teamDepartments';

type MemberRow={user_id:string;role:TeamRole;job_function:TeamDepartment};
export type DealAssignee={userId:string;name:string;role:TeamRole;department:TeamDepartment};

/** Only people who can issue quotes should own a bid-submission obligation. */
export function eligibleDealAssignee(role:TeamRole,department:TeamDepartment):boolean{
 return role==='owner'||role==='admin'||(role==='member'&&
  (department==='general'||department==='salesperson'));
}

export function useDealAssigneeDirectory(){
 const mode=useAuthStore(s=>s.mode),orgId=useAuthStore(s=>s.organizationId);
 const user=useAuthStore(s=>s.user);
 const [members,setMembers]=useState<DealAssignee[]>([]);
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
    const roster=await client.from('organization_members')
     .select('user_id,role,job_function').eq('organization_id',orgId);
    if(roster.error)throw roster.error;
    const valid=(roster.data??[] as MemberRow[]).filter(member=>
      eligibleDealAssignee(member.role as TeamRole,(member.job_function??'general') as TeamDepartment));
    const profiles=valid.length?await client.from('profiles')
     .select('user_id,display_name').in('user_id',valid.map(m=>m.user_id)):null;
    if(profiles?.error)throw profiles.error;
    const names=new Map<string,string>((profiles?.data??[]).map(p=>[
      String(p.user_id),String(p.display_name??'').trim(),
    ] as const));
    if(cancelled)return;
    setMembers(valid.map(member=>({
      userId:member.user_id,role:member.role,department:member.job_function??'general',
      name:names.get(member.user_id)||
       (member.user_id===user?.id?String(user?.user_metadata?.display_name??'You'):'Team member '+member.user_id.slice(0,6)),
    })).sort((a,b)=>a.name.localeCompare(b.name)));
   }catch(reason){
    if(!cancelled)setError(reason instanceof Error?reason.message:'Team directory unavailable.');
   }finally{if(!cancelled)setLoading(false);}
  })();
  return()=>{cancelled=true;};
 },[mode,orgId,user?.id,user?.user_metadata?.display_name]);
 return {members,loading,error,mode};
}
export function dealAssigneeLabel(id:string|undefined,members:readonly DealAssignee[]):string{
 if(!id)return 'Unassigned · legacy task routing';
 return members.find(m=>m.userId===id)?.name??'Assigned teammate';
}

/** The dropdown never infers ownership from quote creator or task author. */
export function DealAssigneeSelect({value,onChange,disabled=false}:{
 value:string;onChange:(userId:string)=>void;disabled?:boolean;
}){
 const {mode,members,loading,error}=useDealAssigneeDirectory();
 if(mode!=='cloud')return <small>Local workspace · submission tasks belong to you</small>;
 return <>
  <select aria-label="Assigned salesperson" value={value}
   onChange={e=>onChange(e.target.value)} disabled={disabled||loading||!!error}>
   <option value="">Unassigned — legacy deadline routing</option>
   {value&&!members.some(member=>member.userId===value)&&
    <option value={value}>Current assignee · no longer eligible or unavailable</option>}
   {members.map(member=><option key={member.userId} value={member.userId}>
    {member.name}</option>)}
  </select>
  {loading&&<small>Loading eligible teammates…</small>}
  {error&&<small role="alert">Could not load team assignments: {error}</small>}
  {value&&!loading&&!error&&!members.some(member=>member.userId===value)&&
    <small role="alert">This assignee can no longer be selected. Choose an eligible teammate to restore a reliable submission-task owner.</small>}
  {!loading&&!error&&<small>Only eligible salespeople appear. Unassigned Deals keep existing deadline routing.</small>}
 </>;
}
