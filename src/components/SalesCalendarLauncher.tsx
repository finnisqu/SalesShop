import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNavigationStore} from '../store/navigationStore';
import {buildSalesCalendarEvents,calendarDayCounts,calendarMonthDays,localDateKey,
 type SalesCalendarEvent,type SalesCalendarKind} from '../services/salesCalendar';
import './sales-calendar.css';
import {requestActivityDetail} from './ActivityDetailHost';

const week=['S','M','T','W','T','F','S'];
const allKinds:SalesCalendarKind[]=['task','bid','activity','follow-up'];
const labels:Record<SalesCalendarKind,string>={
 task:'To-do',bid:'Bid due',activity:'Activity', 'follow-up':'Follow-up',
};
const dateLabel=(key:string)=>new Date(key+'T12:00:00').toLocaleDateString(undefined,{
 weekday:'long',month:'long',day:'numeric'});
const plainName=(date:Date)=>date.toLocaleDateString(undefined,{month:'long',year:'numeric'});
export function SalesCalendarLauncher({compact=false,label='Calendar'}:{compact?:boolean;label?:string}){
 const button=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 const [viewMode,setViewMode]=useState<'month'|'agenda'>('month');
 const [visibleKinds,setVisibleKinds]=useState<SalesCalendarKind[]>(allKinds);
 const [position,setPosition]=useState<CSSProperties>({});
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1,12));
 const [selected,setSelected]=useState(()=>localDateKey(new Date()));
 const today=localDateKey(new Date());
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 const storedScope=usePersonalTaskStore(s=>s.scope),tasks=usePersonalTaskStore(s=>s.tasks);
 const deals=useCrmStore(s=>s.projects),activities=useCrmStore(s=>s.activities);
 const quotes=useQuoteStore(s=>s.quotes);
 const nav=useNavigationStore();
 const personal=taskScope(mode,org,userId);
 const ownTasks=!preview&&storedScope===personal?tasks.filter(t=>!t.deletedAt):[];
 const ownQuotes=useMemo(()=>quotes.filter(q=>!q.archivedAt&&(mode!=='cloud'||q.ownerUserId===userId)),
  [quotes,mode,userId]);
 const events=useMemo(()=>buildSalesCalendarEvents(ownTasks,deals,activities,ownQuotes),
  [ownTasks,deals,activities,ownQuotes]);
 const days=useMemo(()=>calendarMonthDays(month.getFullYear(),month.getMonth()),[month]);
 const shown=events.filter(item=>visibleKinds.includes(item.kind));
 const eventsForDay=shown.filter(item=>item.date===selected);
 const monthKey=localDateKey(month).slice(0,7);
 const agenda=shown.filter(item=>item.date.startsWith(monthKey));
 const toggleKind=(kind:SalesCalendarKind)=>setVisibleKinds(old=>
  old.includes(kind)?old.filter(x=>x!==kind):[...old,kind]);
 const placement=()=>{
  if(!button.current)return;
  const rect=button.current.getBoundingClientRect();
  const visual=window.visualViewport,screenWidth=visual?.width??window.innerWidth;
  const screenHeight=visual?.height??window.innerHeight;
  const width=Math.min(440,screenWidth-16);
  const left=Math.max(8,Math.min(rect.left,screenWidth-width-8));
  const roomBelow=screenHeight-rect.bottom;
  setPosition({left,top:roomBelow>510?Math.max(8,rect.bottom+8):
    Math.max(8,Math.min(rect.top-520,screenHeight-525))});
 };
 useEffect(()=>{
  if(!open)return;
  const update=()=>placement();
  update();
  window.addEventListener('resize',update);
  window.visualViewport?.addEventListener('resize',update);
  return()=>{
   window.removeEventListener('resize',update);
   window.visualViewport?.removeEventListener('resize',update);
  };
 },[open]);
 const changeMonth=(delta:number)=>{
  const next=new Date(month.getFullYear(),month.getMonth()+delta,1,12);
  setMonth(next);setSelected(localDateKey(next));
 };
 const openRecord=(event:SalesCalendarEvent)=>{
  setOpen(false);
  const {recordType,recordId}=event;
  if(recordType==='task'){
   try{window.sessionStorage.setItem('salesshop-open-task-id-v1',recordId);}catch{/* best effort */}
   nav.setView('tasks');
   window.dispatchEvent(new Event('salesshop:open-calendar-task'));
  }
  else if(recordType==='activity')requestActivityDetail(recordId);
  else if(recordType==='project')nav.openProject(recordId);
  else if(recordType==='quote')nav.openQuote(recordId);
  else if(recordType==='company')nav.openCompany(recordId);
  else if(recordType==='contact')nav.openPerson(recordId);
 };
 if(preview)return null;
 return <>
  <button ref={button} type="button" className={'sales-calendar-trigger'+(compact?' is-compact':'')}
   aria-haspopup="dialog" aria-expanded={open} aria-label={'Open '+label.toLowerCase()}
   onClick={()=>{setOpen(value=>!value);}}>
   <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>
    <path d="M8 14h2M14 14h2M8 18h2"/>
   </svg><span>{label}</span>
  </button>
  {open&&createPortal(<div className="sales-calendar-backdrop"
    onPointerDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
   <section className="sales-calendar-popover" style={position}
    role="dialog" aria-modal="false" aria-label="SalesShop calendar"
    onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);}}}>
    <header className="sales-calendar-heading">
     <div><small>WORK CALENDAR</small><strong>{plainName(month)}</strong></div>
     <div>
      <button type="button" aria-label="Previous month" onClick={()=>changeMonth(-1)}>‹</button>
      <button type="button" aria-label="Jump to today" onClick={()=>{
       const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1,12));
       setSelected(localDateKey(now));
      }}>Today</button>
      <button type="button" aria-label="Next month" onClick={()=>changeMonth(1)}>›</button>
      <button type="button" aria-label="Close calendar" onClick={()=>setOpen(false)}>×</button>
     </div>
    </header>
    <div className="sales-calendar-tools">
     <div role="tablist" aria-label="Calendar layout" className="sales-calendar-view-switch">
      <button type="button" role="tab" aria-selected={viewMode==='month'}
       onClick={()=>setViewMode('month')}>Month</button>
      <button type="button" role="tab" aria-selected={viewMode==='agenda'}
       onClick={()=>setViewMode('agenda')}>Agenda</button>
     </div>
     <div role="group" aria-label="Calendar event filters" className="sales-calendar-filters">
      {allKinds.map(kind=><button type="button" key={kind}
       aria-pressed={visibleKinds.includes(kind)} title={'Toggle '+labels[kind]}
       onClick={()=>toggleKind(kind)}>
       <i className={'is-'+kind} aria-hidden="true"/>{labels[kind]}</button>)}
     </div>
    </div>
    {viewMode==='month'?<>
    <div className="sales-calendar-weekdays">
     {week.map((name,i)=><span key={i} aria-label={['Sunday','Monday','Tuesday','Wednesday',
      'Thursday','Friday','Saturday'][i]}>{name}</span>)}
    </div>
    <div className="sales-calendar-grid">
     {days.map(key=>{
      const counts=calendarDayCounts(shown,key),inMonth=key.slice(0,7)===monthKey;
      return <button type="button" key={key}
        className={'sales-calendar-day'+(!inMonth?' is-outside':'')+
         (key===today?' is-today':'')+(key===selected?' is-selected':'')}
        aria-pressed={key===selected}
        aria-label={dateLabel(key)+(counts.total?', '+[
         counts.task&&counts.task+' tasks',counts.bid&&counts.bid+' bids',
         counts.activity&&counts.activity+' activities',counts.followUp&&counts.followUp+' follow-ups'
        ].filter(Boolean).join(', '):'')}
        onClick={()=>{setSelected(key);if(!inMonth){
         const date=new Date(key+'T12:00:00');setMonth(new Date(date.getFullYear(),date.getMonth(),1,12));
        }}}>
        <span>{Number(key.slice(-2))}</span>
        <span className="sales-calendar-dots" aria-hidden="true">
         {(['task','bid','activity','follow-up'] as const).filter(kind=>counts[kind]>0)
          .map(kind=><i key={kind} className={'is-'+kind} title={counts[kind]+' '+labels[kind]}>
           {counts[kind]}</i>)}
        </span>
       </button>;
     })}
    </div>
    <section className="sales-calendar-day-preview" aria-label={'Items for '+dateLabel(selected)}>
     <div className="sales-calendar-preview-heading"><strong>{dateLabel(selected)}</strong>
      <span>{eventsForDay.length} {eventsForDay.length===1?'item':'items'}</span></div>
     {eventsForDay.length?<div className="sales-calendar-agenda">
       {eventsForDay.map(event=><button type="button" key={event.id}
        onClick={()=>openRecord(event)}>
         <span className={'sales-calendar-event-dot is-'+event.kind} aria-hidden="true"/>
         <span className="sales-calendar-event-text"><strong>{event.title}</strong>
          <small>{labels[event.kind]} · {event.detail}</small></span>
         <span aria-hidden="true">›</span>
        </button>)}
      </div>:<p className="sales-calendar-empty">Nothing scheduled or logged for this day.</p>}
    </section>
    </>:<section className="sales-calendar-agenda-view" aria-label={'Agenda for '+plainName(month)}>
     {agenda.length?agenda.map(event=><button type="button" key={event.id} className="sales-calendar-agenda-item"
       onClick={()=>openRecord(event)}>
       <span className="sales-calendar-agenda-date">
        <strong>{Number(event.date.slice(-2))}</strong><small>{new Date(event.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})}</small>
       </span>
       <i className={'sales-calendar-event-dot is-'+event.kind} aria-hidden="true"/>
       <span className="sales-calendar-event-text"><strong>{event.title}</strong>
        <small>{event.time?event.time+' · ':''}{labels[event.kind]} · {event.detail}</small></span>
       <span aria-hidden="true">›</span>
      </button>):<p className="sales-calendar-empty">No events in this month for the selected filters.</p>}
    </section>}
    <div className="sales-calendar-legend">
     {(['task','bid','activity','follow-up'] as const).map(kind=><span key={kind}>
      <i className={'is-'+kind}/>{labels[kind]}</span>)}
    </div>
   </section>
  </div>,document.body)}
 </>;
}
