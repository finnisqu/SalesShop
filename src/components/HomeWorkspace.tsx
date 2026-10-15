import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useQuoteStore} from '../store/quoteStore';
import {useCrmStore} from '../store/crmStore';
import {useAuthStore} from '../store/authStore';
import {useNavigationStore} from '../store/navigationStore';
import {useQuoteLibraryStore} from '../store/quoteLibraryStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {homeMonthlyMetrics,homeQuoteAttention,homeRecentQuotes,personalHomeQuotes} from '../services/homeOverview';
import {displayQuoteNumber} from '../types/quote';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {buildHomeAgenda,nextLocalDay} from '../services/homeAgenda';
import {followUpLocalDate} from '../services/quoteFollowUps';
import '../home-workspace.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const day=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'});
const shortDate=(value:string)=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});

export function HomeWorkspace(){
  const quotes=useQuoteStore(s=>s.quotes);
  const hydrated=useQuoteStore(s=>s.hydrated);
  const hydrate=useQuoteStore(s=>s.hydrate);
  const activities=useCrmStore(s=>s.activities);
  const mode=useAuthStore(s=>s.mode);
  const userId=useAuthStore(s=>s.user?.id);
  const organizationId=useAuthStore(s=>s.organizationId);
  const storedTasks=usePersonalTaskStore(s=>s.tasks);
  const storedScope=usePersonalTaskStore(s=>s.scope);
  const loadTasks=usePersonalTaskStore(s=>s.load);
  const addTask=usePersonalTaskStore(s=>s.add);
  const completeTask=usePersonalTaskStore(s=>s.complete);
  const snoozeTask=usePersonalTaskStore(s=>s.snooze);
  const role=useAuthStore(s=>s.teamRole);
  const department=useAuthStore(s=>s.teamDepartment);
  const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
  const setView=useNavigationStore(s=>s.setView);
  const openQuote=useNavigationStore(s=>s.openQuote);
  const [creating,setCreating]=useState(false);
  const [newName,setNewName]=useState('');
  const [showTaskForm,setShowTaskForm]=useState(false);
  const [taskName,setTaskName]=useState('');
  const [taskDue,setTaskDue]=useState(followUpLocalDate());
  const [taskQuoteId,setTaskQuoteId]=useState('');
  const isCloud=mode==='cloud';
  const canCreate=!rolePreview&&(!isCloud||Boolean(userId&&canEditTeamArea(role,department,'quotes')));
  useEffect(()=>hydrate(),[hydrate]);
  const myTaskScope=taskScope(mode,organizationId,userId);
  useEffect(()=>loadTasks(myTaskScope),[loadTasks,myTaskScope]);

  // Private home deliberately refuses unattributed legacy team records.
  const mine=useMemo(()=>personalHomeQuotes(quotes,userId,isCloud),[quotes,userId,isCloud]);
  const attention=useMemo(()=>homeQuoteAttention(mine,activities),[mine,activities]);
  const recent=useMemo(()=>homeRecentQuotes(mine),[mine]);
  const myTasks=storedScope===myTaskScope?storedTasks:[];
  const agenda=useMemo(()=>buildHomeAgenda(myTasks,attention),[myTasks,attention]);
  const month=useMemo(()=>homeMonthlyMetrics(mine),[mine]);
  const create= (event:FormEvent)=>{
    event.preventDefault();
    const title=newName.trim();
    if(!title||!canCreate)return;
    const id=useQuoteStore.getState().createQuote({title});
    useQuoteLibraryStore.getState().setMode('mine');
    setCreating(false);setNewName('');
    openQuote(id);
  };
  const openQuickNote=()=>window.dispatchEvent(new Event('sales-shop:global-post-it'));
  const saveTask=(event:FormEvent)=>{
    event.preventDefault();if(!taskName.trim()||!myTaskScope)return;
    addTask(taskName,taskDue||undefined,taskQuoteId?{type:'quote',id:taskQuoteId}:undefined);
    setTaskName('');setTaskDue(followUpLocalDate());setTaskQuoteId('');setShowTaskForm(false);
  };
  const openLinkedTask=(id?:string)=>{if(id&&mine.some(q=>q.id===id))openQuote(id);};

  return <main className="sales-home" aria-label="My SalesShop home">
    <header className="sales-home-heading">
      <div><span className="sales-home-eyebrow">MY WORKSPACE</span>
        <h1>Today</h1><p>{day.format(new Date())} · Everything you need to keep work moving.</p>
      </div>
    </header>

    {canCreate&&<button type="button" className="sales-home-primary" onClick={()=>{setNewName('');setCreating(true);}}>
      <span aria-hidden="true">＋</span> New Quote
    </button>}
    <section className="sales-home-shortcuts" aria-label="Quick starts">
      <h2>Quick starts</h2>
      <div className="sales-home-shortcut-grid">
        <button type="button" onClick={()=>setView('quotes')}><span aria-hidden="true">▤</span><strong>Quote templates</strong><small>Open the document library</small></button>
        <button type="button" onClick={()=>setView('board')}><span aria-hidden="true">▦</span><strong>Board</strong><small>Projects and accounts</small></button>
        {!rolePreview&&<button type="button" onClick={openQuickNote}><span aria-hidden="true">▧</span><strong>Quick Note</strong><small>Capture without leaving</small></button>}
      </div>
    </section>

    <div className="sales-home-columns">
      <section className="sales-home-panel sales-home-attention" aria-label="My tasks and quote follow-ups">
        <div className="sales-home-section-head"><div><h2>My Today</h2>
          <p>One list for personal tasks and quote follow-ups</p></div>
          <button type="button" className="sales-home-add-task" onClick={()=>setShowTaskForm(v=>!v)} disabled={!myTaskScope||!!rolePreview}>+ Task</button>
        </div>
        {showTaskForm&&myTaskScope&&<form className="sales-home-task-form" onSubmit={saveTask}>
          <label>What needs doing?
            <input autoFocus value={taskName} maxLength={240} required placeholder="e.g. Call about field measurements"
              onChange={e=>setTaskName(e.target.value)}/>
          </label>
          <label>Due date
            <input type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/>
          </label>
          <label>Associated quote (optional)
            <select value={taskQuoteId} onChange={e=>setTaskQuoteId(e.target.value)}>
              <option value="">No associated quote</option>
              {mine.map(quote=><option value={quote.id} key={quote.id}>{quote.title||'Untitled quote'}</option>)}
            </select>
          </label>
          <div><button type="button" onClick={()=>setShowTaskForm(false)}>Cancel</button>
            <button type="submit" disabled={!taskName.trim()}>Add task</button></div>
          <small>Tasks are private to your signed-in profile on this device; cross-device task sync is not enabled yet.</small>
        </form>}
        {agenda.length?<ul>{agenda.map(item=>item.kind==='task'
          ?<li key={item.id} className="sales-home-task-row">
            <label className="sales-home-task-check">
              <input type="checkbox" checked={false} onChange={()=>completeTask(item.task.id)}
                aria-label={'Complete '+item.task.title}/>
              <span><strong>{item.task.title}</strong>
                <small>{item.task.dueDate?'Due '+item.task.dueDate:'Anytime'} · Personal task</small></span>
            </label>
            <div className="sales-home-task-actions">
              {item.task.linked?.type==='quote'&&mine.some(q=>q.id===item.task.linked?.id)&&
                <button type="button" onClick={()=>openLinkedTask(item.task.linked?.id)}>Open quote</button>}
              <button type="button" onClick={()=>snoozeTask(item.task.id,nextLocalDay())}>Tomorrow</button>
            </div>
          </li>
          :<li key={item.id}>
            <button type="button" className="sales-home-workitem" onClick={()=>openQuote(item.followUp.quote.id)}>
              <span className={'sales-home-priority is-'+item.followUp.priority}>{item.followUp.label}</span>
              <strong>{item.followUp.quote.title||'Untitled quote'}</strong>
              <small>{item.followUp.quote.companyName||displayQuoteNumber(item.followUp.quote)}
                {item.followUp.dueDate?' · Due '+item.followUp.dueDate:''}</small>
              <span className="sales-home-item-explainer">{item.followUp.reason}</span>
            </button>
          </li>)}</ul>:<div className="sales-home-empty">
          <strong>{hydrated?'No tasks due or quote follow-ups to review.':'Loading your work…'}</strong>
          <p>{hydrated?'Add a task or create a quote to get started.':'Checking your private quote workspace.'}</p>
        </div>}
        <button type="button" className="sales-home-text-action" onClick={()=>setView('quotes')}>Go to Quotes →</button>
      </section>

      <section className="sales-home-panel sales-home-recent" aria-label="My recent work">
        <div className="sales-home-section-head"><div><h2>Pick up where you left off</h2>
          <p>Your most recently edited quotes</p></div></div>
        {recent.length?<ul>{recent.map(quote=><li key={quote.id}>
          <button type="button" className="sales-home-workitem sales-home-recent-item" onClick={()=>openQuote(quote.id)}>
            <strong>{quote.title||'Untitled quote'}</strong>
            <small>{quote.companyName||'Not linked to an account'} · {displayQuoteNumber(quote)}</small>
            <span>Edited {shortDate(quote.updatedAt)}</span>
          </button>
        </li>)}</ul>:<div className="sales-home-empty"><p>No recent quotes yet. Start with a new quote or open the library.</p></div>}
      </section>
    </div>

    <section className="sales-home-month" aria-label="My monthly signed work">
      <div><h2>My month</h2><small>Personal results · {new Date().toLocaleDateString(undefined,{month:'long',year:'numeric'})}</small></div>
      <div className="sales-home-metrics">
        <div><strong>{month.sent}</strong><span>Quotes sent</span></div>
        <div><strong>{month.signed}</strong><span>Signatures received</span></div>
        <div><strong>{money.format(month.signedValue)}</strong><span>Signed value</span></div>
      </div>
    </section>

    {creating&&<div className="sales-home-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setCreating(false);}}>
      <form className="sales-home-create-dialog" role="dialog" aria-modal="true" aria-labelledby="home-new-title" onSubmit={create}>
        <h2 id="home-new-title">Name your new quote</h2>
        <p>Create a blank quote now. Templates remain available in Quotes.</p>
        <label htmlFor="sales-home-quote-name">Quote name</label>
        <input id="sales-home-quote-name" autoFocus maxLength={180} required value={newName}
          onChange={event=>setNewName(event.target.value)} placeholder="e.g. Parkside Apartments · Phase 2"/>
        <div><button type="button" onClick={()=>setCreating(false)}>Cancel</button>
          <button type="submit" disabled={!newName.trim()}>Create Quote</button></div>
      </form>
    </div>}
  </main>;
}
