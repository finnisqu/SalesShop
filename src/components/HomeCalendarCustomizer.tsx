import {useEffect,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {useAuthStore} from '../store/authStore';
import {CALENDAR_BADGE_OPTIONS,CALENDAR_BADGE_COLORS,DEFAULT_HOME_CALENDAR_SETTINGS,HOME_SECTION_IDS,
 badgeLabel,badgeColor,homeCalendarScope,readHomeCalendarSettings,
 saveHomeCalendarSettingsWithSync,useHomeCalendarSettings,
 type CalendarBadgeMetric,type CalendarBadgeColor,type HomeCalendarSettings,
 type HomeSectionId} from '../store/homeCalendarSettings';
import './home-calendar-customizer.css';

const eventName='salesshop:open-home-calendar-settings';
export function openHomeCalendarCustomizer(){
 window.dispatchEvent(new Event(eventName));
}
export function HomeCalendarGearButton({className=''}:{className?:string}){
 return <button type="button" className={'home-calendar-gear '+className}
  onClick={openHomeCalendarCustomizer} aria-label="Customize Home calendar" title="Customize Home calendar">
  <svg className="home-calendar-gear-icon" width="20" height="20"
   viewBox="0 0 24 24" fill="none" stroke="currentColor"
   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
   aria-hidden="true" focusable="false">
   <path d="M9.51 4.77 L9.98 2.51 L14.02 2.51 L14.49 4.77 L15.35 5.12 L17.28 3.86 L20.14 6.72 L18.88 8.65 L19.23 9.51 L21.49 9.98 L21.49 14.02 L19.23 14.49 L18.88 15.35 L20.14 17.28 L17.28 20.14 L15.35 18.88 L14.49 19.23 L14.02 21.49 L9.98 21.49 L9.51 19.23 L8.65 18.88 L6.72 20.14 L3.86 17.28 L5.12 15.35 L4.77 14.49 L2.51 14.02 L2.51 9.98 L4.77 9.51 L5.12 8.65 L3.86 6.72 L6.72 3.86 L8.65 5.12 Z"/>
   <circle cx="12" cy="12" r="3.0"/>
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
 const [syncNotice,setSyncNotice]=useState('');
 const [saving,setSaving]=useState(false);
 const ref=useDismissibleLayer<HTMLDivElement>(open,()=>setOpen(false));
 useEffect(()=>{
  const launch=()=>{
   setDraft({...readHomeCalendarSettings(scope),
    slots:readHomeCalendarSettings(scope).slots.map(slot=>({...slot})) as HomeCalendarSettings['slots']});
   setSyncNotice('');setOpen(true);
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
 const save=async()=>{
  if(saving)return;
  setSaving(true);setSyncNotice('');
  try{
   const result=await saveHomeCalendarSettingsWithSync(scope,draft);
   if(result==='error'){
    setSyncNotice('Saved on this device. Cloud sync could not finish; use Save again to retry.');
    return;
   }
   setOpen(false);
  }finally{setSaving(false);}
 };
 const changeSection=(id:HomeSectionId,visible:boolean)=>{
  setDraft(previous=>({...previous,visibleSections:{...previous.visibleSections,[id]:visible}}));
 };
 const moveSection=(id:HomeSectionId,direction:-1|1)=>{
  setDraft(previous=>{
   const next=[...previous.sectionOrder],index=next.indexOf(id);
   const target=index+direction;
   if(index<0||target<0||target>=next.length)return previous;
   [next[index],next[target]]=[next[target],next[index]];
   return {...previous,sectionOrder:next};
  });
 };
 if(!open)return null;
 return createPortal(<div className="home-calendar-customize-backdrop"
  onPointerDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
  <div ref={ref} role="dialog" aria-modal="true" aria-label="Customize Home calendar"
   className="home-calendar-customize-sheet">
   <header>
    <div><small>HOME · PERSONALIZE</small><h2>Calendar badges</h2>
     <p>Choose up to four things to track and give each badge a color. Pending work stays separate from logged history.</p></div>
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
     <label><input type="checkbox" checked={draft.clickableMobileBadges}
       onChange={event=>setDraft(previous=>({...previous,clickableMobileBadges:event.target.checked}))}/>
      <span><strong>Clickable badges on mobile</strong>
       <small>Off by default. When off, tapping a badge only selects its day. Desktop badge drilldowns remain enabled.</small></span>
     </label>
     <div className="home-calendar-default-view">
      <label htmlFor="home-calendar-default-view">Default calendar view</label>
      <select id="home-calendar-default-view" value={draft.defaultCalendarView}
       onChange={event=>setDraft(previous=>({...previous,
        defaultCalendarView:event.target.value as HomeCalendarSettings['defaultCalendarView']}))}>
       <option value="auto">Automatic (7 days on mobile, month on desktop)</option>
       <option value="week">7-day focus</option><option value="month">Month</option>
      </select>
     </div>
    </div>
    <section className="home-calendar-customize-layout" aria-label="Home layout options">
     <h3>Home layout</h3>
     <p>Choose which sections appear and move them up or down. The dated On this day navigator and Recent work share one section.</p>
     {draft.sectionOrder.map((id,index)=>{
      const labels:Record<HomeSectionId,string>={
       quickActions:'Quick actions',calendar:'Calendar & agenda',recent:'On this day / Recent work'};
      return <div className="home-calendar-section-row" key={id}>
       <label><input type="checkbox" checked={draft.visibleSections[id]}
         disabled={draft.visibleSections[id]&&HOME_SECTION_IDS.filter(section=>draft.visibleSections[section]).length===1}
         onChange={event=>changeSection(id,event.target.checked)}/>
        <span>{labels[id]}</span></label>
       <div className="home-calendar-section-move" role="group" aria-label={'Reorder '+labels[id]}>
        <button type="button" aria-label={'Move '+labels[id]+' up'} disabled={index===0}
         onClick={()=>moveSection(id,-1)}>↑</button>
        <button type="button" aria-label={'Move '+labels[id]+' down'}
         disabled={index===draft.sectionOrder.length-1}
         onClick={()=>moveSection(id,1)}>↓</button>
       </div>
      </div>;
     })}
    </section>
    <div className="home-calendar-customize-preview"><strong>Legend preview</strong>
     <CalendarBadgeLegend settings={draft} showEmpty/></div>
    <p className="home-calendar-customize-note">Calls, emails, texts and meetings use logged interactions. Company and person creation badges show workspace records. Quotes sent include external bids recorded in SalesShop. Settings sync to your signed-in account when online.</p>
    {syncNotice&&<p role="status" className="home-calendar-sync-notice">{syncNotice}</p>}
   </div>
   <footer>
    <button type="button" disabled={saving}
      onClick={()=>setDraft({...DEFAULT_HOME_CALENDAR_SETTINGS,
       slots:DEFAULT_HOME_CALENDAR_SETTINGS.slots.map(slot=>({...slot})) as HomeCalendarSettings['slots'],
       visibleSections:{...DEFAULT_HOME_CALENDAR_SETTINGS.visibleSections},
       sectionOrder:[...DEFAULT_HOME_CALENDAR_SETTINGS.sectionOrder]})}>Reset</button>
    <span/>
    <button type="button" disabled={saving} onClick={()=>setOpen(false)}>Cancel</button>
    <button type="button" disabled={saving} className="is-primary" onClick={()=>{void save();}}>
      {saving?'Saving…':'Save Home settings'}
    </button>
   </footer>
  </div>
 </div>,document.body);
}
