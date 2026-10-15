import type {PersonalTask} from '../store/personalTaskStore';
import type {QuoteFollowUpItem} from './quoteFollowUps';
import {followUpLocalDate} from './quoteFollowUps';

export type HomeAgendaItem=
 |{kind:'task';id:string;task:PersonalTask;priority:number;dueDate?:string}
 |{kind:'quote';id:string;followUp:QuoteFollowUpItem;priority:number;dueDate?:string};

/** One queue for confirmed personal to-dos and existing quote follow-ups.
 * Automated "awaiting reply" suggestions are NOT invented due dates. */
export function buildHomeAgenda(
 tasks:readonly PersonalTask[],followUps:readonly QuoteFollowUpItem[],today=followUpLocalDate(),
 limit=9,
):HomeAgendaItem[]{
 const manual:HomeAgendaItem[]=tasks
   .filter(t=>!t.completedAt&&(!t.dueDate||t.dueDate<=today))
   .map(task=>({kind:'task',id:'task:'+task.id,task,dueDate:task.dueDate,
     priority:task.dueDate&&task.dueDate<today?0:task.dueDate===today?1:2}));
 const quote:HomeAgendaItem[]=followUps.map(followUp=>({
   kind:'quote',id:'quote:'+followUp.quote.id,followUp,dueDate:followUp.dueDate,
   priority:followUp.priority==='due'?1:followUp.priority==='needs-delivery'?3:
     followUp.priority==='ready-to-review'?4:followUp.priority==='awaiting-reply'?5:6,
 }));
 return [...manual,...quote].sort((a,b)=>a.priority-b.priority||
   (a.dueDate??'9999').localeCompare(b.dueDate??'9999')||a.id.localeCompare(b.id)).slice(0,limit);
}
export function nextLocalDay(today=followUpLocalDate()){
 const [year,month,day]=today.split('-').map(Number);
 const date=new Date(year,month-1,day+1);
 return followUpLocalDate(date);
}
