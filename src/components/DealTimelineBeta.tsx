import {useEffect,useMemo,useState} from 'react';
import type {Project} from '../types/crm';
import type {DealScheduleDraft,DealScheduleRow} from '../services/dealScheduleTemplates';
import {useAuthStore} from '../store/authStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {resolveOwnerPerspective} from '../services/rolePerspective';
import {timelineBetaScope,timelineBetaStatuses,useDealTimelineBetaStore} from '../store/dealTimelineBetaStore';
import '../deal-timeline-beta.css';

const DAY_MS=86400000;
function dateNum(value?:string):number|undefined{
  if(!value)return undefined;
  const n=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(n)?Math.floor(n/DAY_MS):undefined;
}
function spanOf(rows:readonly DealScheduleRow[]){
  const dates=rows.flatMap(row=>[dateNum(row.plannedStart),dateNum(row.plannedFinish)])
    .filter((n):n is number=>n!==undefined);
  return dates.length?{start:Math.min(...dates),end:Math.max(...dates)}:null;
}
function barStyle(row:DealScheduleRow,range:{start:number;end:number}|null){
  if(!range)return null;
  const start=dateNum(row.plannedStart??row.plannedFinish);
  const finish=dateNum(row.plannedFinish??row.plannedStart);
  if(start===undefined||finish===undefined)return null;
  const span=Math.max(1,range.end-range.start+1);
  return {left:((start-range.start)/span*100)+'%',
    width:Math.max(2,(finish-start+1)/span*100)+'%'};
}
function flatten(schedule:DealScheduleDraft,collapsed:Set<string>){
  const rows:{row:DealScheduleRow;depth:number}[]=[];
  const visit=(parentId:string|undefined,depth:number)=>{
    for(const row of schedule.rows.filter(item=>item.parentId===parentId)){
      rows.push({row,depth});
      if(row.kind==='group'&&!collapsed.has(row.id))visit(row.id,depth+1);
    }
  };
  visit(undefined,0);
  return rows;
}
function useBetaScope(){
  const mode=useAuthStore(s=>s.mode);
  const org=useAuthStore(s=>s.organizationId);
  const user=useAuthStore(s=>s.user?.id);
  const scope=timelineBetaScope(mode,org,user);
  const load=useDealTimelineBetaStore(s=>s.load);
  useEffect(()=>{if(scope)load(scope);},[scope,load]);
  return scope;
}
export function DealTimelineBeta({deal}:{deal:Project}){
  const scope=useBetaScope();
  const loaded=useDealTimelineBetaStore(s=>s.loadedScope);
  const drafts=useDealTimelineBetaStore(s=>s.drafts);
  const error=useDealTimelineBetaStore(s=>s.error);
  const start=useDealTimelineBetaStore(s=>s.start);
  const patch=useDealTimelineBetaStore(s=>s.patch);
  const add=useDealTimelineBetaStore(s=>s.addPhase);
  const mode=useAuthStore(s=>s.mode);
  const role=useAuthStore(s=>s.teamRole);
  const department=useAuthStore(s=>s.teamDepartment);
  const preview=useRolePerspectiveStore(s=>s.activePerspective);
  const simulated=resolveOwnerPerspective(preview,role,mode);
  const editable=mode==='local'||canEditTeamArea(simulated?.role??role,simulated?.department??department,'crm');
  const [collapsed,setCollapsed]=useState<string[]>(['imports','buildings','closeout']);
  useEffect(()=>setCollapsed(['imports','buildings','closeout']),[deal.id]);
  const ready=!!scope&&loaded===scope;
  const schedule=ready?drafts[deal.id]:undefined;
  const rows=useMemo(()=>schedule?flatten(schedule,new Set(collapsed)):[],[schedule,collapsed]);
  const datedRange=useMemo(()=>schedule?spanOf(schedule.rows):null,[schedule]);
  const total=schedule?.rows.filter(row=>row.kind!=='group').length??0;
  const done=schedule?.rows.filter(row=>row.kind!=='group'&&row.status==='complete').length??0;
  const [showBars,setShowBars]=useState(true);
  const toggle=(id:string)=>setCollapsed(old=>old.includes(id)?old.filter(v=>v!==id):[...old,id]);

  return <section className="ss-timeline-beta" aria-label="Project timeline beta">
    <div className="ss-timeline-beta-head">
      <div>
        <h2>Project timeline <span className="ss-timeline-beta-tag">BETA</span></h2>
        <p>Simple milestones for preconstruction, phased imports, building installs and billing.</p>
      </div>
      {schedule&&editable&&<div className="ss-timeline-beta-actions">
        <button type="button" onClick={()=>{if(scope)add(scope,deal.id,'import');setCollapsed(old=>old.filter(id=>id!=='imports'));}}>+ Import</button>
        <button type="button" onClick={()=>{if(scope)add(scope,deal.id,'building');setCollapsed(old=>old.filter(id=>id!=='buildings'));}}>+ Building</button>
      </div>}
    </div>
    <p className="ss-timeline-beta-note">Personal beta draft · saved on this device only · not shared or linked to invoicing.</p>
    {!scope?<p className="ss-timeline-beta-empty">Open a local workspace or sign in to save a timeline.</p>:
      !ready?<p className="ss-timeline-beta-empty">Loading timeline…</p>:
      !schedule?<div className="ss-timeline-beta-empty">
        <p>Start with shop drawings, deposit, import batches, delivery, installation by building, invoices and retainage. All dates begin blank.</p>
        <button type="button" disabled={!editable} onClick={()=>{if(scope)start(scope,deal.id);}}>Start multifamily timeline</button>
      </div>:<>
        <div className="ss-timeline-beta-summary">
          <strong>{done}/{total} complete</strong>
          <span>{schedule.rows.filter(row=>row.parentId==='imports').length} imports</span>
          <span>{schedule.rows.filter(row=>row.parentId==='buildings').length} buildings</span>
          <label><input type="checkbox" checked={showBars} onChange={e=>setShowBars(e.target.checked)}/>Timeline bars</label>
        </div>
        <div className="ss-timeline-beta-scroll" role="region" aria-label="Editable project milestone table" tabIndex={0}>
          <table className="ss-timeline-beta-table">
            <thead><tr>
              <th>Milestone / phase</th><th>Planned start</th><th>Planned finish</th>
              <th>Status</th>{showBars&&<th className="ss-timeline-beta-bar-col">Timeline</th>}
            </tr></thead>
            <tbody>{rows.map(({row,depth})=>{
              const group=row.kind==='group';
              const style=barStyle(row,datedRange);
              return <tr key={row.id} className={group?'ss-timeline-beta-group':''}>
                <th scope="row">
                  <div className="ss-timeline-beta-name" style={{paddingLeft:depth*13}}>
                    {group?<button type="button" aria-expanded={!collapsed.includes(row.id)}
                      onClick={()=>toggle(row.id)}>
                      <span aria-hidden="true">{collapsed.includes(row.id)?'▸':'▾'}</span> {row.label}
                    </button>:<span title={row.label}>{row.label}</span>}
                  </div>
                </th>
                {group?<><td colSpan={showBars?4:3}><small>Expand to edit milestones</small></td></>:
                <>
                  <td><input type="date" aria-label={'Start for '+row.label}
                    disabled={!editable} value={row.plannedStart??''}
                    onChange={e=>{if(scope)patch(scope,deal.id,row.id,{plannedStart:e.target.value||undefined});}}/></td>
                  <td><input type="date" aria-label={'Finish for '+row.label}
                    disabled={!editable} value={row.plannedFinish??''}
                    onChange={e=>{if(scope)patch(scope,deal.id,row.id,{plannedFinish:e.target.value||undefined});}}/></td>
                  <td><select aria-label={'Status for '+row.label} disabled={!editable}
                    value={row.status} onChange={e=>{if(scope)patch(scope,deal.id,row.id,
                      {status:e.target.value as DealScheduleRow['status']});}}>
                    {timelineBetaStatuses.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
                  </select></td>
                  {showBars&&<td><div className="ss-timeline-beta-track">
                    {style&&<span className={'ss-timeline-beta-bar'+(row.status==='complete'?' is-done':'')}
                      style={style}/>}</div></td>}
                </>}
              </tr>;
            })}</tbody>
          </table>
        </div>
        {!datedRange&&<p className="ss-timeline-beta-note">Add planned dates to see bars. No dates or dependencies are automatically assumed.</p>}
      </>}
    {error&&<p role="alert" className="ss-timeline-beta-error">{error}</p>}
  </section>;
}

/** Lightweight portfolio navigator, not a cross-project scheduler. */
export function DealTimelineBetaOverview({projects,onOpen}:{projects:Project[];onOpen:(id:string)=>void}){
  const scope=useBetaScope();
  const loaded=useDealTimelineBetaStore(s=>s.loadedScope);
  const drafts=useDealTimelineBetaStore(s=>s.drafts);
  const active=projects.filter(p=>p.stage==='Closed Won'||p.stage==='Completed');
  return <section className="ss-timeline-beta" aria-label="Contracted deals timeline overview">
    <div className="ss-timeline-beta-head"><div>
      <h2>Contracted project timelines <span className="ss-timeline-beta-tag">BETA</span></h2>
      <p>Open a Deal to plan its phases. Dates and statuses are still device-only drafts.</p>
    </div></div>
    {active.length?<div className="ss-timeline-beta-overview">
      {active.map(deal=>{
        const draft=scope&&loaded===scope?drafts[deal.id]:undefined;
        const range=draft?spanOf(draft.rows):null;
        const tasks=draft?.rows.filter(row=>row.kind!=='group')??[];
        const finished=tasks.filter(row=>row.status==='complete').length;
        const startDate=range?new Date(range.start*DAY_MS).toISOString().slice(0,10):'';
        const finishDate=range?new Date(range.end*DAY_MS).toISOString().slice(0,10):'';
        return <button type="button" key={deal.id} onClick={()=>onOpen(deal.id)}>
          <span><strong>{deal.name}</strong><small>{deal.stage} · {deal.companyName??'No company'}</small></span>
          <span>{draft?finished+'/'+tasks.length+' milestones':'Not started'}</span>
          <span>{startDate?startDate+' → '+finishDate:'No dates'}</span>
          <span aria-hidden="true">›</span>
        </button>;
      })}
    </div>:<p className="ss-timeline-beta-empty">No contracted or completed Deals match this view.</p>}
  </section>;
}
