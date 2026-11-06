import {useEffect,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {useAuthStore} from '../store/authStore';
import {CALENDAR_BADGE_OPTIONS,CALENDAR_BADGE_COLORS,
 badgeLabel,badgeColor,homeCalendarScope,readHomeCalendarSettings,
 saveHomeCalendarSettings,useHomeCalendarSettings,
 type CalendarBadgeMetric,type CalendarBadgeColor,type HomeCalendarSettings} from '../store/homeCalendarSettings';
import './home-calendar-customizer.css';

const eventName='salesshop:open-home-calendar-settings';
export function openHomeCalendarCustomizer(){
 window.dispatchEvent(new Event(eventName));
}
export function HomeCalendarGearButton({className=''}:{className?:string}){
 return <button type="button" className={'home-calendar-gear '+className}
  onClick={openHomeCalendarCustomizer} aria-label="Customize Home calendar" title="Customize Home calendar">
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
   <path d="M10.4 2.8h3.2l.6 2.3a7.5 7.5 0 0 1 1.6.9l2.3-.7 2.2 2.2-.8 2.3c.4.5.6 1 .9 1.6l2.3.6v3.2l-2.3.6a7 7 0 0 1-.9 1.6l.8 2.3-2.2 2.2-2.3-.7c-.5.4-1 .6-1.6.9l-.6 2.3h-3.2l-.6-2.3a7 7 0 0 1-1.6-.9l-2.3.7-2.2-2.2.8-2.3a7 7 0 0 1-.9-1.6l-2.3-.6V10l2.3-.6c.2-.6.5-1.1.9-1.6l-.8-2.3L6 3.3l2.3.7a7 7 0 0 1 1.6-.9z"/>
   <circle cx="12" cy="12" r="3.2"/>
  </svg>
 </button>;
}
export function CalendarBadgeLegend({settings,showEmpty=false}:{
 settings:HomeCalendarSettings;showEmpty?:boolean;
}){
 return <div className="home-calendar-badge-legend" aria-label="Calendar badge legend">
  {settings.slots.map((slot,i)=>slot.metric!=='none'
   ?<span className="home-calendar-badge-legend-item" key={i}>
     <i style={{backgroundColor:badgeColor(slot.color)}} aria-hidden="true"/>
     <span>{badgeLabel(slot.metric)}</span>
    </span>
   :showEmpty?<span className="home-calendar-badge-legend-item is-empty" key={i}>
     <i aria-hidden="true"/>Unused slot</span>:null)}
  {settings.showUrgentBadge&&<span className="home-calendar-badge-legend-item">
   <b className="home-calendar-legend-urgent" aria-hidden="true">!</b><span>Urgent task</span>
  </span>}
 </div>;
}
export function HomeCalendarHelpLegend(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 const settings=useHomeCalendarSettings(homeCalendarScope(mode,org,userId));
 return <div className="home-calendar-help-legend">
  <strong>Your calendar badges</strong>
  <CalendarBadgeLegend settings={settings}/>
  <small>{settings.countDownCompletedTasks
   ?'Completed tasks stop counting toward your task badges.'
   :'Completed tasks remain counted on their original due dates.'} Change these settings with the Home gear.</small>
 </div>;
}
export function HomeCalendarCustomizer(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id);
 const scope=homeCalendarScope(mode,org,userId);
 const current=useHomeCalendarSettings(scope);
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState<HomeCalendarSettings>(current);
 const ref=useDismissibleLayer<HTMLDivElement>(open,()=>setOpen(false));
 useEffect(()=>{
  const launch=()=>{
   setDraft({...readHomeCalendarSettings(scope),
    slots:readHomeCalendarSettings(scope).slots.map(slot=>({...slot})) as HomeCalendarSettings['slots']});
   setOpen(true);
  };
  window.addEventListener(eventName,launch);
  return()=>window.removeEventListener(eventName,launch);
 },[scope]);
 useEffect(()=>{setOpen(false);},[scope]);
 useEffect(()=>{
  if(!open)return;
  const oldBody=document.body.style.overflow;
  const oldHtml=document.documentElement.style.overflow;
  document.body.style.overflow='hidden';
  document.documentElement.style.overflow='hidden';
  return()=>{
   document.body.style.overflow=oldBody;
   document.documentElement.style.overflow=oldHtml;
  };
 },[open]);
 const changeSlot=(index:number,change:Partial<{metric:CalendarBadgeMetric;color:CalendarBadgeColor}>)=>{
  setDraft(previous=>({...previous,slots:previous.slots.map((slot,i)=>
   i===index?{...slot,...change}:slot) as HomeCalendarSettings['slots']}));
 };
 const save=()=>{saveHomeCalendarSettings(scope,draft);setOpen(false);};
 if(!open)return null;
 return createPortal(<div className="home-calendar-customize-backdrop"
  onPointerDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
  <div ref={ref} role="dialog" aria-modal="true" aria-label="Customize Home calendar"
   className="home-calendar-customize-sheet">
   <header>
    <div><small>HOME · PERSONALIZE</small><h2>Calendar badges</h2>
     <p>Choose up to four things to track and give each badge a color. Badges count records by day; your agenda still shows only pending work.</p></div>
    <button type="button" aria-label="Close customizer" onClick={()=>setOpen(false)}>×</button>
   </header>
   <div className="home-calendar-customize-body">
    <div className="home-calendar-customize-slots">
     {draft.slots.map((slot,i)=><div className="home-calendar-customize-slot" key={i}>
      <div className="home-calendar-customize-slot-head"><strong>Badge {i+1}</strong>
       <span className="home-calendar-preview-pill" style={{backgroundColor:badgeColor(slot.color)}}>{i+1}</span></div>
      <label htmlFor={'home-calendar-metric-'+i}>Track</label>
      <select id={'home-calendar-metric-'+i} value={slot.metric}
       onChange={event=>changeSlot(i,{metric:event.target.value as CalendarBadgeMetric})}>
       {CALENDAR_BADGE_OPTIONS.map(option=><option key={option.id} value={option.id}
         disabled={option.id!=='none'&&draft.slots.some((other,j)=>j!==i&&other.metric===option.id)}>
         {option.label}</option>)}
      </select>
      <div className="home-calendar-colors" role="group" aria-label={'Color for badge '+(i+1)}>
       {CALENDAR_BADGE_COLORS.map(color=><button type="button" key={color.id}
         disabled={slot.metric==='none'} aria-label={color.name}
         aria-pressed={slot.color===color.id} title={color.name}
         onClick={()=>changeSlot(i,{color:color.id})}
         style={{'--home-badge-option':color.hex} as CSSProperties}>
         {slot.color===color.id?<span aria-hidden="true">✓</span>:null}
       </button>)}
      </div>
     </div>)}
    </div>
    <div className="home-calendar-customize-toggles">
     <h3>Calendar behavior</h3>
     <label><input type="checkbox" checked={draft.countDownCompletedTasks}
       onChange={event=>setDraft(previous=>({...previous,countDownCompletedTasks:event.target.checked}))}/>
      <span><strong>Count down tasks when completed</strong>
       <small>Completed tasks disappear from task and due-date badge counts. Turn off to retain their original daily totals.</small></span>
     </label>
     <label><input type="checkbox" checked={draft.showUrgentBadge}
       onChange={event=>setDraft(previous=>({...previous,showUrgentBadge:event.target.checked}))}/>
      <span><strong>Show urgent ! badge</strong>
       <small>Display a separate exclamation mark on days containing urgent, outstanding tasks.</small></span>
     </label>
    </div>
    <div className="home-calendar-customize-preview"><strong>Legend preview</strong>
     <CalendarBadgeLegend settings={draft} showEmpty/></div>
    <p className="home-calendar-customize-note">Calls, emails, texts and meetings use logged interactions. Company and person creation badges show workspace records. Quotes sent include external bids recorded in SalesShop.</p>
   </div>
   <footer>
    <button type="button" onClick={()=>setDraft({
     slots:[
      {metric:'tasks',color:'blue'},{metric:'bid-due',color:'orange'},
      {metric:'activities',color:'teal'},{metric:'quotes-sent',color:'purple'}],
     countDownCompletedTasks:true,showUrgentBadge:true,
    })}>Reset</button>
    <span/>
    <button type="button" onClick={()=>setOpen(false)}>Cancel</button>
    <button type="button" className="is-primary" onClick={save}>Save badges</button>
   </footer>
  </div>
 </div>,document.body);
}
