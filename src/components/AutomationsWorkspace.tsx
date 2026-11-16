import {useMemo,useState} from 'react';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {taskScope,usePersonalTaskStore} from '../store/personalTaskStore';
import {useAutomationStore} from '../store/automationStore';
import {buildSalesQuoteRegistry,mySalesQuoteRegistry} from '../services/salesQuoteRegistry';
import {AUTOMATION_IDS,automationCandidates,type AutomationRuleId} from '../services/automationRules358b';
import {executeAutomationCandidates} from '../services/automationExecutor358b';
import {requestTaskModal} from '../services/taskModalEvents';
import './automations-workspace.css';

const descriptions:Record<AutomationRuleId,{title:string;explanation:string;timing:string}>={
 'quote-delivered':{
  title:'Quote delivered → Follow-up',
  explanation:'Create a private follow-up Task from confirmed SalesShop delivery or a recorded external bid. No email or text is sent.',
  timing:'Days after delivery',
 },
 'deal-inactive':{
  title:'Inactive Deal → Reminder',
  explanation:'If a current open Deal has no logged customer interaction, prepare a reminder for its assigned salesperson.',
  timing:'Days without contact',
 },
 'deal-won':{
  title:'Deal Won → Handoff',
  explanation:'Prepare an internal checklist after a recorded Closed Won stage change. No invoices or external alerts are sent.',
  timing:'Days after Won',
 },
};
export function AutomationsWorkspace(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
 user=useAuthStore(s=>s.user?.id),
 role=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
 const previewRole=useRolePerspectiveStore(s=>s.activePerspective);
 const scope=taskScope(mode,org,user),automationScope=useAutomationStore(s=>s.scope);
 const storedTaskScope=usePersonalTaskStore(s=>s.scope),taskSync=usePersonalTaskStore(s=>s.syncStatus);
 const rules=useAutomationStore(s=>s.rules),history=useAutomationStore(s=>s.history),
 live=useAutomationStore(s=>s.autoRunWhileOpen);
 const configure=useAutomationStore(s=>s.configure),toggleLive=useAutomationStore(s=>s.toggleLive);
 const deals=useCrmStore(s=>s.projects),activities=useCrmStore(s=>s.activities);
 const quotes=useQuoteStore(s=>s.quotes),tasks=usePersonalTaskStore(s=>s.tasks);
 const [notice,setNotice]=useState('');
 const linkedQuotes=useMemo(()=>
  mySalesQuoteRegistry(buildSalesQuoteRegistry(quotes,activities,deals),mode,user,deals),
  [quotes,activities,deals,mode,user]);
 const candidates=useMemo(()=>automationCandidates({
  deals,quotes:linkedQuotes,activities,tasks,rules,now:new Date(),mode,userId:user,
 }),[deals,linkedQuotes,activities,tasks,rules,mode,user]);
 const ready=!!scope&&scope===automationScope&&scope===storedTaskScope&&!previewRole&&
  (mode==='local'||(canEditTeamArea(role,department,'crm')&&taskSync==='saved'));
 const run=()=>{
  if(!scope||!ready)return;
  const result=executeAutomationCandidates(scope,candidates);
  setNotice(result.created+' Task'+(result.created===1?'':'s')+' created.'+
   (result.errors.length?' '+result.errors.join(' '):''));
 };
 return <section className="ss-automation-workspace" aria-label="Workflow automations">
  <header><div><small>WORKFLOWS · PROTOTYPE V0.1</small><h2>Automations</h2>
   <p>Turn repeated sales activities into private, trackable Tasks.</p></div>
   <span>Local rules · no background server</span>
  </header>
  <div className="ss-automation-intro">
   {!ready&&<p role="status">Automations are read-only until your private Tasks have finished syncing and your role allows CRM edits.</p>}
   <strong>Rules start off.</strong> Enable each rule you want, preview its matches, then run it.
   You can also opt into automatic checks while SalesShop is open. Offline or closed-browser
   execution is not supported yet, and these rules never send customer messages.
  </div>
  <div className="ss-automation-rules">
   {AUTOMATION_IDS.map(id=>{
    const config=rules[id],label=descriptions[id];
    return <article key={id} className="ss-automation-rule">
     <div className="ss-automation-rule-top">
      <div><h3>{label.title}</h3><p>{label.explanation}</p></div>
      <label className="ss-automation-toggle">
       <input type="checkbox" checked={config.enabled} disabled={!ready}
        onChange={e=>{configure(id,{enabled:e.target.checked});setNotice('');}}/>
       <span>{config.enabled?'Enabled':'Off'}</span>
      </label>
     </div>
     <label className="ss-automation-days">{label.timing}
      <select value={config.days} disabled={!ready}
       onChange={e=>configure(id,{days:Number(e.target.value)})}>
       {[1,2,3,5,7,14,21,30,45,60].map(days=><option key={days} value={days}>{days} {days===1?'day':'days'}</option>)}
      </select>
     </label>
     <small>{candidates.filter(row=>row.rule===id).length} new match(es) available now</small>
    </article>;
   })}
  </div>
  <div className="ss-automation-execution">
   <label><input type="checkbox" checked={live} disabled={!ready}
     onChange={e=>toggleLive(e.target.checked)}/>
    Automatically run enabled rules while SalesShop is open
   </label>
   <div><strong>{candidates.length} pending action(s)</strong>
    <button type="button" disabled={!ready||!candidates.length} onClick={run}>Run enabled rules</button></div>
   {notice&&<p role="status">{notice}</p>}
   {candidates.length>0&&<div className="ss-automation-preview">
    <h3>Preview · next actions</h3>
    {candidates.slice(0,20).map(row=><div key={row.sourceObjectId}>
     <strong>{row.title}</strong><span>{row.context}</span>
     <small>{row.changes.dueDate?'Due '+row.changes.dueDate:''}</small>
    </div>)}
    {candidates.length>20&&<p>Showing first 20. Run again for remaining matches.</p>}
   </div>}
  </div>
  <section className="ss-automation-history" aria-label="Automation run history">
   <h3>Created Task history</h3>
   {history.length?<div className="ss-automation-history-list">
    {history.slice(0,30).map(item=><div key={item.id}>
     <div><strong>{item.title}</strong>
      <span>{descriptions[item.rule].title} · {new Date(item.at).toLocaleString()}</span>
     </div>
     <button type="button" onClick={()=>requestTaskModal({mode:'preview',id:item.taskId})}>
       Open Task
     </button>
    </div>)}
   </div>:<p>No Tasks created by these rules yet.</p>}
  </section>
  <footer>Each generated Task has a stable automation reference to prevent repeat creation after
   refresh or manual deletion. The log is local to this browser and user; a cloud scheduler
   with server-side uniqueness is required for dependable unattended, multi-device execution.
   Automatic execution has a 20-Task cap per open session; manual runs let you review
   additional matches before creating them.</footer>
 </section>;
}
