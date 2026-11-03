import {useEffect,useMemo} from 'react';
import {useQuoteStore} from '../store/quoteStore';
import {useCrmStore} from '../store/crmStore';
import {useAuthStore} from '../store/authStore';
import {useNavigationStore} from '../store/navigationStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {homeQuoteAttention,homeRecentQuotes,personalHomeQuotes} from '../services/homeOverview';
import {displayQuoteNumber} from '../types/quote';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {buildHomeAgenda,nextLocalDay} from '../services/homeAgenda';
import {QuickCreate} from './QuickCreate';
import {QuickActivityLauncher} from './QuickActivityLauncher';
import {SalesCalendarLauncher} from './SalesCalendarLauncher';
import '../home-workspace.css';

const day=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'});
const shortDate=(value:string)=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});

export function HomeWorkspace(){
 const quotes=useQuoteStore(s=>s.quotes);
 const hydrated=useQuoteStore(s=>s.hydrated),hydrate=useQuoteStore(s=>s.hydrate);
 const activities=useCrmStore(s=>s.activities);
 const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id),
  organizationId=useAuthStore(s=>s.organizationId);
 const role=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
 const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
 const setView=useNavigationStore(s=>s.setView),openQuote=useNavigationStore(s=>s.openQuote);
 const storedTasks=usePersonalTaskStore(s=>s.tasks),storedScope=usePersonalTaskStore(s=>s.scope);
 const loadTasks=usePersonalTaskStore(s=>s.load);
 const completeTask=usePersonalTaskStore(s=>s.complete),snoozeTask=usePersonalTaskStore(s=>s.snooze);
 const myTaskScope=taskScope(mode,organizationId,userId);
 useEffect(()=>hydrate(),[hydrate]);
 useEffect(()=>loadTasks(myTaskScope),[loadTasks,myTaskScope]);

 const mine=useMemo(()=>rolePreview?[]:personalHomeQuotes(quotes,userId,mode==='cloud'),
  [quotes,userId,mode,rolePreview]);
 const attention=useMemo(()=>homeQuoteAttention(mine,activities),[mine,activities]);
 const recent=useMemo(()=>homeRecentQuotes(mine),[mine]);
 const myTasks=!rolePreview&&storedScope===myTaskScope?storedTasks:[];
 const agenda=useMemo(()=>buildHomeAgenda(myTasks,attention),[myTasks,attention]);
 const canCreate=!rolePreview&&(mode==='local'||!!(userId&&canEditTeamArea(role,department,'quotes')));

 return <main className="sales-home is-calendar-home" aria-label="My SalesShop home">
  <header className="sales-home-heading">
   <div><span className="sales-home-eyebrow">MY WORKSPACE</span>
    <h1>Today</h1><p>{day.format(new Date())} · Your work, dates, and recent records in one place.</p></div>
   <div className="sales-home-top-actions" aria-label="Start work">
    <QuickActivityLauncher />
    {canCreate&&<QuickCreate />}
   </div>
  </header>
  <section className="sales-home-calendar-card" aria-label="Work calendar">
   <div className="sales-home-calendar-intro">
    <div><h2>Calendar</h2><p>Tasks, bid deadlines, activities, and follow-ups.</p></div>
    <button type="button" onClick={()=>setView('tasks')}>All tasks ›</button>
   </div>
   <SalesCalendarLauncher embedded />
  </section>

  <div className="sales-home-columns">
   <section className="sales-home-panel sales-home-attention" aria-label="My tasks and quote follow-ups">
    <div className="sales-home-section-head"><div><h2>My Today</h2>
     <p>A focused list of tasks and quote follow-ups</p></div>
     <button type="button" className="sales-home-add-task" onClick={()=>setView('tasks')}>Open Tasks ›</button>
    </div>
    {agenda.length?<ul className="sales-home-agenda-scroll">{agenda.map(item=>item.kind==='task'
     ?<li key={item.id} className="sales-home-task-row">
       <label className="sales-home-task-check">
        <input type="checkbox" checked={false} onChange={()=>completeTask(item.task.id)}
         aria-label={'Complete '+item.task.title}/>
        <span><strong>{item.task.title}</strong>
         <small>{item.task.dueDate?'Due '+item.task.dueDate:'Anytime'} · Personal task</small></span>
       </label>
       <div className="sales-home-task-actions">
        {item.task.linked?.type==='quote'&&mine.some(q=>q.id===item.task.linked?.id)&&
         <button type="button" onClick={()=>openQuote(item.task.linked!.id)}>Open quote</button>}
        <button type="button" onClick={()=>snoozeTask(item.task.id,nextLocalDay())}>Tomorrow</button>
       </div>
      </li>
     :<li key={item.id}><button type="button" className="sales-home-workitem"
       onClick={()=>openQuote(item.followUp.quote.id)}>
       <span className={'sales-home-priority is-'+item.followUp.priority}>{item.followUp.label}</span>
       <strong>{item.followUp.quote.title||'Untitled quote'}</strong>
       <small>{item.followUp.quote.companyName||displayQuoteNumber(item.followUp.quote)}
        {item.followUp.dueDate?' · Due '+item.followUp.dueDate:''}</small>
       <span className="sales-home-item-explainer">{item.followUp.reason}</span>
      </button></li>)}</ul>
     :<div className="sales-home-empty"><strong>{hydrated?'All caught up for now.':'Loading your work…'}</strong>
       <p>{hydrated?'Calendar dates and any tasks you add will appear here.':'Checking your private workspace.'}</p></div>}
   </section>
   <section className="sales-home-panel sales-home-recent" aria-label="My recent work">
    <div className="sales-home-section-head"><div><h2>Pick up where you left off</h2>
     <p>Your recently edited quotes</p></div>
     <button type="button" className="sales-home-add-task" onClick={()=>setView('quotes')}>All quotes ›</button>
    </div>
    {recent.length?<ul className="sales-home-recent-scroll">{recent.map(quote=><li key={quote.id}>
     <button type="button" className="sales-home-workitem sales-home-recent-item" onClick={()=>openQuote(quote.id)}>
      <strong>{quote.title||'Untitled quote'}</strong>
      <small>{quote.companyName||'Not linked to an account'} · {displayQuoteNumber(quote)}</small>
      <span>Edited {shortDate(quote.updatedAt)}</span>
     </button>
    </li>)}</ul>
     :<div className="sales-home-empty"><p>No recent quotes yet. Use + to start one with a template.</p></div>}
   </section>
  </div>
 </main>;
}
