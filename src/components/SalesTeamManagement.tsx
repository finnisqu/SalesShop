import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { SalesDivision, SalesTeam, SalesTeamMember, SalesMember } from '../services/quoteTeamReporting';

type OrgMember = { user_id: string; role: string; job_function: string };

export function SalesTeamManagement() {
  const role = useAuthStore(s=>s.teamRole);
  const orgId = useAuthStore(s=>s.organizationId);
  const mode = useAuthStore(s=>s.mode);
  const allowed = mode === 'cloud' && !!orgId && (role === 'owner' || role === 'admin');
  const [divisions,setDivisions] = useState<SalesDivision[]>([]);
  const [teams,setTeams] = useState<SalesTeam[]>([]);
  const [assignments,setAssignments] = useState<SalesTeamMember[]>([]);
  const [members,setMembers] = useState<SalesMember[]>([]);
  const [newDivision,setNewDivision] = useState('');
  const [newTeam,setNewTeam] = useState('');
  const [newTeamDivision,setNewTeamDivision] = useState('');
  const [selectedTeam,setSelectedTeam] = useState('');
  const [selectedMember,setSelectedMember] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  const refresh = useCallback(async()=>{
    if(!orgId || !supabase || !allowed) return;
    const [d,t,tm,m] = await Promise.all([
      supabase.from('sales_divisions').select('id,organization_id,name').eq('organization_id',orgId).order('name'),
      supabase.from('sales_teams').select('id,organization_id,name,division_id').eq('organization_id',orgId).order('name'),
      supabase.from('sales_team_members').select('organization_id,team_id,user_id').eq('organization_id',orgId),
      supabase.from('organization_members').select('user_id,role,job_function').eq('organization_id',orgId),
    ]);
    if(d.error||t.error||tm.error||m.error){setError(d.error?.message??t.error?.message??tm.error?.message??m.error?.message??'Team setup unavailable.');return}
    const roster=(m.data??[]) as OrgMember[];
    const profiles=roster.length?await supabase.from('profiles').select('user_id,display_name').in('user_id',roster.map(row=>row.user_id)):{data:[],error:null};
    if(profiles.error){setError(profiles.error.message);return}
    const names=new Map<string,string>((profiles.data??[]).map(row=>[String(row.user_id),String(row.display_name??'')] as const));
    setDivisions((d.data??[]) as SalesDivision[]);
    setTeams((t.data??[]) as SalesTeam[]);
    setAssignments((tm.data??[]) as SalesTeamMember[]);
    setMembers(roster.map(row=>({
      user_id:row.user_id,role:row.role,jobFunction:row.job_function,
      displayName:names.get(row.user_id)||`Member ${row.user_id.slice(0,8)}`,
    })));
    setError('');
  },[orgId,allowed]);

  useEffect(()=>{void refresh()},[refresh]);
  if (!allowed) return null;

  const createDivision=async(event:FormEvent)=>{
    event.preventDefault();
    const name=newDivision.trim();
    if(!name||!supabase||!orgId)return;
    setBusy(true);setError('');setNotice('');
    const {error:err}=await supabase.from('sales_divisions').insert({organization_id:orgId,name});
    setBusy(false);
    if(err){setError(err.message);return}
    setNewDivision('');setNotice('Division created.');await refresh();
  };
  const createTeam=async(event:FormEvent)=>{
    event.preventDefault();
    const name=newTeam.trim();
    if(!name||!supabase||!orgId)return;
    setBusy(true);setError('');setNotice('');
    const {error:err}=await supabase.from('sales_teams').insert({
      organization_id:orgId,name,division_id:newTeamDivision||null,
    });
    setBusy(false);
    if(err){setError(err.message);return}
    setNewTeam('');setNewTeamDivision('');setNotice('Team created.');await refresh();
  };
  const toggleMembership=async()=>{
    if(!supabase||!orgId||!selectedTeam||!selectedMember||busy)return;
    const existing=assignments.some(item=>item.team_id===selectedTeam&&item.user_id===selectedMember);
    setBusy(true);setError('');setNotice('');
    const request=existing
      ? supabase.from('sales_team_members').delete().eq('organization_id',orgId)
        .eq('team_id',selectedTeam).eq('user_id',selectedMember)
      : supabase.from('sales_team_members').insert({organization_id:orgId,team_id:selectedTeam,user_id:selectedMember});
    const {error:err}=await request;
    setBusy(false);
    if(err){setError(err.message);return}
    setNotice(existing?'Member removed from team.':'Member added to team.');
    await refresh();
  };

  const chosenTeam=teams.find(team=>team.id===selectedTeam);
  const chosenDivision=divisions.find(d=>d.id===chosenTeam?.division_id);
  const attached=assignments.some(a=>a.user_id===selectedMember&&a.team_id===selectedTeam);

  return <section className="company-settings-card sales-team-management" aria-label="Sales divisions and teams">
    <header><div><strong>Sales divisions & teams</strong>
      <small>Reporting groups for Team Quotes; independent of editing permissions and pricing divisions.</small></div></header>
    <div className="sales-team-management-columns">
      <form onSubmit={event=>void createDivision(event)}>
        <h3>Create a division</h3>
        <label><span>Division name</span><input aria-label="New division name" value={newDivision}
          onChange={event=>setNewDivision(event.target.value)} placeholder="e.g. Commercial"/></label>
        <button type="submit" disabled={busy||!newDivision.trim()}>Add division</button>
      </form>
      <form onSubmit={event=>void createTeam(event)}>
        <h3>Create a team</h3>
        <label><span>Team name</span><input aria-label="New sales team name" value={newTeam}
          onChange={event=>setNewTeam(event.target.value)} placeholder="e.g. Multifamily"/></label>
        <label><span>Division</span><select aria-label="New team division" value={newTeamDivision}
          onChange={event=>setNewTeamDivision(event.target.value)}>
          <option value="">No division yet</option>
          {divisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select></label>
        <button type="submit" disabled={busy||!newTeam.trim()}>Add team</button>
      </form>
    </div>
    <div className="sales-team-roster">
      <h3>Assign team members</h3>
      <p>People may belong to more than one team. Adding a team does not automatically grant access to new organization records.</p>
      <div>
        <label><span>Team</span><select value={selectedTeam} aria-label="Choose team for membership" onChange={event=>setSelectedTeam(event.target.value)}>
          <option value="">Choose team</option>
          {teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}
        </select></label>
        <label><span>Member</span><select value={selectedMember} aria-label="Choose member for team" onChange={event=>setSelectedMember(event.target.value)}>
          <option value="">Choose member</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.displayName}</option>)}
        </select></label>
        <button type="button" disabled={busy||!selectedMember||!selectedTeam} onClick={()=>void toggleMembership()}>
          {attached?'Remove from team':'Add to team'}
        </button>
      </div>
      {chosenTeam && <small>{chosenTeam.name} · {chosenDivision?.name||'No division'} · {assignments.filter(a=>a.team_id===chosenTeam.id).length} members</small>}
    </div>
    {error && <p role="alert" className="sales-team-management-error">{error}</p>}
    {notice && <p role="status" className="sales-team-management-notice">{notice}</p>}
  </section>;
}
