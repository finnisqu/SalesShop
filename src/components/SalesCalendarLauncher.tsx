import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNavigationStore} from '../store/navigationStore';
import {scopedStorageKey} from '../lib/developerPlayground';
import {requestTaskModal} from './TaskModalHost';
import {RecordPreviewDrawer,type PreviewRecord} from './RecordPreviewDrawer';
import {homeRecentQuotes} from '../services/homeOverview';
import {CalendarActivityPreview} from './CalendarActivityPreview';
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
type CalendarDisplay='week'|'month';
const readDisplay=(key:string,phone:boolean):CalendarDisplay=>{
 try{const stored=localStorage.getItem(key);if(stored==='week'||stored==='month')return stored;}catch{/* best effort */}
 return phone?'week':'month';
};
export function SalesCalendarLauncher({compact=false,label='Calendar',embedded=false}:{compact?:boolean;label?:string;embedded?:boolean}){
 const button=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 const [position,setPosition]=useState<CSSProperties>({});
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1,12));
 const [selected,setSelected]=useState(()=>localDateKey(new Date()));
 const [isPhone,setIsPhone]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches);
 const [showAllDay,setShowAllDay]=useState(false);
 const [addOpen,setAddOpen]=useState(false);
 const [recordPreview,setRecordPreview]=useState<PreviewRecord|null>(null);
 const [activityPreview,setActivityPreview]=useState<string|null>(null);
 const [sidecarTab,setSidecarTab]=useState<'quotes'|'activity'>('quotes');
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
 const prefKey=scopedStorageKey('salesshop-calendar-display-v1:')+(personal??'pending');
 const [savedDisplay,setSavedDisplay]=useState<{key:string;display:CalendarDisplay}>(
  ()=>({key:prefKey,display:readDisplay(prefKey,isPhone)}));
 const display=savedDisplay.key===prefKey?savedDisplay.display:readDisplay(prefKey,isPhone);
 const chooseDisplay=(next:CalendarDisplay)=>{
  setSavedDisplay({key:prefKey,display:next});
  try{localStorage.setItem(prefKey,next);}catch{/* optional preference */}
 };
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
 const weekMode=embedded&&display==='week';
 const visibleDays=weekMode?weekDays:embedded?compactDays:days;
 const eventsForDay=useMemo(()=>events.filter(item=>item.date===selected).sort((a,b)=>
  Number(Boolean(b.urgent))-Number(Boolean(a.urgent))||a.kind.localeCompare(b.kind)||a.title.localeCompare(b.title)),[events,selected]);
 const shownDayEvents=embedded&&isPhone&&!showAllDay?eventsForDay.slice(0,5):eventsForDay;
 const recentQuotes=useMemo(()=>homeRecentQuotes(ownQuotes,5),[ownQuotes]);
 const recentActivityEvents=useMemo(()=>events.filter(event=>event.kind==='activity')
  .sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,5),[events]);
 useEffect(()=>{setShowAllDay(false);setAddOpen(false);},[selected]);
 useEffect(()=>{
  if(!addOpen)return;
  const dismiss=(event:PointerEvent)=>{
   if(!(event.target as HTMLElement).closest('.sales-calendar-add-wrap'))setAddOpen(false);
  };
  document.addEventListener('pointerdown',dismiss);
  return()=>document.removeEventListener('pointerdown',dismiss);
 },[addOpen]);
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
  if(recordType==='task'){requestTaskModal({mode:'preview',id:recordId});return;}
  if(event.kind==='activity'){
   setActivityPreview(event.id.startsWith('activity:')?event.id.slice(9):recordId);
   return;
  }
  const kind=recordType==='project'?'deal':
   recordType==='contact'?'person':recordType==='company'?'company':
   recordType==='quote'?'quote':null;
  if(kind)setRecordPreview({kind,id:recordId});
 };
 const openLinkedRecord=(kind:PreviewRecord['kind'],id:string)=>{
  setActivityPreview(null);
  setRecordPreview({kind,id});
 };
 if(preview)return null;
 const calendarPanel=(
   <section className={"sales-calendar-popover"+(embedded?" is-inline":"")+(weekMode?" is-week":"")} style={embedded?undefined:position}
    role={embedded?undefined:'dialog'} aria-modal={embedded?undefined:false} aria-label="SalesShop calendar"
    onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);}}}>
    <header className="sales-calendar-heading">
     <div className="sales-calendar-period">
      <button type="button" className="sales-calendar-today" title="Jump to today"
       aria-label="Jump to today" onClick={()=>{
        const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1,12));
        setSelected(localDateKey(now));
       }}>
       <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2"/>
        <path d="M7 3v4M17 3v4M3 10h18M12 14v4M10 16h4"/>
       </svg>
      </button>
      <button type="button" aria-label={weekMode?'Previous week':'Previous month'}
       onClick={()=>changePeriod(-1)}>‹</button>
      <strong>{plainName(month)}</strong>
      <button type="button" aria-label={weekMode?'Next week':'Next month'}
       onClick={()=>changePeriod(1)}>›</button>
     </div>
     <div className="sales-calendar-tools">
      {embedded&&<div className="sales-calendar-display-toggle" role="group" aria-label="Calendar display">
       <button type="button" aria-pressed={display==='week'}
        onClick={()=>chooseDisplay('week')}>7 days</button>
       <button type="button" aria-pressed={display==='month'}
        onClick={()=>chooseDisplay('month')}>Month</button>
      </div>}
      {!embedded&&<button type="button" aria-label="Close calendar" onClick={()=>setOpen(false)}>×</button>}
     </div>
    </header>
    <div className="sales-calendar-main">
     <div className="sales-calendar-month">
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
        ].filter(Boolean).join(', '):'')+(counts.urgent?', urgent task':'')}
        onClick={()=>{setSelected(key);if(!inMonth){
         const date=new Date(key+'T12:00:00');setMonth(new Date(date.getFullYear(),date.getMonth(),1,12));
        }}}>
        <span>{Number(key.slice(-2))}</span>
        {counts.urgent>0&&<span className="sales-calendar-urgent"
          aria-hidden="true" title={counts.urgent+' urgent task(s)'}>!</span>}
        <span className="sales-calendar-dots" aria-hidden="true">
         {(['task','bid','activity','follow-up'] as const).filter(kind=>kindCounts[kind]>0)
          .map(kind=><i key={kind} className={'is-'+kind} title={kindCounts[kind]+' '+labels[kind]}>
           {kindCounts[kind]}</i>)}
        </span>
       </button>;
     })}
    </div>
    {embedded&&weekMode&&!isPhone&&<div className="sales-calendar-week-glimpse">
     <strong>This week</strong>
     {visibleDays.map(key=>{
      const counts=calendarDayCounts(events,key);
      return <button key={key} type="button" className={key===selected?'is-selected':''}
       onClick={()=>setSelected(key)}>
       <span>{new Date(key+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric'})}</span>
       <small>{counts.total} {counts.total===1?'item':'items'}{counts.urgent?' · Urgent':''}</small>
       {counts.urgent>0&&<b aria-label="Urgent">!</b>}
      </button>;
     })}
    </div>}
     </div>
    <section className="sales-calendar-day-preview" aria-label={'Items for '+dateLabel(selected)}>
     <div className="sales-calendar-preview-heading"><strong>{dateLabel(selected)}</strong>
      <div><span>{eventsForDay.length} {eventsForDay.length===1?'item':'items'}</span>
       {embedded&&<div className="sales-calendar-add-wrap">
        <button type="button" className="sales-calendar-add" aria-haspopup="menu"
         aria-expanded={addOpen} aria-label={'Add to '+dateLabel(selected)}
         title={'Add to '+dateLabel(selected)} onClick={()=>setAddOpen(value=>!value)}>+</button>
        {addOpen&&<div className="sales-calendar-add-menu" role="menu">
         <button type="button" role="menuitem" onClick={()=>{
          setAddOpen(false);requestTaskModal({mode:'create',dueDate:selected});
         }}>✓ New task</button>
         <button type="button" role="menuitem" onClick={()=>{
          setAddOpen(false);requestTaskModal({mode:'create',dueDate:selected,type:'follow-up'});
         }}>↪ Follow-up task</button>
         {selected<=today&&<button type="button" role="menuitem" onClick={()=>{
          setAddOpen(false);
          window.dispatchEvent(new CustomEvent('salesshop:open-activity',
           {detail:{date:selected}}));
         }}>☎ Log completed activity</button>}
        </div>}
       </div>}
 
      </div></div>
     {eventsForDay.length?<div className="sales-calendar-agenda">
       {shownDayEvents.map(event=><button type="button" key={event.id}
        onClick={()=>openRecord(event)}>
         <span className={'sales-calendar-event-dot is-'+event.kind} aria-hidden="true"/>
         <span className="sales-calendar-event-text"><strong>{event.title}</strong>
          <small>{labels[event.kind]} · {event.detail}</small></span>
         {event.urgent&&<span className="sales-calendar-agenda-urgent" title="Urgent task" aria-label="Urgent task">!</span>}
         <span className="sales-calendar-agenda-chevron" aria-hidden="true">›</span>
        </button>)}
       {embedded&&isPhone&&eventsForDay.length>5&&
        <button type="button" className="sales-calendar-show-more"
         onClick={()=>setShowAllDay(value=>!value)}>
         {showAllDay?'Show fewer':'Show '+(eventsForDay.length-5)+' more'}
        </button>}
      </div>:<p className="sales-calendar-empty">Nothing scheduled or logged for this day.</p>}
    </section>
    </div>
    {embedded&&<aside className="sales-calendar-sidecar" aria-label="Recent quote work">
      <h3>Pick up where you left off</h3>
      <div className="sales-calendar-sidecar-tabs" role="tablist" aria-label="Recent work">
       <button type="button" role="tab" aria-selected={sidecarTab==='quotes'}
        onClick={()=>setSidecarTab('quotes')}>Quotes</button>
       <button type="button" role="tab" aria-selected={sidecarTab==='activity'}
        onClick={()=>setSidecarTab('activity')}>Activity</button>
      </div>
      <div className="sales-calendar-sidecar-list">
       {sidecarTab==='quotes'
        ?recentQuotes.length?recentQuotes.map(q=><button type="button" key={q.id}
          onClick={()=>setRecordPreview({kind:'quote',id:q.id})}>
          <strong>{q.title||'Untitled quote'}</strong>
          <small>{q.companyName||q.quoteNumber||'Quote draft'}</small>
         </button>):<p>Recently edited quotes will appear here.</p>
        :recentActivityEvents.length?recentActivityEvents.map(event=><button type="button"
          key={event.id} onClick={()=>openRecord(event)}>
          <strong>{event.title}</strong>
          <small>{event.date} · {event.detail}</small>
         </button>):<p>Recent logged interactions will appear here.</p>}
      </div>
    </aside>}
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
  {recordPreview&&<RecordPreviewDrawer record={recordPreview}
   onSelect={setRecordPreview} onClose={()=>setRecordPreview(null)}/>}
  {activityPreview&&<CalendarActivityPreview activityId={activityPreview}
   onClose={()=>setActivityPreview(null)} onSelect={openLinkedRecord}/>}
 </>;
}
