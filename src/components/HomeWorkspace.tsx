import {useEffect} from 'react';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {QuickCreate} from './QuickCreate';
import {QuickActivityLauncher} from './QuickActivityLauncher';
import {SalesCalendarLauncher} from './SalesCalendarLauncher';
import '../home-workspace.css';

const dateLabel=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric'});

export function HomeWorkspace(){
 const quotes=useQuoteStore(s=>s.quotes),hydrate=useQuoteStore(s=>s.hydrate);
 const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id);
 const role=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
 const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
 useEffect(()=>hydrate(),[hydrate]);
 const canCreate=!rolePreview&&(mode==='local'||!!(userId&&canEditTeamArea(role,department,'quotes')));
 return <main className="sales-home is-calendar-home is-compact-home" aria-label="My SalesShop home">
  <header className="sales-home-heading">
   <div className="sales-home-heading-copy">
    <span className="sales-home-eyebrow">MY WORKSPACE</span>
    <h1>Today</h1><p>{dateLabel.format(new Date())}</p>
   </div>
   <div className="sales-home-top-actions" aria-label="Start work">
    <QuickActivityLauncher />
    {canCreate&&<QuickCreate />}
   </div>
  </header>
  <section className="sales-home-calendar-card" aria-label="Calendar and selected-day agenda">
   <SalesCalendarLauncher embedded />
  </section>
 </main>;
}
