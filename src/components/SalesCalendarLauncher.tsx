import {useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useQuoteStore} from '../store/quoteStore';
import {useNotebookStore} from '../store/notebookStore';
import {openHomeNote} from '../services/homeNotes';
import {dailyNotebookPages,notebookPlainText,notebookCalendarDates,openNotebookCalendarDate} from '../services/notebookDaily';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useNavigationStore} from '../store/navigationStore';
import {scopedStorageKey} from '../lib/developerPlayground';
import {canEditTeamArea} from '../services/teamDepartments';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {openGuidedQuoteCreation} from '../services/quoteCreationNavigation';
import {requestTaskModal} from './TaskModalHost';
import {RecordPreviewDrawer,type PreviewRecord} from './RecordPreviewDrawer';
import {homeRecentQuotes} from '../services/homeOverview';
import {CalendarActivityPreview} from './CalendarActivityPreview';
import {buildSalesCalendarEvents,personalCalendarSources,recentHomeItems,calendarDayCounts,calendarMonthDays,calendarCompactMonthDays,calendarWeekDays,localDateKey,
 type SalesCalendarEvent} from '../services/salesCalendar';
import {homeCalendarScope,useHomeCalendarSettings,badgeColor,badgeLabel} from '../store/homeCalendarSettings';
import {buildCalendarBadgeIndex,metricCount} from '../services/homeCalendarBadges';
import {homeAgendaDotColors} from '../services/homeCalendarAgendaColors';
import './sales-calendar.css';

type SidecarCreateKind='quote'|'activity'|'note';
function SidecarCreateIcon({kind}:{kind:SidecarCreateKind}){
 return <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
  strokeLinejoin="round" aria-hidden="true">
  {kind==='quote'?<><rect x="5" y="3" width="14" height="18" rx="2"/>
   <path d="M9 8h6M9 12h6M9 16h4"/></>:
   kind==='activity'?<><path d="M5 3h3l2 5-2 2a16 16 0 0 0 6 6l2-2 5 2v3a2 2 0 0 1-2 2C11 20 4 13 3 5a2 2 0 0 1 2-2Z"/></>:
   <><rect x="5" y="3" width="14" height="18" rx="2"/>
    <path d="M9 8h6M9 12h6M9 16h4M3 7v11"/></>}
 </svg>;
}

