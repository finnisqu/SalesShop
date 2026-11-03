import {useEffect,useMemo} from 'react';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useNavigationStore} from '../store/navigationStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNotebookStore} from '../store/notebookStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {personalHomeQuotes} from '../services/homeOverview';
import {displayQuoteNumber} from '../types/quote';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {QuickCreate} from './QuickCreate';
import {QuickActivityLauncher} from './QuickActivityLauncher';
import {SalesCalendarLauncher} from './SalesCalendarLauncher';
import '../home-workspace.css';

const dateLabel=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric'});
const shortDate=(value:string)=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
type RecentKind='quote'|'task'|'notebook';
type RecentItem={id:string;kind:RecentKind;title:string;detail:string;updatedAt:string};

export function HomeWorkspace(){
 const quotes=useQuoteStore(s=>s.quotes),hydrate=useQuoteStore(s=>s.hydrate);
 const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id),
  organizationId=useAuthStore(s=>s.organizationId);
 const role=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
 const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
 const openQuote=useNavigationStore(s=>s.openQuote);
 const setView=useNavigationStore(s=>s.setView);
 const openNotebookPage=useNavigationStore(s=>s.openNotebookPage);
 const storedTasks=usePersonalTaskStore(s=>s.tasks),storedScope=usePersonalTaskStore(s=>s.scope);
 const loadTasks=usePersonalTaskStore(s=>s.load);
 const notebookEntries=useNotebookStore(s=>s.entries);
 const notebookHydrated=useNotebookStore(s=>s.hydrated);
 const myScope=taskScope(mode,organizationId,userId);
 useEffect(()=>hydrate(),[hydrate]);
 useEffect(()=>loadTasks(myScope),[loadTasks,myScope]);

 // Home remains a private workspace, not an organization-wide activity feed.
 const mine=useMemo(()=>rolePreview?[]:personalHomeQuotes(quotes,userId,mode==='cloud'),
  [quotes,userId,mode,rolePreview]);
 const myTasks=useMemo(()=>!rolePreview&&!!myScope&&storedScope===myScope
  ?storedTasks.filter(task=>!task.deletedAt):[],
  [rolePreview,myScope,storedScope,storedTasks]);
 const recents=useMemo(()=>{
  if(rolePreview)return [] as RecentItem[];
  const quoteItems=mine.map((quote):RecentItem=>({
   id:quote.id,kind:'quote',title:quote.title||'Untitled quote',
   detail:'Quote · '+displayQuoteNumber(quote),updatedAt:quote.updatedAt,
  }));
  const taskItems=myTasks.map((task):RecentItem=>({
   id:task.id,kind:'task',title:task.title,
   detail:'Task · '+(task.status==='completed'?'Completed':'In progress'),
   updatedAt:task.updatedAt,
  }));
  const pageItems=notebookHydrated?notebookEntries.filter(page=>!page.hidden).map((page):RecentItem=>({
   id:page.id,kind:'notebook',title:page.title||'Untitled page',
   detail:'Notebook page',updatedAt:page.updatedAt,
  })):[];
  return [...quoteItems,...taskItems,...pageItems]
   .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,5);
 },[mine,myTasks,notebookEntries,notebookHydrated,rolePreview]);
 const canCreate=!rolePreview&&(mode==='local'||!!(userId&&canEditTeamArea(role,department,'quotes')));
 const previewTask=(id:string)=>{
  try{window.sessionStorage.setItem('salesshop-open-task-id-v1',id);}catch{/* optional */}
  setView('tasks');
  window.dispatchEvent(new Event('salesshop:open-calendar-task'));
 };
 const openRecent=(item:RecentItem)=>{
  if(item.kind==='quote')openQuote(item.id);
  else if(item.kind==='task')previewTask(item.id);
  else openNotebookPage(item.id);
 };

 return <main className="sales-home is-calendar-home is-compact-home" aria-label="My SalesShop home">
  <header className="sales-home-heading">
   <div className="sales-home-heading-copy">
    <span className="sales-home-eyebrow">MY WORKSPACE</span>
    <h1>Today</h1>
    <p>{dateLabel.format(new Date())}</p>
   </div>
   <div className="sales-home-top-actions" aria-label="Start work">
    <QuickActivityLauncher />
    {canCreate&&<QuickCreate />}
   </div>
  </header>

  <section className="sales-home-calendar-card" aria-label="Calendar and selected-day agenda">
   <SalesCalendarLauncher embedded />
  </section>

  <section className="sales-home-recent-compact" aria-label="Pick up where you left off">
   <header className="sales-home-recent-heading">
    <h2>Pick up where you left off</h2>
    <button type="button" onClick={()=>setView('quotes')}>All quotes ›</button>
   </header>
   {recents.length?<div className="sales-home-recent-strip">
    {recents.map(item=><button type="button" key={item.kind+':'+item.id}
     className="sales-home-recent-tile" onClick={()=>openRecent(item)}
     aria-label={'Open '+item.kind+' '+item.title}>
      <span className="sales-home-recent-kind">{item.kind==='notebook'?'Notebook':item.kind==='task'?'Task':'Quote'}</span>
      <strong>{item.title}</strong>
      <small>{item.detail} · {shortDate(item.updatedAt)}</small>
    </button>)}
   </div>:<p className="sales-home-recent-empty">Your recent quotes, personal tasks and Notebook pages will appear here.</p>}
  </section>
 </main>;
}
