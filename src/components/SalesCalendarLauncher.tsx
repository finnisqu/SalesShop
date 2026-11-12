import {useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {usePersonalTaskStore,taskScope,subtaskProgress} from '../store/personalTaskStore';
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
import {homeRecentQuoteEntries} from '../services/homeOverview';
import {CalendarActivityPreview} from './CalendarActivityPreview';
import {ExternalQuoteBackfillDialog} from './ExternalQuoteBackfillDialog';
import {buildSalesCalendarEvents,personalCalendarSources,recentHomeItems,calendarDayCounts,calendarMonthDays,calendarCompactMonthDays,calendarWeekDays,localDateKey,
 type SalesCalendarEvent} from '../services/salesCalendar';
import {homeCalendarScope,useHomeCalendarSettings,badgeColor,badgeLabel,type CalendarBadgeMetric} from '../store/homeCalendarSettings';
import {buildCalendarBadgeIndex,metricCount} from '../services/homeCalendarBadges';
import {homeCalendarBadgeEntries} from '../services/homeCalendarDrilldown';
import {homeAgendaDotColors} from '../services/homeCalendarAgendaColors';
import {homeAgendaExtras,homeDayOverview,type HomeDayRecord} from '../services/homeDayOverview';
import './sales-calendar.css';

function RecentActivityIcon({kind,method,activityType}:{kind:'activity'|'completed-task'|'system';method?:string;activityType?:string}){
 return <span className="home-recent-activity-icon" aria-hidden="true"><svg viewBox="0 0 24 24"
  width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8"
  strokeLinecap="round" strokeLinejoin="round">
  {kind==='completed-task'?<><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/></>:
   method==='call'?<path d="M5 3h3l2 5-2 2a16 16 0 0 0 6 6l2-2 5 2v3a2 2 0 0 1 2-2Z"/>:
   method==='email'?<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>:
   method==='text'?<path d="M21 11a8 8 0 0 1-8 8H5l2-4a8 8 0 1 1 14-4Z"/>:
   method==='video-call'?<><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></>:
   method==='in-person'?<><rect x="3.5" y="2.5" width="17" height="19" rx="3.3"/>
    <circle cx="12" cy="9" r="3.1"/><path d="M6.5 18c.5-3 2.6-4.5 5.5-4.5s5 1.5 5.5 4.5"/></>:
   activityType==='quote-sent'?<><rect x="5" y="3" width="13" height="18" rx="2"/><path d="M8 8h7M8 12h7m-3 4h7m0 0-3-3m3 3-3 3"/></>:
   <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>}
 </svg></span>;
}
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
const readDisplay=(key:string,phone:boolean,preferred:'auto'|'week'|'month'):CalendarDisplay=>{
 if(preferred==='week'||preferred==='month')return preferred;
 try{const stored=localStorage.getItem(key);if(stored==='week'||stored==='month')return stored;}catch{/* best effort */}
 return phone?'week':'month';
};
export function SalesCalendarLauncher({compact=false,label='Calendar',embedded=false,
 recentPortalTarget=null,showRecent=true,showCalendar=true}:{
 compact?:boolean;label?:string;embedded?:boolean;recentPortalTarget?:HTMLElement|null;
 showRecent?:boolean;showCalendar?:boolean;
}){
 const button=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 const [position,setPosition]=useState<CSSProperties>({});
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1,12));
 const [selected,setSelected]=useState(()=>localDateKey(new Date()));
 const [isPhone,setIsPhone]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches);
 const [showAllDay,setShowAllDay]=useState(false);
 const [addOpen,setAddOpen]=useState(false);
 const [externalQuoteDialogOpen,setExternalQuoteDialogOpen]=useState(false);
 const addButtonRef=useRef<HTMLButtonElement>(null);
 const addMenuRef=useRef<HTMLDivElement>(null);
 const [addMenuPosition,setAddMenuPosition]=useState<CSSProperties>({top:-9999,left:-9999});
 const [recordPreview,setRecordPreview]=useState<PreviewRecord|null>(null);
 const [activityPreview,setActivityPreview]=useState<string|null>(null);
 const [badgeFocus,setBadgeFocus]=useState<{date:string;metric:CalendarBadgeMetric}|null>(null);
 const [expandedHistory,setExpandedHistory]=useState<Set<string>>(()=>new Set());
 const agendaRef=useRef<HTMLElement>(null);
 const [sidecarTab,setSidecarTab]=useState<'quotes'|'recent'|'notes'>('quotes');
 const [sidecarCreateOpen,setSidecarCreateOpen]=useState(false);
 const [sidecarMenuPosition,setSidecarMenuPosition]=useState<CSSProperties>({top:-9999,left:-9999});
 const sidecarMenuRef=useRef<HTMLDivElement>(null);
 const sidecarCreateRef=useRef<HTMLDivElement>(null);
 const sidecarCreateButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const media=window.matchMedia('(max-width:760px)');
  const update=()=>setIsPhone(media.matches);
  update();media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
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
 const displayKey=prefKey+':'+badgeSettings.defaultCalendarView;
 const [savedDisplay,setSavedDisplay]=useState<{key:string;display:CalendarDisplay}>(
  ()=>({key:displayKey,display:readDisplay(prefKey,isPhone,badgeSettings.defaultCalendarView)}));
 const display=savedDisplay.key===displayKey?savedDisplay.display:
  readDisplay(prefKey,isPhone,badgeSettings.defaultCalendarView);
 const chooseDisplay=(next:CalendarDisplay)=>{
  setSavedDisplay({key:displayKey,display:next});
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
 const activeFocus=badgeFocus?.date===selected?badgeFocus:null;
 const focusEntries=useMemo(()=>activeFocus
  ?homeCalendarBadgeEntries(activeFocus.metric,selected,events,ownTasks,
    sources.activities,companies,contacts,badgeSettings):[],
  [activeFocus,selected,events,ownTasks,sources.activities,companies,contacts,badgeSettings]);
 const focusKeys=useMemo(()=>new Set(focusEntries.map(entry=>entry.kind+':'+entry.id)),[focusEntries]);
 const hasFocus=(kind:string,id:string)=>Boolean(activeFocus&&focusKeys.has(kind+':'+id));
 const canDrillIntoBadges=!isPhone||badgeSettings.clickableMobileBadges;
 const dayGroups=useMemo(()=>homeDayOverview(selected,{
  events,tasks:ownTasks,activities:sources.activities,quotes:ownQuotes,
  deals:sources.deals,companies,contacts,
  notebook:notebookReady?notebookEntries:[],
 }),[selected,events,ownTasks,sources.activities,ownQuotes,sources.deals,
     companies,contacts,notebookReady,notebookEntries]);
 // Pending agenda items already appear above; show other dated history
 // below without duplicating their Task/Bid rows.
 const otherDayGroups=useMemo(()=>homeAgendaExtras(dayGroups),[dayGroups]);
 const otherDayTotal=useMemo(()=>otherDayGroups.reduce((total,group)=>
  total+group.entries.length,0),[otherDayGroups]);
 useEffect(()=>{
  if(!activeFocus)return;
  const matching=otherDayGroups.filter(group=>group.entries.some(entry=>
   focusKeys.has(entry.kind+':'+entry.id)));
  if(matching.length)setExpandedHistory(previous=>{
   const next=new Set(previous);
   matching.forEach(group=>next.add(selected+':'+group.key));
   return next;
  });
 },[activeFocus,selected,otherDayGroups,focusKeys]);
 useEffect(()=>{
  if(!activeFocus)return;
  const timeout=window.setTimeout(()=>setBadgeFocus(null),5200);
  const frame=window.requestAnimationFrame(()=>{
   window.requestAnimationFrame(()=>{
    const matching=agendaRef.current?.querySelector<HTMLElement>('[data-home-badge-match="true"]');
    const fallback=agendaRef.current?.querySelector<HTMLElement>('.home-day-agenda-extra');
    (matching??fallback??agendaRef.current)?.scrollIntoView({
     behavior:'smooth',block:'nearest',inline:'nearest'});
   });
  });
  return()=>{window.clearTimeout(timeout);window.cancelAnimationFrame(frame);};
 },[activeFocus,selected,expandedHistory,focusKeys]);
 const recentQuotes=useMemo(()=>homeRecentQuoteEntries(ownQuotes,sources.activities,5),
  [ownQuotes,sources.activities]);
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
   const target=event.target as Node;
   if(!addButtonRef.current?.contains(target)&&!addMenuRef.current?.contains(target))
    setAddOpen(false);
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){setAddOpen(false);addButtonRef.current?.focus();}
  };
  // Position a body-level portal above clipped one-item agendas.
  const place=()=>{
   const anchor=addButtonRef.current?.getBoundingClientRect(),menu=addMenuRef.current;
   if(!anchor||!menu)return;
   const viewport=window.visualViewport;
   const minX=(viewport?.offsetLeft??0)+8,minY=(viewport?.offsetTop??0)+8;
   const maxX=(viewport?.offsetLeft??0)+(viewport?.width??window.innerWidth)-8;
   const maxY=(viewport?.offsetTop??0)+(viewport?.height??window.innerHeight)-8;
   const width=menu.offsetWidth||210,height=menu.offsetHeight||94;
   const left=Math.min(Math.max(minX,anchor.right-width),Math.max(minX,maxX-width));
   const below=anchor.bottom+6;
   const top=below+height<=maxY?below:Math.max(minY,anchor.top-height-6);
   setAddMenuPosition({position:'fixed',left:Math.round(left),top:Math.round(top)});
  };
  place();
  document.addEventListener('pointerdown',dismiss);
  document.addEventListener('keydown',escape);
  document.addEventListener('scroll',place,true);
  window.addEventListener('resize',place);
  window.visualViewport?.addEventListener('resize',place);
  window.visualViewport?.addEventListener('scroll',place);
  return()=>{
   document.removeEventListener('pointerdown',dismiss);
   document.removeEventListener('keydown',escape);
   document.removeEventListener('scroll',place,true);
   window.removeEventListener('resize',place);
   window.visualViewport?.removeEventListener('resize',place);
   window.visualViewport?.removeEventListener('scroll',place);
  };
 },[addOpen,selected]);
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
  setMonth(next);setSelected(localDateKey(next));setBadgeFocus(null);
 };
 const changePeriod=(delta:number)=>{
  if(!weekMode){changeMonth(delta);return;}
  const date=new Date(selected+'T12:00:00');
  date.setDate(date.getDate()+7*delta);
  setSelected(localDateKey(date));setBadgeFocus(null);
  setMonth(new Date(date.getFullYear(),date.getMonth(),1,12));
 };
 const openRecord=(event:SalesCalendarEvent)=>{
  setOpen(false);
  const {recordType,recordId}=event;
  if(recordType==='task'){requestTaskModal({mode:'preview',id:recordId});return;}
   const kind=recordType==='project'?'deal':recordType==='quote'?'quote':null;
  if(kind)setRecordPreview({kind,id:recordId});
 };
 const openDayRecord=(record:HomeDayRecord)=>{
  setOpen(false);
  if(record.kind==='task'){requestTaskModal({mode:'preview',id:record.id});return;}
  if(record.kind==='activity'){setActivityPreview(record.id);return;}
  if(record.kind==='note'){openHomeNote({mode:'preview',entryId:record.id});return;}
  if(record.kind==='calendar-date'){
   openNotebookCalendarDate({entryId:record.id,itemId:record.itemId});
   return;
  }
  setRecordPreview({kind:record.kind,id:record.id});
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
 // Render the Recent panel into a separate Home section without duplicating
 // any calendar data subscriptions, previews, or quick-create logic.
 const recentPanel=embedded&&showRecent?(
  <aside className="sales-calendar-sidecar" aria-label="Recent work and private notes">
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
          onClick={()=>q.kind==='external'
           ?setActivityPreview(q.recordId):setRecordPreview({kind:'quote',id:q.recordId})}>
          <strong>{q.title}</strong>
          <small>{q.detail}</small>
         </button>):<p>Native and external quotes will appear here.</p>
        :sidecarTab==='recent'
        ?recentItems.length?recentItems.map(item=><button type="button"
          className="home-recent-activity-row" key={item.id} onClick={()=>openRecent(item)}>
          <RecentActivityIcon kind={item.kind} method={item.method} activityType={item.activityType}/>
          <span className="home-recent-activity-copy">
           <strong>{item.title}</strong>
           <small>{new Date(item.timestamp).toLocaleDateString()} · {item.detail}</small>
          </span>
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
    </aside>
 ):null;
 const calendarPanel=(
   <section className={"sales-calendar-popover"+(embedded?" is-inline":"")+(weekMode?" is-week":"")+
      (embedded&&!showCalendar?" is-calendar-hidden":"")} style={embedded?undefined:position}
    role={embedded?undefined:'dialog'} aria-modal={embedded?undefined:false} aria-label="SalesShop calendar"
    onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);}}}>
    <header className="sales-calendar-heading">
     <div className="sales-calendar-period">
      <button type="button" className="sales-calendar-today" title="Jump to today"
       aria-label="Jump to today" onClick={()=>{
        const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1,12));
        setSelected(localDateKey(now));setBadgeFocus(null);
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
      const selectDate=()=>{
       setSelected(key);setBadgeFocus(null);
       if(!inMonth){const date=new Date(key+'T12:00:00');
        setMonth(new Date(date.getFullYear(),date.getMonth(),1,12));}
      };
      return <div key={key} className={'sales-calendar-day'+(!inMonth?' is-outside':'')+
         (key===today?' is-today':'')+(key===selected?' is-selected':'')}>
        <button type="button" className="sales-calendar-day-select"
         aria-pressed={key===selected}
         aria-label={dateLabel(key)+(badges.length?', '+badges.map(slot=>
          slot.count+' '+badgeLabel(slot.metric)).join(', '):', no tracked badges')+
          (badgeSettings.showUrgentBadge&&counts.urgent?', urgent task':'')+
          (hasNotebookDate?', has calendar date':'')}
         onClick={selectDate}>
         {weekMode&&<small className="sales-calendar-week-day-label" aria-hidden="true">
           {new Date(key+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})}
          </small>}
         <span>{Number(key.slice(-2))}</span>
         {badgeSettings.showUrgentBadge&&counts.urgent>0&&
          <span className="sales-calendar-urgent" aria-hidden="true"
           title={counts.urgent+' urgent task(s)'}>!</span>}
         {hasNotebookDate&&<span className="notebook-calendar-dot"
          title="Calendar date" aria-hidden="true"/>}
        </button>
        <span className="sales-calendar-dots home-calendar-custom-dots"
         aria-hidden={!canDrillIntoBadges}>
         {badges.map((slot,i)=>canDrillIntoBadges
          ?<button type="button" key={i} className="home-calendar-badge-action"
            style={{backgroundColor:badgeColor(slot.color)}}
            aria-label={slot.count+' '+badgeLabel(slot.metric)+' on '+dateLabel(key)+'. Highlight in agenda'}
            title={'Highlight '+badgeLabel(slot.metric)+' in agenda'}
            onClick={()=>{
             setSelected(key);setBadgeFocus({date:key,metric:slot.metric});
             if(!inMonth){const date=new Date(key+'T12:00:00');
              setMonth(new Date(date.getFullYear(),date.getMonth(),1,12));}
            }}>{slot.count>99?'99+':slot.count}</button>
          :<i key={i} style={{backgroundColor:badgeColor(slot.color)}}
             title={slot.count+' '+badgeLabel(slot.metric)}>
             {slot.count>99?'99+':slot.count}</i>)}
        </span>
       </div>;
     })}
    </div>
     </div>
    <section ref={agendaRef} className="sales-calendar-day-preview"
     aria-label={'Items for '+dateLabel(selected)}
     onClickCapture={()=>{if(activeFocus)setBadgeFocus(null);}}>
     <div className="sales-calendar-preview-heading"><strong>{dateLabel(selected)}</strong>
      <div><span aria-label={eventsForDay.length+' pending items'}>{'Pending · '+eventsForDay.length}</span>
       {embedded&&<div className="sales-calendar-add-wrap">
        <button ref={addButtonRef} type="button" className="sales-calendar-add" aria-haspopup="menu"
         aria-expanded={addOpen} aria-label={'Add to '+dateLabel(selected)}
         title={'Add to '+dateLabel(selected)} onClick={()=>setAddOpen(value=>!value)}>+</button>
        {addOpen&&createPortal(<div ref={addMenuRef} className="sales-calendar-add-menu is-floating" style={addMenuPosition} role="menu">
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
           </svg> Log Activity</button>}
          {mayLogActivity&&selected<=today&&<button type="button" role="menuitem" onClick={()=>{
           setAddOpen(false);setExternalQuoteDialogOpen(true);
          }}><svg viewBox="0 0 24 24" width="17" height="17" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"><rect x="5" y="3" width="13" height="18" rx="2"/>
            <path d="M8 8h7M8 12h5m0 4h7m0 0-3-3m3 3-3 3"/></svg> Record external quote</button>}
        </div>,document.body)}
       </div>}
 
      </div></div>
     <div className="sales-calendar-agenda">
      {eventsForDay.length?shownDayEvents.map(event=><button type="button" key={event.id}
       data-home-badge-match={hasFocus(event.recordType==='project'?'deal':event.recordType,event.recordId)}
       className={hasFocus(event.recordType==='project'?'deal':event.recordType,event.recordId)?'is-badge-highlighted':''}
       onClick={()=>openRecord(event)}>
        <span className={'sales-calendar-event-dot is-'+event.kind}
         style={{backgroundColor:agendaDotColors[event.kind]}} aria-hidden="true"/>
        <span className="sales-calendar-event-text"><strong>{event.title}</strong>
         <small>{event.detail}</small></span>
        {event.kind==='task'&&event.recordType==='task'&&(()=>{
          const task=ownTasks.find(item=>item.id===event.recordId);
          const progress=task?subtaskProgress(task):null;
          return progress&&progress.total>0?<span className="sales-calendar-subtask-count"
            title={progress.done+' of '+progress.total+' subtasks complete'}
            aria-label={progress.done+' of '+progress.total+' subtasks complete'}>
            {progress.done}/{progress.total}</span>:null;
        })()}
        {event.urgent&&<span className="sales-calendar-agenda-urgent"
         title="Urgent task" aria-label="Urgent task">!</span>}
        <span className="sales-calendar-agenda-chevron" aria-hidden="true">›</span>
       </button>):
       <p className="sales-calendar-empty">
        {otherDayTotal||calendarDatesForDay.length?'No pending work for this day.':'All caught up for this day.'}
       </p>}
      {embedded&&isPhone&&eventsForDay.length>5&&
       <button type="button" className="sales-calendar-show-more"
        onClick={()=>setShowAllDay(value=>!value)}>
        {showAllDay?'Show fewer':'Show '+(eventsForDay.length-5)+' more'}
       </button>}
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
      {embedded&&otherDayTotal>0&&<section className="home-day-agenda-extra"
       aria-label={'Other records on '+dateLabel(selected)}>
       <div className="home-day-agenda-extra-title">
        <strong>On this day</strong>
        <span>{otherDayTotal} {otherDayTotal===1?'record':'records'}</span>
       </div>
       {otherDayGroups.map(group=><details key={selected+':'+group.key}
        className="home-day-agenda-group"
        open={expandedHistory.has(selected+':'+group.key)}>
        <summary onClick={event=>{
          event.preventDefault();
          const id=selected+':'+group.key;
          setExpandedHistory(previous=>{
           const next=new Set(previous);
           if(next.has(id))next.delete(id);else next.add(id);
           return next;
          });
        }}>
         <span className="home-day-agenda-group-label">{group.label}</span>
         <span className="home-day-agenda-group-count">{group.entries.length}</span>
         <span className="home-day-agenda-group-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="home-day-agenda-records">
         {group.entries.map(record=><button type="button" key={record.key}
          className={hasFocus(record.kind,record.id)?'is-badge-highlighted':''}
          data-home-badge-match={hasFocus(record.kind,record.id)}
          onClick={()=>openDayRecord(record)} aria-label={'Open '+record.title}>
          <span><strong>{record.title}</strong><small>{record.detail}</small></span>
          <span aria-hidden="true">›</span>
         </button>)}
        </div>
       </details>)}
      </section>}
     </div>
    </section>
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
  {embedded?<div className="sales-calendar-inline">{calendarPanel}{!recentPortalTarget&&recentPanel}</div>
   :open&&createPortal(<div className="sales-calendar-backdrop"
     onPointerDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
     {calendarPanel}</div>,document.body)}
  {recentPortalTarget&&recentPanel&&createPortal(recentPanel,recentPortalTarget)}
  {externalQuoteDialogOpen&&<ExternalQuoteBackfillDialog initialSentDate={selected}
    onClose={()=>setExternalQuoteDialogOpen(false)}
    onRecorded={(_deal,date)=>{
     setExternalQuoteDialogOpen(false);setSelected(date);
     setMonth(new Date(date+'T12:00:00'));
     setBadgeFocus({date,metric:'quotes-sent'});
     setSidecarTab('recent');
   }}/>}
  {recordPreview&&<RecordPreviewDrawer record={recordPreview}
   onSelect={setRecordPreview} onClose={()=>setRecordPreview(null)}/>}
  {activityPreview&&<CalendarActivityPreview activityId={activityPreview}
   onClose={()=>setActivityPreview(null)} onSelect={openLinkedRecord}/>}
 </>;
}