const week=['S','M','T','W','T','F','S'];
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
 const [sidecarTab,setSidecarTab]=useState<'quotes'|'recent'|'notes'>('quotes');
 const [sidecarCreateOpen,setSidecarCreateOpen]=useState(false);
 const [sidecarMenuPosition,setSidecarMenuPosition]=useState<CSSProperties>({top:-9999,left:-9999});
 const sidecarMenuRef=useRef<HTMLDivElement>(null);
 const sidecarCreateRef=useRef<HTMLDivElement>(null);
 const sidecarCreateButton=useRef<HTMLButtonElement>(null);
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
 const teamRole=useAuthStore(s=>s.teamRole);
 const department=useAuthStore(s=>s.teamDepartment);
 const mayCreateQuote=mode==='local'||!!(userId&&canEditTeamArea(teamRole,department,'quotes'));
 const mayLogActivity=mode==='local'||!!(userId&&canEditTeamArea(teamRole,department,'crm'));
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 const storedScope=usePersonalTaskStore(s=>s.scope),tasks=usePersonalTaskStore(s=>s.tasks);
 const deals=useCrmStore(s=>s.projects),activities=useCrmStore(s=>s.activities);
 const contacts=useCrmStore(s=>s.contacts),companies=useCrmStore(s=>s.companies);
 const quotes=useQuoteStore(s=>s.quotes);
 const notebookEntries=useNotebookStore(s=>s.entries);
 const notebookReady=useNotebookStore(s=>s.hydrated);
 const nav=useNavigationStore();
 const personal=taskScope(mode,org,userId);
 const badgeSettings=useHomeCalendarSettings(homeCalendarScope(mode,org,userId));
 const agendaDotColors=useMemo(()=>homeAgendaDotColors(badgeSettings),[badgeSettings]);
 const createFromSidecar=(kind:SidecarCreateKind)=>{
  setSidecarCreateOpen(false);
  if(kind==='quote'&&mayCreateQuote)openGuidedQuoteCreation();
  if(kind==='activity'&&mayLogActivity){
   setSidecarTab('recent');openActivityComposer();
  }
  if(kind==='note'){
   setSidecarTab('notes');openHomeNote();
  }
 };
 useEffect(()=>{
  if(!sidecarCreateOpen)return;
  sidecarMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
  const outside=(event:PointerEvent)=>{
   if(!sidecarCreateRef.current?.contains(event.target as Node)&&
      !sidecarMenuRef.current?.contains(event.target as Node))
    setSidecarCreateOpen(false);
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key!=='Escape')return;
   event.preventDefault();event.stopPropagation();
   setSidecarCreateOpen(false);
   sidecarCreateButton.current?.focus();
  };
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  return()=>{
   document.removeEventListener('pointerdown',outside);
   document.removeEventListener('keydown',escape);
  };
 },[sidecarCreateOpen]);
 // The menu lives in document.body so the compact calendar's overflow clipping
 // cannot cut it off when a tab has no history rows beneath the launcher.
 useLayoutEffect(()=>{
  if(!sidecarCreateOpen)return;
  const placeMenu=()=>{
   const trigger=sidecarCreateButton.current,menu=sidecarMenuRef.current;
   if(!trigger||!menu)return;
   const rect=trigger.getBoundingClientRect(),viewport=window.visualViewport;
   const viewLeft=viewport?.offsetLeft??0,viewTop=viewport?.offsetTop??0;
   const viewRight=viewLeft+(viewport?.width??window.innerWidth);
   const viewBottom=viewTop+(viewport?.height??window.innerHeight);
   const width=menu.offsetWidth,height=menu.offsetHeight,gap=6,margin=8;
   const below=viewBottom-rect.bottom-gap-margin;
   const above=rect.top-viewTop-gap-margin;
   const desiredTop=below<height&&above>below?rect.top-gap-height:rect.bottom+gap;
   const top=Math.max(viewTop+margin,Math.min(desiredTop,viewBottom-height-margin));
   const left=Math.max(viewLeft+margin,Math.min(rect.right-width,viewRight-width-margin));
   setSidecarMenuPosition({top:Math.round(top),left:Math.round(left)});
  };
  placeMenu();
  window.addEventListener('resize',placeMenu);
  document.addEventListener('scroll',placeMenu,true);
  window.visualViewport?.addEventListener('resize',placeMenu);
  window.visualViewport?.addEventListener('scroll',placeMenu);
  return()=>{
   window.removeEventListener('resize',placeMenu);
   document.removeEventListener('scroll',placeMenu,true);
   window.visualViewport?.removeEventListener('resize',placeMenu);
   window.visualViewport?.removeEventListener('scroll',placeMenu);
  };
 },[sidecarCreateOpen]);
 const prefKey=scopedStorageKey('salesshop-calendar-display-v1:')+(personal??'pending');
 const [savedDisplay,setSavedDisplay]=useState<{key:string;display:CalendarDisplay}>(
  ()=>({key:prefKey,display:readDisplay(prefKey,isPhone)}));
 const display=savedDisplay.key===prefKey?savedDisplay.display:readDisplay(prefKey,isPhone);
 const chooseDisplay=(next:CalendarDisplay)=>{
  setSavedDisplay({key:prefKey,display:next});
  try{localStorage.setItem(prefKey,next);}catch{/* optional preference */}
 };
 const ownTasks=useMemo(()=>!preview&&!!personal&&storedScope===personal
  ?tasks.filter(t=>!t.deletedAt):[],[preview,personal,storedScope,tasks]);
 const ownQuotes=useMemo(()=>quotes.filter(q=>!q.archivedAt&&(mode!=='cloud'||q.ownerUserId===userId)),
  [quotes,mode,userId]);
 const sources=useMemo(()=>personalCalendarSources(mode,userId,ownQuotes,ownTasks,deals,activities),
  [mode,userId,ownQuotes,ownTasks,deals,activities]);
 const events=useMemo(()=>buildSalesCalendarEvents(ownTasks,sources.deals,sources.activities,
  ownQuotes,{contacts,companies}),[ownTasks,sources,ownQuotes,contacts,companies]);
 const badgeIndex=useMemo(()=>buildCalendarBadgeIndex(events,ownTasks,sources.activities,
  companies,contacts,badgeSettings),[events,ownTasks,sources.activities,companies,contacts,badgeSettings]);
 const days=useMemo(()=>calendarMonthDays(month.getFullYear(),month.getMonth()),[month]);
 const compactDays=useMemo(()=>calendarCompactMonthDays(month.getFullYear(),month.getMonth()),[month]);
 const weekDays=useMemo(()=>calendarWeekDays(selected),[selected]);
 const weekMode=embedded&&display==='week';
 const visibleDays=weekMode?weekDays:embedded?compactDays:days;
 const eventsForDay=useMemo(()=>events.filter(item=>item.date===selected).sort((a,b)=>
  Number(Boolean(b.urgent))-Number(Boolean(a.urgent))||a.kind.localeCompare(b.kind)||a.title.localeCompare(b.title)),[events,selected]);
 const shownDayEvents=embedded&&isPhone&&!showAllDay?eventsForDay.slice(0,5):eventsForDay;
 const recentQuotes=useMemo(()=>homeRecentQuotes(ownQuotes,5),[ownQuotes]);
 const recentItems=useMemo(()=>recentHomeItems(ownTasks,sources.activities,ownQuotes,personal,8),
  [ownTasks,sources.activities,ownQuotes,personal]);
 const dailyPages=useMemo(()=>notebookReady?dailyNotebookPages(notebookEntries):[],
  [notebookEntries,notebookReady]);
 const calendarDatesForDay=useMemo(()=>notebookReady?notebookCalendarDates(notebookEntries,selected):[],
  [notebookEntries,notebookReady,selected]);
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
   const kind=recordType==='project'?'deal':recordType==='quote'?'quote':null;
  if(kind)setRecordPreview({kind,id:recordId});
 };
 const openRecent=(item:ReturnType<typeof recentHomeItems>[number])=>{
  setOpen(false);
  if(item.kind==='completed-task')requestTaskModal({mode:'preview',id:item.recordId});
  else setActivityPreview(item.recordId);
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
      const hasNotebookDate=notebookReady&&notebookCalendarDates(notebookEntries,key).length>0;
      const badges=badgeSettings.slots.map(slot=>({...slot,
       count:slot.metric==='none'?0:metricCount(badgeIndex,key,slot.metric)})).filter(slot=>slot.count>0);
      return <button type="button" key={key}
        className={'sales-calendar-day'+(!inMonth?' is-outside':'')+
         (key===today?' is-today':'')+(key===selected?' is-selected':'')}
        aria-pressed={key===selected}
        aria-label={dateLabel(key)+(badges.length?', '+badges.map(slot=>
         slot.count+' '+badgeLabel(slot.metric)).join(', '):', no tracked badges')+
         (badgeSettings.showUrgentBadge&&counts.urgent?', urgent task':'')+
         (hasNotebookDate?', has calendar date':'')}
        onClick={()=>{setSelected(key);if(!inMonth){
         const date=new Date(key+'T12:00:00');setMonth(new Date(date.getFullYear(),date.getMonth(),1,12));
        }}}>
        <span>{Number(key.slice(-2))}</span>
        {badgeSettings.showUrgentBadge&&counts.urgent>0&&<span className="sales-calendar-urgent"
          aria-hidden="true" title={counts.urgent+' urgent task(s)'}>!</span>}
        <span className="sales-calendar-dots home-calendar-custom-dots" aria-hidden="true">
         {badges.map((slot,i)=><i key={i} style={{backgroundColor:badgeColor(slot.color)}}
           title={slot.count+' '+badgeLabel(slot.metric)}>{slot.count>99?'99+':slot.count}</i>)}
        </span>
        {hasNotebookDate&&<span className="notebook-calendar-dot" title="Calendar date"
         aria-hidden="true"/>}
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
      <div><span>{eventsForDay.length} remaining</span>
       {embedded&&<div className="sales-calendar-add-wrap">
        <button type="button" className="sales-calendar-add" aria-haspopup="menu"
         aria-expanded={addOpen} aria-label={'Add to '+dateLabel(selected)}
         title={'Add to '+dateLabel(selected)} onClick={()=>setAddOpen(value=>!value)}>+</button>
        {addOpen&&<div className="sales-calendar-add-menu" role="menu">
         <button type="button" role="menuitem" onClick={()=>{
          setAddOpen(false);requestTaskModal({mode:'create',dueDate:selected});
         }}><svg viewBox="0 0 24 24" width="17" height="17" fill="none"
           stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
           strokeLinejoin="round" aria-hidden="true">
            <rect x="3.5" y="3.5" width="17" height="17" rx="3"/>
            <path d="m7.5 12 3 3 6-6"/>
           </svg> New task</button>
          {selected<=today&&<button type="button" role="menuitem" onClick={()=>{
          setAddOpen(false);
          window.dispatchEvent(new CustomEvent('salesshop:open-activity',
           {detail:{date:selected}}));
         }}><svg viewBox="0 0 24 24" width="17" height="17" fill="none"
           stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
           strokeLinejoin="round" aria-hidden="true">
            <path d="M5 3h3l2.1 5.2-2.3 2.1a16 16 0 0 0 6 6l2.1-2.3L21 16v3.1a2 2 0 0 1-2.2 2C10.6 20.4 3.6 13.4 3 5.2A2 2 0 0 1 5 3Z"/>
           </svg> Log completed activity</button>}
        </div>}
       </div>}
 
      </div></div>
     {eventsForDay.length?<div className="sales-calendar-agenda">
       {shownDayEvents.map(event=><button type="button" key={event.id}
        onClick={()=>openRecord(event)}>
         <span className={'sales-calendar-event-dot is-'+event.kind}
           style={{backgroundColor:agendaDotColors[event.kind]}} aria-hidden="true"/>
         <span className="sales-calendar-event-text"><strong>{event.title}</strong>
          <small>{event.detail}</small></span>
         {event.urgent&&<span className="sales-calendar-agenda-urgent" title="Urgent task" aria-label="Urgent task">!</span>}
         <span className="sales-calendar-agenda-chevron" aria-hidden="true">›</span>
        </button>)}
       {embedded&&isPhone&&eventsForDay.length>5&&
        <button type="button" className="sales-calendar-show-more"
         onClick={()=>setShowAllDay(value=>!value)}>
         {showAllDay?'Show fewer':'Show '+(eventsForDay.length-5)+' more'}
        </button>}
      </div>:<p className="sales-calendar-empty">All caught up for this day.</p>}
     {calendarDatesForDay.length>0&&<div className="sales-calendar-on-calendar"
       aria-label="Calendar dates and events">
      <h4>On the calendar</h4>
      {calendarDatesForDay.map(({entryId,item})=><button type="button"
        key={entryId+':'+item.id}
        onClick={()=>openNotebookCalendarDate({entryId,itemId:item.id})}>
        <span className="notebook-calendar-dot-inline" aria-hidden="true">◦</span>
        <span>{item.title}</span>
        <small>{item.time||'All day'}{item.annual?' · Yearly':''}</small>
       </button>)}
     </div>}
    </section>
    </div>
    {embedded&&<aside className="sales-calendar-sidecar" aria-label="Recent work and private notes">
      <div className="sales-calendar-sidecar-topline">
       <h3>Pick up where you left off</h3>
       <div className="home-sidecar-create" ref={sidecarCreateRef}>
        <button ref={sidecarCreateButton} type="button"
         className="home-note-sidecar-add" title="Quick create"
         aria-label="Quick create" aria-haspopup="menu"
         aria-expanded={sidecarCreateOpen}
         onClick={()=>setSidecarCreateOpen(value=>!value)}>+</button>
        {sidecarCreateOpen&&createPortal(<div ref={sidecarMenuRef}
          className="home-sidecar-create-menu" style={sidecarMenuPosition} role="menu"
          aria-label="Quick create"
          onKeyDown={event=>{
           if(event.key==='Escape'){
            event.preventDefault();event.stopPropagation();
            setSidecarCreateOpen(false);sidecarCreateButton.current?.focus();
            return;
           }
           if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
           event.preventDefault();
           const items=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
           if(!items.length)return;
           const current=items.indexOf(document.activeElement as HTMLButtonElement);
           const delta=event.key==='ArrowDown'?1:-1;
           items[(current+delta+items.length)%items.length].focus();
          }}>
         {mayCreateQuote&&<button type="button" role="menuitem"
           onClick={()=>createFromSidecar('quote')}>
           <SidecarCreateIcon kind="quote"/><span>New Quote</span>
         </button>}
         {mayLogActivity&&<button type="button" role="menuitem"
           onClick={()=>createFromSidecar('activity')}>
           <SidecarCreateIcon kind="activity"/><span>Log Activity</span>
         </button>}
         <button type="button" role="menuitem" onClick={()=>createFromSidecar('note')}>
           <SidecarCreateIcon kind="note"/><span>New Note</span>
         </button>
        </div>,document.body)}
       </div>
      </div>
      <div className="sales-calendar-sidecar-tabs" role="tablist" aria-label="Recent work">
       <button type="button" role="tab" aria-selected={sidecarTab==='quotes'}
        onClick={()=>{setSidecarTab('quotes');setSidecarCreateOpen(false);}}>Quotes</button>
       <button type="button" role="tab" aria-selected={sidecarTab==='recent'}
        onClick={()=>{setSidecarTab('recent');setSidecarCreateOpen(false);}}>Activity</button>
       <button type="button" role="tab" aria-selected={sidecarTab==='notes'}
        onClick={()=>{setSidecarTab('notes');setSidecarCreateOpen(false);}}>Notes</button>
      </div>
      <div className={'sales-calendar-sidecar-list'+(sidecarTab==='notes'?' is-notes':'')}>
       {sidecarTab==='quotes'
        ?recentQuotes.length?recentQuotes.map(q=><button type="button" key={q.id}
          onClick={()=>setRecordPreview({kind:'quote',id:q.id})}>
          <strong>{q.title||'Untitled quote'}</strong>
          <small>{q.companyName||q.quoteNumber||'Quote draft'}</small>
         </button>):<p>Recently edited quotes will appear here.</p>
        :sidecarTab==='recent'
        ?recentItems.length?recentItems.map(item=><button type="button"
          key={item.id} onClick={()=>openRecent(item)}>
          <strong>{item.title}</strong>
          <small>{new Date(item.timestamp).toLocaleDateString()} · {item.detail}</small>
         </button>):<p>Completed tasks and logged interactions will appear here.</p>
        :<div className="home-daily-notes-list">
          {dailyPages.length>0&&<small className="home-note-group-label">Daily pages</small>}
          {dailyPages.map(page=><button type="button" className="home-note-list-item"
           key={page.id} onClick={()=>openHomeNote({mode:'preview',entryId:page.id})}>
           <span className="home-note-list-indicator" aria-hidden="true"/>
           <span className="home-note-list-copy">
            <strong>{page.title}</strong>
            <small>{notebookPlainText(page.contentHtml).slice(0,145)||
              ((page.agendaItems?.length??0)+' linked items')}</small>
           </span>
          </button>)}
          {!dailyPages.length&&
           <p>No notes yet. Use + to start today's Notebook page.</p>}
         </div>}
      </div>
    </aside>}
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
