import {useEffect} from 'react';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {QuickCreate} from './QuickCreate';
import {HomeCalendarGearButton,HomeCalendarCustomizer} from './HomeCalendarCustomizer';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {SalesCalendarLauncher} from './SalesCalendarLauncher';
import '../home-workspace.css';

const dateLabel=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric'});

export function HomeWorkspace(){
 const hydrate=useQuoteStore(s=>s.hydrate);
 const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id);
 const role=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
 const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
 useEffect(()=>hydrate(),[hydrate]);
 const canCreate=!rolePreview&&(mode==='local'||!!(userId&&canEditTeamArea(role,department,'quotes')));
 const canLog=!rolePreview&&(mode==='local'||!!(userId&&canEditTeamArea(role,department,'crm')));
 return <main className="sales-home is-calendar-home is-compact-home" aria-label="My SalesShop home">
  <header className="sales-home-heading">
   <div className="sales-home-heading-copy">
    <span className="sales-home-eyebrow">MY WORKSPACE</span>
    <div className="ss-workspace-title-row"><h1>Today</h1><HomeCalendarGearButton/></div><p>{dateLabel.format(new Date())}</p>
   </div>
   <div className="sales-home-top-actions" aria-label="Start work">
    {canLog&&<button type="button" className="sales-log-launcher"
      onClick={()=>openActivityComposer()}>Log Activity</button>}
    {canCreate&&<QuickCreate />}
   </div>
  </header>
  <section className="sales-home-calendar-card" aria-label="Calendar and selected-day agenda">
   <SalesCalendarLauncher embedded />
  </section>
  <HomeCalendarCustomizer/>
 </main>;
}
