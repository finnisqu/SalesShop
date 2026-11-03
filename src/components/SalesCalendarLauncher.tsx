import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNavigationStore} from '../store/navigationStore';
import {buildSalesCalendarEvents,personalCalendarSources,calendarDayCounts,calendarMonthDays,calendarCompactMonthDays,calendarWeekDays,localDateKey,
 type SalesCalendarEvent,type SalesCalendarKind} from '../services/salesCalendar';
import './sales-calendar.css';

const week=['S','M','T','W','T','F','S'];
const labels:Record<SalesCalendarKind,string>={
 task:'To-do',bid:'Bid due',activity:'Activity', 'follow-up':'Follow-up',
};
const dateLabel=(key:string)=>new Date(key+'T12:00:00').toLocaleDateString(undefined,{
 weekday:'long',month:'long',day:'numeric'});
const plainName=(date:Date)=>date.toLocaleDateString(undefined,{month:'long',year:'numeric'});
export function SalesCalendarLauncher({compact=false,label='Calendar',embedded=false}:{compact?:boolean;label?:string;embedded?:boolean}){
 const button=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 const [position,setPosition]=useState<CSSProperties>({});
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1,12));
 const [selected,setSelected]=useState(()=>localDateKey(new Date()));
 const [isPhone,setIsPhone]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches);
 const [monthExpanded,setMonthExpanded]=useState(false);
 const [showAllDay,setShowAllDay]=useState(false);
 useEffect(()=>{
  if(!embedded)return;
  const media=window.matchMedia('(max-width:760px)');
  const update=()=>setIsPhone(media.matches);
  update();media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[embedded]);
 const today=localDateKey(new Date());
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 const storedScope=usePersonalTaskStore(s=>s.scope),tasks=usePersonalTaskStore(s=>s.tasks);
 const deals=useCrmStore(s=>s.projects),activities=useCrmStore(s=>s.activities);
 const quotes=useQuoteStore(s=>s.quotes);
 const nav=useNavigationStore();
 const personal=taskScope(mode,org,userId);
 const ownTasks=!preview&&!!personal&&storedScope===personal?tasks.filter(t=>!t.deletedAt):[];
 const ownQuotes=useMemo(()=>quotes.filter(q=>!q.archivedAt&&(mode!=='cloud'||q.ownerUserId===userId)),
  [quotes,mode,userId]);
 const sources=useMemo(()=>personalCalendarSources(mode,userId,ownQuotes,ownTasks,deals,activities),
  [mode,userId,ownQuotes,ownTasks,deals,activities]);
 const events=useMemo(()=>buildSalesCalendarEvents(ownTasks,sources.deals,sources.activities,ownQuotes),
  [ownTasks,sources,ownQuotes]);
 const days=useMemo(()=>calendarMonthDays(month.getFullYear(),month.getMonth()),[month]);
 const compactDays=useMemo(()=>calendarCompactMonthDays(month.getFullYear(),month.getMonth()),[month]);
 const weekDays=useMemo(()=>calendarWeekDays(selected),[selected]);
 const weekMode=embedded&&isPhone&&!monthExpanded;
 const visibleDays=weekMode?weekDays:embedded?compactDays:days;
 const eventsForDay=useMemo(()=>events.filter(item=>item.date===selected),[events,selected]);
 const shownDayEvents=embedded&&isPhone&&!showAllDay?eventsForDay.slice(0,5):eventsForDay;
 useEffect(()=>{setShowAllDay(false);},[selected]);
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
 const changePeriod=(delta:number)=>{
  if(!weekMode){changeMonth(delta);return;}
  const date=new Date(selected+'T12:00:00');
  date.setDate(date.getDate()+7*delta);
  setSelected(localDateKey(date));
  setMonth(new Date(date.getFullYear(),date.getMonth(),1,12));
 };
 const openRecord=(event:SalesCalendarEvent)=>{
  setOpen(false);
  const {recordType,recordId}=event;
  if(recordType==='task'){
   try{window.sessionStorage.setItem('salesshop-open-task-id-v1',recordId);}catch{/* best effort */}
   nav.setView('tasks');
   window.dispatchEvent(new Event('salesshop:open-calendar-task'));
  }
  else if(recordType==='activity'){
   try{window.sessionStorage.setItem('salesshop-open-activity-history-v1','1');}catch{/* best effort */}
   nav.setView('dashboard');
   window.dispatchEvent(new Event('salesshop:open-activity-history'));
  }
  else if(recordType==='project')nav.openProject(recordId);
  else if(recordType==='quote')nav.openQuote(recordId);
  else if(recordType==='company')nav.openCompany(recordId);
  else if(recordType==='contact')nav.openPerson(recordId);
 };
 if(preview)return null;
 const calendarPanel=(
   <section className={"sales-calendar-popover"+(embedded?" is-inline":"")+(weekMode?" is-week":"")} style={embedded?undefined:position}
    role={embedded?undefined:'dialog'} aria-modal={embedded?undefined:false} aria-label="SalesShop calendar"
    onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);}}}>
    <header className="sales-calendar-heading">
     <div>{!embedded&&<small>WORK CALENDAR</small>}<strong>{plainName(month)}</strong></div>
     <div>
      <button type="button" aria-label={weekMode?'Previous week':'Previous month'} onClick={()=>changePeriod(-1)}>‹</button>
      <button type="button" aria-label="Jump to today" onClick={()=>{
       const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1,12));
       setSelected(localDateKey(now));
      }}>Today</button>
      <button type="button" aria-label={weekMode?'Next week':'Next month'} onClick={()=>changePeriod(1)}>›</button>
      {embedded&&isPhone&&<button type="button" className="sales-calendar-expand" aria-expanded={monthExpanded}
       aria-label={monthExpanded?'Collapse to week':'Expand to full month'}
       onClick={()=>setMonthExpanded(value=>!value)}>{monthExpanded?'Week':'Month'}</button>}
      {!embedded&&<button type="button" aria-label="Close calendar" onClick={()=>setOpen(false)}>×</button>}
     </div>
    </header>
    <div className="sales-calendar-weekdays">
     {week.map((name,i)=><span key={i} aria-label={['Sunday','Monday','Tuesday','Wednesday',
      'Thursday','Friday','Saturday'][i]}>{name}</span>)}
    </div>
    <div className="sales-calendar-grid">
     {visibleDays.map(key=>{
      const counts=calendarDayCounts(events,key),inMonth=key.slice(0,7)===localDateKey(month).slice(0,7);
      const kindCounts:Record<SalesCalendarKind,number>={
       task:counts.task,bid:counts.bid,activity:counts.activity,'follow-up':counts.followUp,
      };
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
         {(['task','bid','activity','follow-up'] as const).filter(kind=>kindCounts[kind]>0)
          .map(kind=><i key={kind} className={'is-'+kind} title={kindCounts[kind]+' '+labels[kind]}>
           {kindCounts[kind]}</i>)}
        </span>
       </button>;
     })}
    </div>
    <section className="sales-calendar-day-preview" aria-label={'Items for '+dateLabel(selected)}>
     <div className="sales-calendar-preview-heading"><strong>{dateLabel(selected)}</strong>
      <div><span>{eventsForDay.length} {eventsForDay.length===1?'item':'items'}</span>
       {embedded&&<button type="button" className="sales-calendar-all-tasks"
        onClick={()=>nav.setView('tasks')}>Tasks ›</button>}
      </div></div>
     {eventsForDay.length?<div className="sales-calendar-agenda">
       {shownDayEvents.map(event=><button type="button" key={event.id}
        onClick={()=>openRecord(event)}>
         <span className={'sales-calendar-event-dot is-'+event.kind} aria-hidden="true"/>
         <span className="sales-calendar-event-text"><strong>{event.title}</strong>
          <small>{labels[event.kind]} · {event.detail}</small></span>
         <span aria-hidden="true">›</span>
        </button>)}
       {embedded&&isPhone&&eventsForDay.length>5&&
        <button type="button" className="sales-calendar-show-more"
         onClick={()=>setShowAllDay(value=>!value)}>
         {showAllDay?'Show fewer':'Show '+(eventsForDay.length-5)+' more'}
        </button>}
      </div>:<p className="sales-calendar-empty">Nothing scheduled or logged for this day.</p>}
    </section>
    <div className="sales-calendar-legend" aria-label="Calendar event types">
     {(['task','bid','activity','follow-up'] as const).map(kind=><span key={kind}>
      <i className={'is-'+kind}/>{labels[kind]}</span>)}
    </div>
   </section>
 );
 return <>
  {!embedded&&<button ref={button} type="button" className={'sales-calendar-trigger'+(compact?' is-compact':'')}
   title={label} aria-haspopup="dialog" aria-expanded={open} aria-label={'Open '+label.toLowerCase()}
   onClick={()=>setOpen(value=>!value)}>
   <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>
    <path d="M8 14h2M14 14h2M8 18h2"/>
   </svg>
  </button>}
  {embedded?<div className="sales-calendar-inline">{calendarPanel}</div>
   :open&&createPortal(<div className="sales-calendar-backdrop"
     onPointerDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
     {calendarPanel}</div>,document.body)}
 </>;
}
