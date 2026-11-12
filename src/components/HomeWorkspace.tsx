import {useEffect,useState} from 'react';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {QuickCreate} from './QuickCreate';
import {HomeCalendarGearButton,HomeCalendarCustomizer} from './HomeCalendarCustomizer';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {SalesCalendarLauncher} from './SalesCalendarLauncher';
import {homeCalendarScope,syncHomeCalendarSettings} from '../store/homeCalendarSettings';
import '../home-workspace.css';
import './home-layout-custom.css';
import './home-week-focus.css';

const dateLabel=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric'});
const compactDateLabel=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'});

export function HomeWorkspace(){
 const hydrate=useQuoteStore(s=>s.hydrate);
 const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id),
  orgId=useAuthStore(s=>s.organizationId);
 const role=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
 const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
 const scope=homeCalendarScope(mode,orgId,userId);
 const [recentHost,setRecentHost]=useState<HTMLDivElement|null>(null);
 useEffect(()=>hydrate(),[hydrate]);
 useEffect(()=>{
  let active=true;
  const update=()=>{
   if(active&&document.visibilityState!=='hidden'){
    void syncHomeCalendarSettings(scope);
   }
  };
  update();
  window.addEventListener('focus',update);
  document.addEventListener('visibilitychange',update);
  return()=>{active=false;window.removeEventListener('focus',update);
   document.removeEventListener('visibilitychange',update);};
 },[scope]);
 const canCreate=!rolePreview&&(mode==='local'||!!(userId&&canEditTeamArea(role,department,'quotes')));
 const canLog=!rolePreview&&(mode==='local'||!!(userId&&canEditTeamArea(role,department,'crm')));
 // Keep Home's three sections visible in their familiar order for now.
 // Existing stored layout preferences are preserved for a future editor.
 const shown={quickActions:true,calendar:true,recent:true};
 const order=['quickActions','calendar','recent'] as const;
 // In the default arrangement, Quick Actions belongs in the heading row
 // as before. If reordered, it remains a movable standalone section.
 const quickInHeader=shown.quickActions&&order[0]==='quickActions';
 const calendarIndex=order.indexOf('calendar');
 const recentIndex=order.indexOf('recent');
 const quickIndex=order.indexOf('quickActions');
 const recentFirst=recentIndex<calendarIndex;
 const quickBetween=quickIndex>Math.min(calendarIndex,recentIndex)&&
  quickIndex<Math.max(calendarIndex,recentIndex);
 const twoColumn=shown.calendar&&shown.recent&&!quickBetween;
 const quickActions=<div className="sales-home-top-actions" aria-label="Start work">
   {canLog&&<button type="button" className="sales-log-launcher"
     onClick={()=>openActivityComposer()}>Log Activity</button>}
   {canCreate&&<QuickCreate />}
   {!canCreate&&!canLog&&<p className="sales-home-no-actions">Quick actions are unavailable in the current workspace view.</p>}
  </div>;
 const sections={
  quickActions:<section className="sales-home-actions-section" key="quickActions"
    hidden={!shown.quickActions} aria-label="Quick actions">
    {quickActions}
   </section>,
  calendar:<section className="sales-home-calendar-card" key="calendar"
    hidden={!shown.calendar} aria-label="Calendar and selected-day agenda">
    <SalesCalendarLauncher embedded recentPortalTarget={recentHost}
      showCalendar={shown.calendar} showRecent={shown.recent}/>
   </section>,
  recent:<section className="sales-home-recent-card" key="recent"
    hidden={!shown.recent} aria-label="Recent work and outstanding tasks">
    <div ref={setRecentHost} className="sales-home-recent-host"/>
   </section>,
 };
 return <main className="sales-home is-calendar-home is-compact-home" aria-label="My SalesShop home">
  <header className="sales-home-heading">
   <div className="sales-home-heading-copy">
    <span className="sales-home-eyebrow">MY WORKSPACE</span>
    <div className="ss-workspace-title-row"><h1>Today</h1><HomeCalendarGearButton/></div>
    <p className="sales-home-date"><span className="sales-home-date-long">{dateLabel.format(new Date())}</span>
     <span className="sales-home-date-short">{compactDateLabel.format(new Date())}</span></p>
   </div>
   {quickInHeader&&<div className="sales-home-heading-actions">{quickActions}</div>}
  </header>
  <div className={'sales-home-section-list'+(twoColumn?' is-two-column':'')+
   (recentFirst?' is-recent-first':'')}>
   {order.map(key=>key==='quickActions'&&quickInHeader?null:sections[key])}
  </div>
  <HomeCalendarCustomizer/>
 </main>;
}
