import {useEffect,useMemo,useState} from 'react';
import type {Project} from '../types/crm';
import type {DealScheduleDraft,DealScheduleRow,DealScheduleStatus} from '../services/dealScheduleTemplates';
import {scheduleProgress} from '../services/dealScheduleEditing';
import {useDealScheduleStore} from '../store/dealScheduleStore';
import {useAuthStore} from '../store/authStore';
import {canEditTeamArea} from '../services/teamDepartments';
import '../deal-schedule.css';

const STATES: {id:DealScheduleStatus;label:string}[]=[
  {id:'not-started',label:'Not started'},
  {id:'in-progress',label:'In progress'},
  {id:'on-hold',label:'On hold'},
  {id:'complete',label:'Complete'},
];
const MS=86400000;
function dayNumber(value?:string):number|undefined{
  if(!value||! /^\d{4}-\d{2}-\d{2}$/.test(value))return undefined;
  const parsed=Date.parse(value+'T12:00:00Z');
  return Number.isFinite(parsed)?Math.floor(parsed/MS):undefined;
}
function dateLabel(day:number):string{
  return new Date(day*MS).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
}
function compactDate(value?:string):string{
  const d=dayNumber(value);return d===undefined?'—':dateLabel(d);
}
function useScope():string{
  const mode=useAuthStore(state=>state.mode);
  const org=useAuthStore(state=>state.organizationId);
  const user=useAuthStore(state=>state.user?.id);
  return mode==='cloud'?'org:'+String(org??'none')+':user:'+String(user??'none'):'offline';
}
function useScheduleScope():{scope:string;ready:boolean}{
  const scope=useScope();
  const load=useDealScheduleStore(state=>state.load);
  const loaded=useDealScheduleStore(state=>state.loaded);
  const current=useDealScheduleStore(state=>state.scope);
  useEffect(()=>load(scope),[scope,load]);
  return {scope,ready:loaded&&scope===current};
}
interface VisualRow {
  id:string;
  label:string;
  level:number;
  kind:DealScheduleRow['kind'];
  status:DealScheduleStatus;
  start?:string;
  end?:string;
  isGroup?:boolean;
  collapsed?:boolean;
  progress?:number;
}
function rowDates(row:DealScheduleRow,all:readonly DealScheduleRow[]):{start?:string;end?:string}{
  const own=[row.plannedStart,row.plannedFinish].filter((value):value is string=>Boolean(value));
  if(row.kind!=='group')return {start:own[0],end:own[own.length-1]};
  const queue=[row.id];
  const days=own.slice();
  while(queue.length){
    const parent=queue.shift();
    for(const child of all){
      if(child.parentId===parent){
        queue.push(child.id);
        if(child.plannedStart)days.push(child.plannedStart);
        if(child.plannedFinish)days.push(child.plannedFinish);
      }
    }
  }
  days.sort();
  return {start:days[0],end:days[days.length-1]};
}
function visibleRows(schedule:DealScheduleDraft,collapsed:Set<string>):VisualRow[]{
  const result:VisualRow[]=[];
  const walk=(parentId:string|undefined,level:number)=>{
    for(const row of schedule.rows.filter(item=>item.parentId===parentId)){
      const dates=rowDates(row,schedule.rows);
      result.push({id:row.id,label:row.label,level,kind:row.kind,status:row.status,
        start:dates.start,end:dates.end,isGroup:row.kind==='group',collapsed:collapsed.has(row.id)});
      if(row.kind==='group'&&!collapsed.has(row.id))walk(row.id,level+1);
    }
  };
  walk(undefined,0);
  return result;
}
function bounds(rows:readonly VisualRow[]):{start:number;days:number;width:number}{
  const days=rows.flatMap(row=>[dayNumber(row.start),dayNumber(row.end)])
    .filter((n):n is number=>n!==undefined);
  const today=Math.floor(Date.now()/MS);
  const start=days.length?Math.min(...days)-7:today-7;
  const finish=Math.max(start+77,days.length?Math.max(...days)+14:start+77);
  const count=finish-start+1;
  return {start,days:count,width:Math.max(620,count*9)};
}
function GanttChart({rows,onSelect,onCollapse,selectedId}:{
  rows:VisualRow[];onSelect:(id:string)=>void;onCollapse?:(id:string)=>void;selectedId?:string;
}){
  const range=useMemo(()=>bounds(rows),[rows]);
  const weeks=Array.from({length:Math.ceil(range.days/7)},(_,index)=>range.start+index*7);
  const scale=range.width/range.days;
  const todayX=(Math.floor(Date.now()/MS)-range.start)*scale;
  return <div className="ss-gantt-scroll" role="region" aria-label="Scrollable project Gantt chart" tabIndex={0}>
    <div className="ss-gantt-sheet" style={{width:range.width+244}}>
      <div className="ss-gantt-axis">
        <span className="ss-gantt-sticky-title">Phase / milestone</span>
        <div className="ss-gantt-axis-ticks" style={{width:range.width}}>
          {weeks.map(day=><span key={day} style={{left:(day-range.start)*scale}}>{dateLabel(day)}</span>)}
        </div>
      </div>
      {rows.map(row=>{
        const begin=dayNumber(row.start),end=dayNumber(row.end);
        const left=begin===undefined?undefined:Math.max(0,(begin-range.start)*scale);
        const width=begin===undefined?0:Math.max(10,((end??begin)-begin+1)*scale);
        return <div className={'ss-gantt-line'+(selectedId===row.id?' is-selected':'')} key={row.id}>
          <div className="ss-gantt-row-heading">
            <span className="ss-gantt-indent" style={{width:row.level*13}}/>
            {row.isGroup&&onCollapse&&<button type="button" className="ss-gantt-expand"
              aria-label={(row.collapsed?'Expand ':'Collapse ')+row.label}
              onClick={()=>onCollapse(row.id)}>{row.collapsed?'▸':'▾'}</button>}
            <button type="button" className={'ss-gantt-row-title'+(row.isGroup?' is-group':'')}
              title={row.label} onClick={()=>onSelect(row.id)}>{row.label}</button>
          </div>
          <div className="ss-gantt-track" style={{width:range.width,
            backgroundSize:(scale*7)+'px 100%'}}>
            {todayX>=0&&todayX<range.width&&<span className="ss-gantt-today" style={{left:todayX}}/>}
            {left!==undefined&&<button type="button" onClick={()=>onSelect(row.id)}
              title={row.label+': '+compactDate(row.start)+' – '+compactDate(row.end)}
              className={'ss-gantt-bar ss-gantt-'+row.status+(row.kind==='milestone'||row.kind==='financial'?' is-milestone':'')+(row.isGroup?' is-summary':'')}
              style={{left,width}}><span>{width>65?row.label:''}</span></button>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
function ScheduleMilestoneList({schedule,rows,onSelect}:{
  schedule:DealScheduleDraft;rows:VisualRow[];onSelect:(id:string)=>void;
}){
  const byId=new Map(schedule.rows.map(row=>[row.id,row]));
  return <div className="ss-schedule-list">
    {rows.map(item=>{
      const row=byId.get(item.id);
      return <button type="button" key={item.id} className="ss-schedule-list-row"
        onClick={()=>onSelect(item.id)} style={{paddingLeft:10+item.level*14}}>
        <span className="ss-schedule-list-name">{item.isGroup?'▾ ':''}{item.label}</span>
        <span className={'ss-schedule-state ss-schedule-'+item.status}>{item.isGroup?'Group':STATES.find(state=>state.id===item.status)?.label}</span>
        <span className="ss-schedule-list-date">{compactDate(row?.plannedStart)} {row?.plannedFinish?'– '+compactDate(row.plannedFinish):''}</span>
      </button>;
    })}
  </div>;
}
function RowEditor({row,schedule,dealId,canEdit}:{
  row:DealScheduleRow;schedule:DealScheduleDraft;dealId:string;canEdit:boolean;
}){
  const edit=useDealScheduleStore(state=>state.edit);
  const assignImports=useDealScheduleStore(state=>state.assignImports);
  const removePhase=useDealScheduleStore(state=>state.removePhase);
  const imports=schedule.rows.filter(item=>item.scope==='import'&&item.kind==='group');
  const isPhase=row.kind==='group'&&(row.scope==='import'||row.scope==='building');
  const dateField=(field:'plannedStart'|'plannedFinish'|'actualStart'|'actualFinish',label:string)=>
    <label className="ss-schedule-field"><span>{label}</span><input type="date" disabled={!canEdit}
      value={row[field]??''} onChange={event=>edit(dealId,row.id,{[field]:event.target.value||undefined})}/></label>;
  return <section className="ss-schedule-row-editor" aria-label={'Edit '+row.label}>
    <div className="ss-schedule-editor-heading">
      <strong>{row.label}</strong>
      {isPhase&&canEdit&&<button type="button" className="ss-schedule-danger" onClick={()=>{
        if(window.confirm('Remove '+row.label+' and all its milestones?'))removePhase(dealId,row.id);
      }}>Delete phase</button>}
    </div>
    <div className="ss-schedule-editor-grid">
      <label className="ss-schedule-field"><span>Name</span><input type="text" disabled={!canEdit}
        value={row.label} onChange={event=>edit(dealId,row.id,{label:event.target.value})}/></label>
      <label className="ss-schedule-field"><span>Status</span><select disabled={!canEdit} value={row.status}
        onChange={event=>edit(dealId,row.id,{status:event.target.value as DealScheduleStatus})}>
        {STATES.map(state=><option key={state.id} value={state.id}>{state.label}</option>)}
      </select></label>
      {dateField('plannedStart','Planned start')}
      {dateField('plannedFinish','Planned finish')}
      {dateField('actualStart','Actual start')}
      {dateField('actualFinish','Actual finish')}
      {row.kind==='financial'&&<>
        <label className="ss-schedule-field"><span>Amount ($)</span><input type="number" min="0" step="0.01"
          disabled={!canEdit} value={row.amount??''} onChange={event=>{
            const value=event.target.value;
            if(!value||Number.isFinite(Number(value))&&Number(value)>=0)
              edit(dealId,row.id,{amount:value===''?undefined:Number(value)});
          }}/></label>
        <label className="ss-schedule-field"><span>Retainage (%)</span><input type="number" min="0" max="100" step="0.1"
          disabled={!canEdit} value={row.retainagePercent??''} onChange={event=>{
            const value=event.target.value;
            if(!value||Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=100)
              edit(dealId,row.id,{retainagePercent:value===''?undefined:Number(value)});
          }}/></label>
      </>}
    </div>
    {row.kind==='group'&&row.scope==='building'&&<div className="ss-schedule-sources">
      <strong>Imports supplying this building</strong>
      <div className="ss-schedule-source-options">
        {imports.map(item=><label key={item.id}><input type="checkbox" disabled={!canEdit}
          checked={(row.sourceImportIds??[]).includes(item.id)} onChange={event=>{
            const current=row.sourceImportIds??[];
            assignImports(dealId,row.id,event.target.checked?[...current,item.id]:current.filter(id=>id!==item.id));
          }}/>{item.label}</label>)}
      </div>
      <small>Import deliveries become advisory predecessors of this building's material delivery.</small>
    </div>}
    {row.predecessorIds.length>0&&<p className="ss-schedule-predecessors">
      Follows: {row.predecessorIds.map(id=>schedule.rows.find(item=>item.id===id)?.label??id).join(' · ')}
    </p>}
  </section>;
}

export function DealScheduleWorkspace({deal}: {deal:Project}){
  const {scope,ready}=useScheduleScope();
  const schedules=useDealScheduleStore(state=>state.schedules);
  const error=useDealScheduleStore(state=>state.error);
  const begin=useDealScheduleStore(state=>state.begin);
  const addPhase=useDealScheduleStore(state=>state.addPhase);
  const mode=useAuthStore(state=>state.mode);
  const role=useAuthStore(state=>state.teamRole);
  const department=useAuthStore(state=>state.teamDepartment);
  const canEdit=mode!=='cloud'||canEditTeamArea(role,department,'crm');
  const schedule=ready?schedules[deal.id]:undefined;
  const [modeView,setModeView]=useState<'gantt'|'milestones'>('gantt');
  const [collapsed,setCollapsed]=useState<string[]>([]);
  const [selectedId,setSelectedId]=useState<string|undefined>();
  useEffect(()=>{setSelectedId(undefined);setCollapsed([]);},[deal.id,scope]);
  useEffect(()=>{
    if(window.matchMedia('(max-width: 700px)').matches)setModeView('milestones');
  },[]);
  const rows=useMemo(()=>schedule?visibleRows(schedule,new Set(collapsed)):[],[schedule,collapsed]);
  const selected=schedule?.rows.find(row=>row.id===selectedId);
  const progress=schedule?scheduleProgress(schedule):null;
  return <section className="ss-deal-schedule" aria-label="Project timeline">
    <header className="ss-schedule-toolbar">
      <div><h2>Project timeline</h2><p>Phased procurement, building installation and invoicing</p></div>
      {schedule&&<div className="ss-schedule-actions">
        <button type="button" disabled={!canEdit} onClick={()=>addPhase(deal.id,'import')}>+ Import</button>
        <button type="button" disabled={!canEdit} onClick={()=>addPhase(deal.id,'building')}>+ Building</button>
        <div className="ss-schedule-switch" role="group" aria-label="Timeline display">
          <button type="button" aria-pressed={modeView==='gantt'} onClick={()=>setModeView('gantt')}>Gantt</button>
          <button type="button" aria-pressed={modeView==='milestones'} onClick={()=>setModeView('milestones')}>Milestones</button>
        </div>
      </div>}
    </header>
    <p className="ss-schedule-storage-note">Device-only draft · not yet synced to your team or other devices.</p>
    {!ready?<p>Loading project timeline…</p>:!schedule?
      <div className="ss-schedule-empty">
        <p>No execution timeline has been started for this deal. The multifamily starter includes shop drawings, deposit, phased imports, building installs, invoices and retainage; all dates start blank.</p>
        <button type="button" disabled={!canEdit} onClick={()=>begin(deal.id)}>Start multifamily timeline</button>
      </div>:
      <>
        <div className="ss-schedule-overview">
          <span>{progress?.done} of {progress?.total} milestones completed</span>
          <span>{progress?.percent}% complete</span>
          <span>{schedule.rows.filter(row=>row.scope==='import'&&row.kind==='group').length} imports</span>
          <span>{schedule.rows.filter(row=>row.scope==='building'&&row.kind==='group').length} buildings</span>
        </div>
        {modeView==='gantt'?<GanttChart rows={rows} onSelect={setSelectedId} selectedId={selectedId}
          onCollapse={id=>setCollapsed(previous=>previous.includes(id)?previous.filter(key=>key!==id):[...previous,id])}/>:
          <ScheduleMilestoneList schedule={schedule} rows={visibleRows(schedule,new Set())} onSelect={setSelectedId}/>}
        {rows.every(row=>!row.start)&&<p className="ss-schedule-tip">Select a milestone and enter planned dates to populate the Gantt bars. No delivery or installation dates are assumed.</p>}
        {selected&&<RowEditor row={selected} schedule={schedule} dealId={deal.id} canEdit={canEdit}/>}
        {error&&<p role="alert" className="ss-schedule-error">{error}</p>}
      </>}
  </section>;
}

/** Contracted portfolio. Rows show schedule summaries; expand one Deal to inspect phases. */
export function DealTimelinePortfolio({projects,onOpen}:{
  projects:Project[];onOpen:(dealId:string)=>void;
}){
  const {ready}=useScheduleScope();
  const schedules=useDealScheduleStore(state=>state.schedules);
  const [showCompleted,setShowCompleted]=useState(false);
  const [expanded,setExpanded]=useState<string[]>([]);
  const eligible=projects.filter(project=>
    (project.stage==='Closed Won'||(showCompleted&&project.stage==='Completed')||
      (ready&&Boolean(schedules[project.id])&&project.stage!=='Completed'))&&
    (project.stage!=='Completed'||showCompleted));
  const chartRows:VisualRow[]=[];
  for(const deal of eligible){
    const schedule=ready?schedules[deal.id]:undefined;
    if(!schedule){
      chartRows.push({id:deal.id,label:deal.name,level:0,kind:'group',status:'not-started',isGroup:true});
      continue;
    }
    const dates=schedule.rows.flatMap(row=>[row.plannedStart,row.plannedFinish])
      .filter((value):value is string=>Boolean(value)).sort();
    const done=scheduleProgress(schedule).percent;
    chartRows.push({id:deal.id,label:deal.name,level:0,kind:'group',
      status:done===100?'complete':done>0?'in-progress':'not-started',
      start:dates[0],end:dates[dates.length-1],progress:done,isGroup:true,
      collapsed:!expanded.includes(deal.id)});
    if(expanded.includes(deal.id)){
      for(const item of schedule.rows.filter(row=>row.kind==='group'&&
        (row.scope==='import'||row.scope==='building'))){
        const dates=rowDates(item,schedule.rows);
        chartRows.push({id:deal.id+'::'+item.id,label:item.label,level:1,kind:'period',
          status:item.status,start:dates.start,end:dates.end});
      }
    }
  }
  const resolveDeal=(id:string)=>id.split('::')[0];
  return <section className="ss-deal-schedule ss-schedule-portfolio" aria-label="Contracted deals timeline">
    <header className="ss-schedule-toolbar">
      <div><h2>Contracted project timeline</h2><p>Planned work across active deals</p></div>
      <label className="ss-schedule-show-complete"><input type="checkbox" checked={showCompleted}
        onChange={event=>setShowCompleted(event.target.checked)}/>Show completed</label>
    </header>
    <p className="ss-schedule-storage-note">Draft timelines saved only on this device. Team sync is not active.</p>
    {ready&&eligible.length?<GanttChart rows={chartRows} onSelect={id=>onOpen(resolveDeal(id))}
      onCollapse={id=>setExpanded(previous=>previous.includes(id)
        ?previous.filter(key=>key!==id):[...previous,id])}/>:
      <p className="ss-schedule-empty">No contracted deals match this view. Move a Deal to Closed Won, then open it to start its timeline.</p>}
  </section>;
}
