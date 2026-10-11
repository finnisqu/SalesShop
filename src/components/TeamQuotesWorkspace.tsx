import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useQuoteStore } from '../store/quoteStore';
import { displayQuoteNumber, quoteLineTotal, quoteTotal, QUOTE_STATUSES, type Quote } from '../types/quote';
import {
  filterTeamQuotes, summarizeTeamQuotes, validQuoteTeamAssignment,
  type SalesDivision, type SalesTeam, type SalesMember, type TeamQuoteFilters,
} from '../services/quoteTeamReporting';

const money = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
type MembershipRow = { user_id: string; role: string; job_function: string };

export function TeamQuotesWorkspace({ quotes, onShowMine }: { quotes: readonly Quote[]; onShowMine: () => void }) {
  const organizationId = useAuthStore(s=>s.organizationId);
  const currentRole = useAuthStore(s=>s.teamRole);
  const [divisions,setDivisions] = useState<SalesDivision[]>([]);
  const [teams,setTeams] = useState<SalesTeam[]>([]);
  const [members,setMembers] = useState<SalesMember[]>([]);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [grants,setGrants] = useState<Array<{user_id:string}>>([]);
  const [grantTo,setGrantTo] = useState('');
  const currentUserId=useAuthStore(state=>state.user?.id);
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [assignment,setAssignment] = useState({ owner:'',division:'',team:'' });
  const [filters,setFilters] = useState<TeamQuoteFilters>({
    query:'',owner:'all',division:'all',team:'all',status:'all',showArchived:false,
  });
  const setQuoteAssignmentFromCloud = useQuoteStore(s=>s.setQuoteAssignmentFromCloud);

  useEffect(()=>{
    if (!organizationId || !supabase) { setLoading(false); return; }
    const client=supabase;
    let cancelled=false;
    setLoading(true);
    void (async()=>{
      const [d,t,m]=await Promise.all([
        client.from('sales_divisions').select('id,organization_id,name').eq('organization_id',organizationId).order('name'),
        client.from('sales_teams').select('id,organization_id,name,division_id').eq('organization_id',organizationId).order('name'),
        client.from('organization_members').select('user_id,role,job_function').eq('organization_id',organizationId),
      ]);
      if(cancelled) return;
      if(d.error || t.error || m.error) {
        setError(d.error?.message ?? t.error?.message ?? m.error?.message ?? 'Unable to load team filters.');
        setLoading(false);return;
      }
      const membership=(m.data??[]) as MembershipRow[];
      const profiles=membership.length
        ? await client.from('profiles').select('user_id,display_name').in('user_id',membership.map(p=>p.user_id))
        : {data:[],error:null};
      if(cancelled)return;
      if(profiles.error)setError(profiles.error.message);
      const names=new Map<string,string>((profiles.data??[]).map(p=>[String(p.user_id),String(p.display_name||'')] as const));
      setMembers(membership.map(row=>({
        user_id:row.user_id,role:row.role,jobFunction:row.job_function,
        displayName:names.get(row.user_id) || `Member ${row.user_id.slice(0,8)}`,
      })));
      setDivisions((d.data??[]) as SalesDivision[]);
      setTeams((t.data??[]) as SalesTeam[]);
      setLoading(false);
    })();
    return ()=>{cancelled=true};
  },[organizationId]);

  // Grant rows are owner/admin-only. A specific quote grant permits Viewers to
  // read just that quote without exposing the rest of the organization.
  useEffect(()=>{
    if(!supabase || !organizationId || !selectedId || !['owner','admin'].includes(currentRole??'')){
      setGrants([]);return;
    }
    let cancelled=false;
    void supabase.from('quote_access_grants').select('user_id')
      .eq('organization_id',organizationId).eq('quote_id',selectedId)
      .then(({data,error})=>{
        if(cancelled)return;
        if(error)setError(error.message);
        else setGrants((data??[]) as Array<{user_id:string}>);
      });
    return ()=>{cancelled=true};
  },[organizationId,selectedId,currentRole]);

  const filtered=useMemo(()=>filterTeamQuotes(quotes,filters),[quotes,filters]);
  const metrics=useMemo(()=>summarizeTeamQuotes(filtered),[filtered]);
  const selected=quotes.find(q=>q.id===selectedId);
  const availableTeams=teams.filter(team=>filters.division==='all'||filters.division==='unassigned'||team.division_id===filters.division);
  const teamName=(id?:string)=>teams.find(t=>t.id===id)?.name??'Unassigned team';
  const divisionName=(id?:string)=>divisions.find(d=>d.id===id)?.name??'Unassigned division';
  const ownerName=(id?:string)=>members.find(m=>m.user_id===id)?.displayName??'Unassigned';
  const updateFilters=(patch:Partial<TeamQuoteFilters>)=>setFilters(f=>({...f,...patch}));
  const chooseQuote=(quote:Quote)=>{
    setNotice('');setError('');setGrantTo('');
    setSelectedId(id=>id===quote.id?null:quote.id);
    setAssignment({owner:quote.ownerUserId??'',division:quote.divisionId??'',team:quote.teamId??''});
  };

  const saveAssignment=async()=>{
    if(!selected || !organizationId || !supabase || (currentRole!=='owner'&&currentRole!=='admin')) return;
    const owner=assignment.owner||null,division=assignment.division||null,team=assignment.team||null;
    if(!validQuoteTeamAssignment(owner,division,team,members,divisions,teams)){
      setError('Choose a valid member and team within the selected division.');return;
    }
    setSaving(true);setError('');setNotice('');
    const {data,error:writeError}=await supabase.from('quotes')
      .update({owner_user_id:owner,division_id:division,team_id:team})
      .eq('organization_id',organizationId).eq('id',selected.id)
      .select('id,owner_user_id,division_id,team_id').single();
    setSaving(false);
    if(writeError || !data){setError(writeError?.message||'Could not save assignment.');return;}
    setQuoteAssignmentFromCloud(selected.id,{
      ownerUserId:data.owner_user_id??undefined,
      divisionId:data.division_id??undefined,
      teamId:data.team_id??undefined,
    });
    setNotice('Quote responsibility updated.');
  };

  const saveGrant=async(userId:string, remove=false)=>{
    if(!supabase || !organizationId || !selectedId || !currentUserId ||
      !['owner','admin'].includes(currentRole??'') || !userId)return;
    setSaving(true);setError('');setNotice('');
    const request=remove
      ? supabase.from('quote_access_grants').delete().eq('organization_id',organizationId)
        .eq('quote_id',selectedId).eq('user_id',userId)
      : supabase.from('quote_access_grants').insert({
          organization_id:organizationId,quote_id:selectedId,user_id:userId,granted_by:currentUserId,
        });
    const {error:writeError}=await request;
    setSaving(false);
    if(writeError){setError(writeError.message);return}
    setGrants(current=>remove?current.filter(g=>g.user_id!==userId):[...current,{user_id:userId}]);
    setGrantTo('');
    setNotice(remove?'Quote access revoked.':'Read-only quote access granted.');
  };

  return <main className="team-quotes-view" aria-label="Team Quotes overview">
    <header className="team-quotes-heading">
      <div><span>TEAM REPORTING · VIEW FIRST</span><h1>Team Quotes</h1>
        <p>Reference the organization's work across people, teams, and divisions. Open a card for details.</p></div>
      <button type="button" onClick={onShowMine}>← My Quotes</button>
    </header>
    <section className="team-quotes-summary" aria-label="Filtered quote totals">
      <div><span>Quotes</span><strong>{metrics.total}</strong></div>
      <div><span>Draft / ready</span><strong>{metrics.active}</strong></div>
      <div><span>Sent / viewed</span><strong>{metrics.sent}</strong></div>
      <div><span>Signed</span><strong>{metrics.signed}</strong></div>
      <div><span>Quoted value</span><strong>{money.format(metrics.value)}</strong></div>
    </section>
    <div className="team-quotes-filters" aria-label="Team quote filters">
      <label className="team-quotes-filter-search"><span>Search quotes</span><input type="search" aria-label="Search team quotes"
        placeholder="Quote, customer, number…" value={filters.query} onChange={e=>updateFilters({query:e.target.value})}/></label>
      <label><span>Salesperson</span><select aria-label="Filter by salesperson" value={filters.owner} onChange={e=>updateFilters({owner:e.target.value})}>
        <option value="all">All salespeople</option><option value="unassigned">Unassigned</option>
        {members.map(m=><option key={m.user_id} value={m.user_id}>{m.displayName}</option>)}
      </select></label>
      <label><span>Division</span><select aria-label="Filter by division" value={filters.division} onChange={e=>updateFilters({division:e.target.value,team:'all'})}>
        <option value="all">All divisions</option><option value="unassigned">Unassigned</option>
        {divisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
      </select></label>
      <label><span>Team</span><select aria-label="Filter by team" value={filters.team} onChange={e=>updateFilters({team:e.target.value})}>
        <option value="all">All teams</option><option value="unassigned">Unassigned</option>
        {availableTeams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select></label>
      <label><span>Status</span><select aria-label="Filter by quote status" value={filters.status}
        onChange={e=>updateFilters({status:e.target.value as TeamQuoteFilters['status']})}>
        <option value="all">All statuses</option>{QUOTE_STATUSES.map(status=><option key={status}>{status}</option>)}
      </select></label>
      <label className="team-quotes-archive"><input type="checkbox" checked={filters.showArchived}
        onChange={e=>updateFilters({showArchived:e.target.checked})}/> Show archived</label>
    </div>
    {loading && <p className="team-quotes-info" role="status">Loading team and division filters…</p>}
    {error && <p className="team-quotes-error" role="alert">{error}</p>}
    {notice && <p className="team-quotes-info" role="status">{notice}</p>}
    {metrics.unassigned>0 && <p className="team-quotes-info">{metrics.unassigned} legacy quote{metrics.unassigned===1?' is':'s are'} unassigned. Assign responsibility without changing pricing or document history.</p>}
    <div className="team-quotes-list">
      {filtered.map(quote=><article className="team-quote-card" key={quote.id}>
        <div className="team-quote-card-heading">
          <div><small>{displayQuoteNumber(quote)} · {quote.status}</small><h2>{quote.title||'Untitled quote'}</h2>
            <p>{quote.companyName||'No customer'} · {ownerName(quote.ownerUserId)}</p>
            <small>{divisionName(quote.divisionId)} · {teamName(quote.teamId)}</small></div>
          <div className="team-quote-card-total"><strong>{money.format(quoteTotal(quote))}</strong><span>{quote.quoteDate}</span></div>
        </div>
        <button type="button" className="team-quote-details-button" aria-expanded={selectedId===quote.id}
          onClick={()=>chooseQuote(quote)}>{selectedId===quote.id?'Close details':'View details'} <span aria-hidden="true">{selectedId===quote.id?'⌃':'⌄'}</span></button>
        {selectedId===quote.id && <div className="team-quote-details">
          <div className="team-quote-details-heading">Quote lines · read only</div>
          {quote.lines.filter(l=>l.customerVisible).map(line=><div key={line.id} className="team-quote-detail-line">
            <span>{line.description}</span><strong>{money.format(quoteLineTotal(line))}</strong>
          </div>)}
          {!quote.lines.length && <p>No line items yet.</p>}
          {selected && (currentRole==='owner'||currentRole==='admin') && <section className="team-quote-assignment">
            <h3>Responsibility & reporting</h3>
            <div>
              <label><span>Salesperson</span><select aria-label="Assign quote salesperson" value={assignment.owner} onChange={e=>setAssignment(a=>({...a,owner:e.target.value}))}>
                <option value="">Unassigned</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.displayName}</option>)}
              </select></label>
              <label><span>Division</span><select aria-label="Assign quote division" value={assignment.division}
                onChange={e=>setAssignment(a=>({...a,division:e.target.value,team:''}))}>
                <option value="">Unassigned</option>{divisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select></label>
              <label><span>Team</span><select aria-label="Assign quote team" value={assignment.team} onChange={e=>setAssignment(a=>({...a,team:e.target.value}))}>
                <option value="">Unassigned</option>{teams.filter(t=>!assignment.division||t.division_id===assignment.division).map(t=>
                  <option key={t.id} value={t.id}>{t.name}</option>)}
              </select></label>
            </div>
            <button type="button" disabled={saving||loading} onClick={()=>void saveAssignment()}>{saving?'Saving…':'Save assignment'}</button>
          </section>}
          {selected && (currentRole==='owner'||currentRole==='admin') && <section className="team-quote-assignment" aria-label="Explicit quote access">
            <h3>Additional read-only access</h3>
            <p>Grant an individual access to this quote only. Team members can also see quotes assigned to their team; viewers require an explicit grant.</p>
            {grants.map(g=><div className="team-quote-grant-row" key={g.user_id}>
              <span>{ownerName(g.user_id)}</span>
              <button type="button" disabled={saving} onClick={()=>void saveGrant(g.user_id,true)}>Revoke</button>
            </div>)}
            <div className="team-quote-grant-add">
              <label><span>Share read-only with</span><select aria-label="Grant quote read access to member" value={grantTo} onChange={e=>setGrantTo(e.target.value)}>
                <option value="">Choose a member</option>
                {members.filter(m=>!grants.some(g=>g.user_id===m.user_id))
                  .map(m=><option key={m.user_id} value={m.user_id}>{m.displayName} · {m.role}</option>)}
              </select></label>
              <button type="button" disabled={!grantTo||saving} onClick={()=>void saveGrant(grantTo)}>Grant view access</button>
            </div>
          </section>}
        </div>}
      </article>)}
      {!filtered.length && <div className="team-quotes-empty">No quotes match these filters. Try another person, division, or status.</div>}
    </div>
  </main>;
}
