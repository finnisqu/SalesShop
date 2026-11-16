import {useState} from 'react';
import type {Project} from '../types/crm';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {usePersonalTaskStore,taskScope,normalizedTaskAssociations,dealNeedsSubmission} from '../store/personalTaskStore';
import {requestTaskModal} from '../services/taskModalEvents';
import {bidReminderDate,bidReminderTitle} from '../services/bidReminderPlanning353d';
import './deal-bid-reminder.css';
const todayLocal=()=>{const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');};
/** Optional personal reminder. Never completes/changes the protected Submit Quote Task. */
export function DealBidReminder({deal}:{deal:Project}){
 const [leadDays,setLeadDays]=useState<1|3|7>(3);
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId);
 const user=useAuthStore(s=>s.user?.id),preview=useRolePerspectiveStore(s=>s.activePerspective);
 const scope=taskScope(mode,org,user),storedScope=usePersonalTaskStore(s=>s.scope);
 if(!scope||storedScope!==scope||preview||!dealNeedsSubmission(deal)||!deal.dueDate)return null;
 const available=([1,3,7] as const).filter(days=>{
  const date=bidReminderDate(deal.dueDate!,days);
  return date!==null&&date>=todayLocal();
 });
 const days=available.includes(leadDays)?leadDays:available[0];
 const date=days?bidReminderDate(deal.dueDate,days):null;
 const title=bidReminderTitle(deal.name);
 const plan=()=>{
  if(!date||usePersonalTaskStore.getState().scope!==scope)return;
  const existing=usePersonalTaskStore.getState().tasks.find(task=>
   !task.deletedAt&&task.workspaceScope===scope&&
   task.status!=='completed'&&task.status!=='canceled'&&
   task.dueDate===date&&task.title===title&&normalizedTaskAssociations(task)
    .some(link=>link.type==='project'&&link.id===deal.id));
  if(existing){requestTaskModal({mode:'preview',id:existing.id});return;}
  requestTaskModal({mode:'create',title,dueDate:date,type:'follow-up',
   associations:[{type:'project',id:deal.id,label:'Deal · '+deal.name}],
   notes:'Personal reminder ahead of the bid deadline '+deal.dueDate+
    '. Review this Task if the Deal due date changes.'});
 };
 return <div className="ss-deal-bid-reminder" aria-label="Plan a bid reminder">
  <div><strong>Plan a bid reminder</strong>
   <small>Personal Task · bid due {deal.dueDate}. Does not submit a quote.</small></div>
  {available.length?<div className="ss-deal-bid-reminder-controls">
   <label>Before deadline
    <select value={days} onChange={event=>setLeadDays(Number(event.target.value) as 1|3|7)}>
     {available.map(option=><option key={option} value={option}>
      {option} {option===1?'day':'days'} before</option>)}
    </select>
   </label>
   <button type="button" onClick={plan}>Plan {date} ›</button>
  </div>:<small>No earlier reminder day available. You can create a same-day Task below.</small>}
 </div>;
}
