import {useEffect,useMemo} from 'react';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useNavigationStore} from '../store/navigationStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {personalHomeQuotes,homeRecentQuotes} from '../services/homeOverview';
import {displayQuoteNumber} from '../types/quote';
import {QuickCreate} from './QuickCreate';
import {QuickActivityLauncher} from './QuickActivityLauncher';
import {SalesCalendarLauncher} from './SalesCalendarLauncher';
import '../home-workspace.css';

const dateLabel=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric'});
const shortDate=(value:string)=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});

export function HomeWorkspace(){
 const quotes=useQuoteStore(s=>s.quotes),hydrate=useQuoteStore(s=>s.hydrate);
 const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id);
 const role=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
 const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
 const openQuote=useNavigationStore(s=>s.openQuote);
 const setView=useNavigationStore(s=>s.setView);
 useEffect(()=>hydrate(),[hydrate]);
 const mine=useMemo(()=>rolePreview?[]:personalHomeQuotes(quotes,userId,mode==='cloud'),
  [quotes,userId,mode,rolePreview]);
 const recent=useMemo(()=>homeRecentQuotes(mine,4),[mine]);
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
  <section className="sales-home-recent-compact" aria-label="Recent quotes">
   <header className="sales-home-recent-heading">
    <h2>Pick up where you left off <small>· Quotes</small></h2>
    <button type="button" onClick={()=>setView('quotes')}>All quotes ›</button>
   </header>
   {recent.length?<div className="sales-home-recent-lines">
    {recent.map(quote=><button type="button" key={quote.id}
     className="sales-home-recent-line" onClick={()=>openQuote(quote.id)}>
     <strong>{quote.title||'Untitled quote'}</strong>
     <span>{quote.companyName||displayQuoteNumber(quote)}</span>
     <small>Edited {shortDate(quote.updatedAt)}</small><b aria-hidden="true">›</b>
    </button>)}
   </div>:<p className="sales-home-recent-empty">Your recently edited quotes will appear here.</p>}
  </section>
 </main>;
}
