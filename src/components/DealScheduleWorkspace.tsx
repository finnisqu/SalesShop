import {useEffect,useMemo,useState} from 'react';
import type {Project} from '../types/crm';
import type {DealScheduleDraft,DealScheduleRow,DealScheduleStatus} from '../services/dealScheduleTemplates';
import {scheduleProgress} from '../services/dealScheduleEditing';
import {dealScheduleWarnings} from '../services/dealScheduleWarnings';
import {useDealExecutionSchedules} from '../services/useDealExecutionSchedules';
import {useAuthStore} from '../store/authStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {resolveOwnerPerspective} from '../services/rolePerspective';
import {usePersonalTaskStore} from '../store/personalTaskStore';
import {requestTaskModal} from './TaskModalHost';
import {milestoneFollowupFields} from '../services/dealScheduleCalendar';
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
interface VisualRow {
  id:string;
  label:string;
  level:number;
  kind:DealScheduleRow['kind'];
  status:DealScheduleStatus;
  start?:string;
  end?:string;
  actualStart?:string;
  actualEnd?:string;
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
        start:dates.start,end:dates.end,actualStart:row.actualStart??row.actualFinish,actualEnd:row.actualFinish,
        isGroup:row.kind==='group',collapsed:collapsed.has(row.id)});
      if(row.kind==='group'&&!collapsed.has(row.id))walk(row.id,level+1);
    }
  };
  walk(undefined,0);
  return result;
}
function bounds(rows:readonly VisualRow[]):{start:number;days:number;width:number}{
  const days=rows.flatMap(row=>[dayNumber(row.start),dayNumber(row.end),
    dayNumber(row.actualStart),dayNumber(row.actualEnd)])
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
        const actual=dayNumber(row.actualStart),actualEnd=dayNumber(row.actualEnd);
        const actualLeft=actual===undefined?undefined:Math.max(0,(actual-range.start)*scale);
        const actualWidth=actual===undefined?0:Math.max(10,((actualEnd??actual)-actual+1)*scale);
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
            {actualLeft!==undefined&&<button type="button" onClick={()=>onSelect(row.id)}
              className="ss-gantt-actual" style={{left:actualLeft,width:actualWidth}}
              title={'Actual: '+compactDate(row.actualStart)+' – '+compactDate(row.actualEnd)}/>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
function ScheduleMilestoneList({schedule,rows,onSelect,onCollapse}:{
  schedule:DealScheduleDraft;rows:VisualRow[];onSelect:(id:string)=>void;
  onCollapse:(id:string)=>void;
}){
  const byId=new Map(schedule.rows.map(row=>[row.id,row]));
  return <div className="ss-schedule-list">
    {rows.map(item=>{
      const row=byId.get(item.id);
      return <div key={item.id} className="ss-schedule-list-line"
        style={{paddingLeft:4+item.level*14}}>
        <button type="button" className="ss-schedule-list-row"
          aria-expanded={item.isGroup?!item.collapsed:undefined}
          onClick={()=>item.isGroup?onCollapse(item.id):onSelect(item.id)}>
          <span className="ss-schedule-list-name">
            {item.isGroup?(item.collapsed?'▸ ':'▾ '):''}{item.label}
          </span>
          <span className={'ss-schedule-state ss-schedule-'+item.status}>
            {item.isGroup?'Group':STATES.find(state=>state.id===item.status)?.label}
          </span>
          <span className="ss-schedule-list-date">
            {compactDate(row?.plannedStart)} {row?.plannedFinish?'– '+compactDate(row.plannedFinish):''}
          </span>
        </button>
        {item.isGroup&&<button type="button" className="ss-schedule-list-group-edit"
          onClick={()=>onSelect(item.id)} aria-label={'Edit '+item.label}>Edit</button>}
      </div>;
    })}
  </div>;
}
function RowEditor({row,schedule,deal,canEdit}:{
  row:DealScheduleRow;schedule:DealScheduleDraft;deal:Project;canEdit:boolean;
}){
  const dealId=deal.id;
  const createTask=usePersonalTaskStore(state=>state.createTask);
  const taskScope=usePersonalTaskStore(state=>state.scope);
  const personalTasks=usePersonalTaskStore(state=>state.tasks);
  const taskKey='deal-schedule:'+dealId+':'+row.id;
  const linkedTask=personalTasks.find(task=>task.sourceObjectId===taskKey&&!task.deletedAt);
  const {edit,assignImports,removePhase,busy}=useDealExecutionSchedules();
  const enabled=canEdit&&!busy;
  const imports=schedule.rows.filter(item=>item.scope==='import'&&item.kind==='group');
  const isPhase=row.kind==='group'&&(row.scope==='import'||row.scope==='building');
  // Buffer text/number editing until blur. Per-keystroke network writes would
  // interrupt typing and race against another revision-guarded cloud save.
  const [labelDraft,setLabelDraft]=useState(row.label);
  const [amountDraft,setAmountDraft]=useState(row.amount?.toString()??'');
  const [retainageDraft,setRetainageDraft]=useState(row.retainagePercent?.toString()??'');
  const [referenceDraft,setReferenceDraft]=useState(row.reference??'');
  const [notesDraft,setNotesDraft]=useState(row.notes??'');
  const referenceLabel=row.kind==='financial'?'Invoice / payment reference':
    row.scope==='import'?'PO / vessel / tracking reference':'Reference';
  useEffect(()=>{
    setLabelDraft(row.label);
    setAmountDraft(row.amount?.toString()??'');
    setRetainageDraft(row.retainagePercent?.toString()??'');
    setReferenceDraft(row.reference??'');
    setNotesDraft(row.notes??'');
  },[row.id,row.label,row.amount,row.retainagePercent,row.reference,row.notes]);
  const saveNumber=(field:'amount'|'retainagePercent',input:string)=>{
    const value=input.trim();
    const n=Number(value);
    if(value&&( !Number.isFinite(n)||n<0||(field==='retainagePercent'&&n>100)))return;
    if((row[field]??'').toString()!==value)edit(dealId,row.id,{[field]:value===''?undefined:n});
  };
  const dateField=(field:'plannedStart'|'plannedFinish'|'actualStart'|'actualFinish',label:string)=>
    <label className="ss-schedule-field"><span>{label}</span><input type="date" disabled={!enabled}
      value={row[field]??''} onChange={event=>edit(dealId,row.id,{[field]:event.target.value||undefined})}/></label>;
  return <section className="ss-schedule-row-editor" aria-label={'Edit '+row.label}>
    <div className="ss-schedule-editor-heading">
      <strong>{row.label}</strong>
      {isPhase&&enabled&&<button type="button" className="ss-schedule-danger" onClick={()=>{
        if(window.confirm('Remove '+row.label+' and all its milestones?'))removePhase(dealId,row.id);
      }}>Delete phase</button>}
    </div>
    <div className="ss-schedule-editor-grid">
      <label className="ss-schedule-field"><span>Name</span><input type="text" disabled={!enabled}
        value={labelDraft} onChange={event=>setLabelDraft(event.target.value)}
        onBlur={()=>{const name=labelDraft.trim();if(name&&name!==row.label)edit(dealId,row.id,{label:name});else setLabelDraft(row.label);}}
        onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label>
      <label className="ss-schedule-field"><span>Status</span><select disabled={!enabled} value={row.status}
        onChange={event=>edit(dealId,row.id,{status:event.target.value as DealScheduleStatus})}>
        {STATES.map(state=><option key={state.id} value={state.id}>{state.label}</option>)}
      </select></label>
      {dateField('plannedStart','Planned start')}
      {dateField('plannedFinish','Planned finish')}
      {dateField('actualStart','Actual start')}
      {dateField('actualFinish','Actual finish')}
      {row.kind!=='group'&&<label className="ss-schedule-field">
        <span>{referenceLabel}</span>
        <input type="text" maxLength={160} disabled={!enabled} value={referenceDraft}
          placeholder="Optional reference"
          onChange={event=>setReferenceDraft(event.target.value)}
          onBlur={()=>{if(referenceDraft.trim()!==(row.reference??''))edit(dealId,row.id,{reference:referenceDraft});}}
          onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/>
      </label>}
      {row.kind==='financial'&&<>
        <label className="ss-schedule-field"><span>Amount ($)</span><input type="number" min="0" step="0.01"
          disabled={!enabled} value={amountDraft} onChange={event=>setAmountDraft(event.target.value)}
          onBlur={()=>saveNumber('amount',amountDraft)}
          onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label>
        <label className="ss-schedule-field"><span>Retainage (%)</span><input type="number" min="0" max="100" step="0.1"
          disabled={!enabled} value={retainageDraft} onChange={event=>setRetainageDraft(event.target.value)}
          onBlur={()=>saveNumber('retainagePercent',retainageDraft)}
          onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label>
      </>}
    </div>
    <label className="ss-schedule-field ss-schedule-notes-field">
      <span>Milestone notes</span>
      <textarea rows={2} maxLength={2500} disabled={!enabled} value={notesDraft}
        placeholder="Delivery details, invoice notes, field instructions…"
        onChange={event=>setNotesDraft(event.target.value)}
        onBlur={()=>{if(notesDraft.trim()!==(row.notes??''))edit(dealId,row.id,{notes:notesDraft});}}/>
    </label>
    {row.kind==='group'&&row.scope==='building'&&<div className="ss-schedule-sources">
      <strong>Imports supplying this building</strong>
      <div className="ss-schedule-source-options">
        {imports.map(item=><label key={item.id}><input type="checkbox" disabled={!enabled}
          checked={(row.sourceImportIds??[]).includes(item.id)} onChange={event=>{
            const current=row.sourceImportIds??[];
            assignImports(dealId,row.id,event.target.checked?[...current,item.id]:current.filter(id=>id!==item.id));
          }}/>{item.label}</label>)}
      </div>
      <small>Import deliveries become advisory predecessors of this building's material delivery.</small>
    </div>}
    {row.kind!=='group'&&<div className="ss-schedule-task-action">
      {linkedTask?<button type="button" onClick={()=>requestTaskModal({mode:'preview',id:linkedTask.id})}>Open linked Task</button>:
        <button type="button" disabled={!taskScope} onClick={()=>{
          const fields=milestoneFollowupFields(deal,row);
          const id=createTask(fields.title,fields);
          if(id)requestTaskModal({mode:'preview',id});
        }}>+ Create personal follow-up Task</button>}
      <small>Optional · does not create duplicate tasks or change the milestone status</small>
    </div>}
    {row.predecessorIds.length>0&&<p className="ss-schedule-predecessors">
      Follows: {row.predecessorIds.map(id=>schedule.rows.find(item=>item.id===id)?.label??id).join(' · ')}
    </p>}
  </section>;
}

export function DealScheduleWorkspace({deal}: {deal:Project}){
  const {scope,ready,schedules,deviceDrafts,cloud,busy,mutable,error,begin,publish,addPhase,
    storageLabel,refresh}=useDealExecutionSchedules();
  const mode=useAuthStore(state=>state.mode);
  const role=useAuthStore(state=>state.teamRole);
  const department=useAuthStore(state=>state.teamDepartment);
  const perspectiveId=useRolePerspectiveStore(state=>state.activePerspective);
  const simulated=resolveOwnerPerspective(perspectiveId,role,mode);
  const canEdit=(mode!=='cloud'||canEditTeamArea(simulated?.role??role,
    simulated?.department??department,'crm'))&&!busy&&mutable;
  const schedule=ready?schedules[deal.id]:undefined;
  const [modeView,setModeView]=useState<'gantt'|'milestones'>('gantt');
  const [collapsed,setCollapsed]=useState<string[]>([]);
  const [selectedId,setSelectedId]=useState<string|undefined>();
  useEffect(()=>{
    setSelectedId(undefined);
    setCollapsed(window.matchMedia('(max-width: 700px)').matches?['imports','buildings','closeout']:[]);
  },[deal.id,scope]);
  useEffect(()=>{
    if(window.matchMedia('(max-width: 700px)').matches)setModeView('milestones');
  },[]);
  const rows=useMemo(()=>schedule?visibleRows(schedule,new Set(collapsed)):[],[schedule,collapsed]);
  const toggleCollapsed=(id:string)=>setCollapsed(previous=>
    previous.includes(id)?previous.filter(key=>key!==id):[...previous,id]);
  const selected=schedule?.rows.find(row=>row.id===selectedId);
  const progress=schedule?scheduleProgress(schedule):null;
  const warnings=useMemo(()=>schedule?dealScheduleWarnings(schedule):[],[schedule]);
  return <section className="ss-deal-schedule" aria-label="Project timeline">
    <header className="ss-schedule-toolbar">
      <div><h2>Project timeline</h2><p>Phased procurement, building installation and invoicing</p></div>
      {schedule&&<div className="ss-schedule-actions">
        {cloud&&<button type="button" disabled={busy} onClick={refresh}>Refresh</button>}
        <button type="button" disabled={!canEdit} onClick={()=>addPhase(deal.id,'import')}>+ Import</button>
        <button type="button" disabled={!canEdit} onClick={()=>addPhase(deal.id,'building')}>+ Building</button>
        <div className="ss-schedule-switch" role="group" aria-label="Timeline display">
          <button type="button" aria-pressed={modeView==='gantt'} onClick={()=>setModeView('gantt')}>Gantt</button>
          <button type="button" aria-pressed={modeView==='milestones'} onClick={()=>setModeView('milestones')}>Milestones</button>
        </div>
      </div>}
    </header>
    <p className="ss-schedule-storage-note">{storageLabel}{busy?' · Saving…':''}</p>
    {!ready?(error?<div role="alert" className="ss-schedule-error">{error} <button type="button" onClick={refresh}>Retry</button></div>
       :<p>Loading project timeline…</p>):!schedule?
      <div className="ss-schedule-empty">
        <p>No execution timeline has been started for this deal. The multifamily starter includes shop drawings, deposit, phased imports, building installs, invoices and retainage; all dates start blank.</p>
        <button type="button" disabled={!canEdit} onClick={()=>begin(deal.id)}>Start multifamily timeline</button>
        {cloud&&deviceDrafts[deal.id]&&<button type="button" disabled={!canEdit} onClick={()=>publish(deal.id)}>
          Publish existing device draft to team (only if no shared schedule exists)</button>}
      </div>:
      <>
        <div className="ss-schedule-overview">
          <span>{progress?.done} of {progress?.total} milestones completed</span>
          <span>{progress?.percent}% complete</span>
          <span>{schedule.rows.filter(row=>row.scope==='import'&&row.kind==='group').length} imports</span>
          <span>{schedule.rows.filter(row=>row.scope==='building'&&row.kind==='group').length} buildings</span>
        </div>
        {warnings.length>0&&<details className="ss-schedule-warnings">
          <summary>{warnings.length} schedule {warnings.length===1?'warning':'warnings'} ·
            {warnings.filter(item=>item.kind==='overdue').length} overdue ·
            {warnings.filter(item=>item.kind==='sequence').length} dependency overlaps
          </summary>
          <div className="ss-schedule-warning-list">
            {warnings.map(item=><button key={item.id} type="button"
              onClick={()=>setSelectedId(item.rowId)}>
              <strong>{item.kind==='overdue'?'Overdue':'Sequence'} · {item.label}</strong>
              <span>{item.detail}</span>
            </button>)}
          </div>
        </details>}
        {modeView==='gantt'?<GanttChart rows={rows} onSelect={setSelectedId} selectedId={selectedId}
          onCollapse={toggleCollapsed}/>:
          <ScheduleMilestoneList schedule={schedule} rows={rows}
            onSelect={setSelectedId} onCollapse={toggleCollapsed}/>}
        {modeView==='gantt'&&<p className="ss-schedule-legend">Solid bar: planned dates · Dark line: actual dates · Orange line: today</p>}
        {rows.every(row=>!row.start)&&<p className="ss-schedule-tip">Select a milestone and enter planned dates to populate the Gantt bars. No delivery or installation dates are assumed.</p>}
        {selected&&<RowEditor row={selected} schedule={schedule} deal={deal} canEdit={canEdit}/>}
        {error&&<p role="alert" className="ss-schedule-error">{error}{cloud&&<button type="button" onClick={refresh}>Refresh</button>}</p>}
      </>}
  </section>;
}

/** Contracted portfolio. Rows show schedule summaries; expand one Deal to inspect phases. */
export function DealTimelinePortfolio({projects,onOpen}:{
  projects:Project[];onOpen:(dealId:string)=>void;
}){
  const {ready,schedules,cloud,busy,storageLabel,error,refresh}=useDealExecutionSchedules();
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
      <div className="ss-schedule-actions">
       <label className="ss-schedule-show-complete"><input type="checkbox" checked={showCompleted}
         onChange={event=>setShowCompleted(event.target.checked)}/>Show completed</label>
       {cloud&&<button type="button" disabled={busy} onClick={refresh}>Refresh</button>}
      </div>
    </header>
    <p className="ss-schedule-storage-note">{storageLabel}</p>
    {error&&<p role="alert" className="ss-schedule-error">{error} <button type="button" onClick={refresh}>Retry</button></p>}
    {ready&&eligible.length?<GanttChart rows={chartRows} onSelect={id=>onOpen(resolveDeal(id))}
      onCollapse={id=>setExpanded(previous=>previous.includes(id)
        ?previous.filter(key=>key!==id):[...previous,id])}/>:
      <p className="ss-schedule-empty">No contracted deals match this view. Move a Deal to Closed Won, then open it to start its timeline.</p>}
  </section>;
}
