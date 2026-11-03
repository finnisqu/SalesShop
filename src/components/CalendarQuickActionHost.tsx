import {useEffect,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {TaskEditor} from './TasksWorkspace';
import {usePersonalTaskStore,taskScope,type TaskChanges} from '../store/personalTaskStore';
import {useCrmStore} from '../store/crmStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {MobileSheetGrabber} from './MobileSheetGrabber';
import './sales-calendar.css';

export type CalendarQuickAction='task'|'bid';
export const requestCalendarQuickAction=(action:CalendarQuickAction,date:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
 window.dispatchEvent(new CustomEvent('salesshop:calendar-quick-action',
  {detail:{action,date}}));
};
/** Shared action host: Calendar can open tasks/bid deadlines from any tab
 * without importing the task editor into the Calendar component itself. */
export function CalendarQuickActionHost(){
 const [taskDate,setTaskDate]=useState<string|null>(null);
 const [bidDate,setBidDate]=useState<string|null>(null);
 const [dealId,setDealId]=useState(''),[bidTime,setBidTime]=useState(''),[error,setError]=useState('');
 const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
 const mode=useAuthStore(s=>s.mode),organizationId=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const load=usePersonalTaskStore(s=>s.load),createTask=usePersonalTaskStore(s=>s.createTask);
 const deals=useCrmStore(s=>s.projects),updateDeal=useCrmStore(s=>s.updateProject);
 const taskContext=taskScope(mode,organizationId,userId);
 const crmWritable=!rolePreview&&(mode==='local'||canEditTeamArea(role,department,'crm'));
 useEffect(()=>{
  const handle=(event:Event)=>{
   const detail=(event as CustomEvent<{action:CalendarQuickAction;date:string}>).detail;
   if(!detail||!/^(19|20)\d{2}-\d{2}-\d{2}$/.test(detail.date))return;
   if(detail.action==='task'&&taskContext){
    load(taskContext);setTaskDate(detail.date);setBidDate(null);
   }else if(detail.action==='bid'&&crmWritable){
    setBidDate(detail.date);setBidTime('');setDealId('');setError('');setTaskDate(null);
   }
  };
  window.addEventListener('salesshop:calendar-quick-action',handle);
  return()=>window.removeEventListener('salesshop:calendar-quick-action',handle);
 },[taskContext,load,crmWritable]);
 if(rolePreview)return null;
 return <>
  {taskDate&&<TaskEditor key={'calendar-'+taskDate} initial={{
    title:'',dueDate:taskDate,type:'todo'
   }} onCancel={()=>setTaskDate(null)}
   onSave={(changes:TaskChanges&{title:string})=>{
    if(createTask(changes.title,changes))setTaskDate(null);
   }}/>}
  {bidDate&&crmWritable&&createPortal(<div className="sales-activity-backdrop"
    onPointerDown={e=>{if(e.target===e.currentTarget)setBidDate(null);}}>
    <form className="sales-activity-dialog" role="dialog" aria-modal="true"
     aria-label="Set bid deadline" onSubmit={(event:FormEvent)=>{
      event.preventDefault();
      if(!dealId||!deals.some(d=>d.id===dealId)){
       setError('Choose a Deal.');return;
      }
      updateDeal(dealId,{bidDueDate:bidDate,bidDueTime:bidTime||undefined,dueDate:bidDate});
      setBidDate(null);
     }}>
     <MobileSheetGrabber onDismiss={()=>setBidDate(null)}/>
     <header><div><small>CALENDAR · DEAL</small><h2>Set bid deadline</h2></div>
      <button type="button" aria-label="Close bid deadline editor" onClick={()=>setBidDate(null)}>×</button>
     </header>
     <div className="sales-activity-form-body">
      <label>Deal
       <select autoFocus required value={dealId} onChange={e=>setDealId(e.target.value)}>
        <option value="">Choose a Deal…</option>
        {deals.filter(d=>!['Closed Won','Closed Lost','Completed'].includes(d.stage))
         .map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
       </select>
      </label>
      <label>Bid due date<input type="date" required value={bidDate}
       onChange={e=>setBidDate(e.target.value)}/></label>
      <label>Due time (optional)<input type="time" value={bidTime}
       onChange={e=>setBidTime(e.target.value)}/></label>
      {error&&<p role="alert" className="sales-activity-error">{error}</p>}
     </div>
     <footer><button type="button" onClick={()=>setBidDate(null)}>Cancel</button>
      <button type="submit">Save bid deadline</button></footer>
    </form>
   </div>,document.body)}
 </>;
}
