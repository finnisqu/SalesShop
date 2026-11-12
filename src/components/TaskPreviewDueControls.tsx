import type {PersonalTask,TaskChanges} from '../store/personalTaskStore';
import {isProtectedBidTask} from '../store/personalTaskStore';
import {taskDuePresetDate,type TaskDuePreset} from '../services/taskSchedule';
import {localDateKey} from '../services/salesCalendar';

/** Same schedule actions for Tasks-page and Home/Calendar task Quick Views.
 * Never detach generated bid deadlines from their linked Deal due date. */
export function TaskPreviewDueControls({task,onUpdate}:{
 task:PersonalTask;onUpdate:(id:string,changes:TaskChanges)=>void;
}){
 if(isProtectedBidTask(task))return <p className="tasks-preview-bid-due-info">
  Bid deadline follows the linked Deal. Change the Deal due date to reschedule.
 </p>;
 if(task.status==='completed'||task.status==='canceled'||task.completedAt)return null;
 const apply=(date:string|undefined)=>onUpdate(task.id,{
  dueDate:date,dueTime:date?task.dueTime:undefined,
 });
 return <div className="tasks-preview-quick-schedule" aria-label="Reschedule task">
  <label>Reschedule
   <select value="" aria-label={'Quick reschedule '+task.title}
    onChange={event=>{
      const preset=event.currentTarget.value as TaskDuePreset|'';
      if(preset)apply(taskDuePresetDate(localDateKey(new Date()),preset));
    }}>
    <option value="">Quick date…</option>
    <option value="today">Today</option>
    <option value="tomorrow">Tomorrow</option>
    <option value="next-week">In 7 days</option>
    <option value="clear">Clear due date</option>
   </select>
  </label>
  <label>Or choose a date
   <input type="date" aria-label={'Due date for '+task.title}
    value={task.dueDate??''} onChange={event=>apply(event.currentTarget.value||undefined)}/>
  </label>
 </div>;
}
