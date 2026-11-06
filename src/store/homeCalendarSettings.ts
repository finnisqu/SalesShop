import {useSyncExternalStore} from 'react';

export const CALENDAR_BADGE_OPTIONS=[
 {id:'none',label:'None (hide slot)'},
 {id:'tasks',label:'Tasks due'},
 {id:'due-dates',label:'All deadlines / due dates'},
 {id:'bid-due',label:'Bids due'},
 {id:'calls',label:'Calls logged'},
 {id:'emails',label:'Emails logged'},
 {id:'texts',label:'Texts logged'},
 {id:'meetings',label:'Meetings logged'},
 {id:'activities',label:'Total logged activities'},
 {id:'quotes-sent',label:'Quotes sent'},
 {id:'companies-created',label:'Customer / prospect companies created'},
 {id:'people-created',label:'Customer / prospect people created'},
] as const;
export type CalendarBadgeMetric=(typeof CALENDAR_BADGE_OPTIONS)[number]['id'];
export const CALENDAR_BADGE_COLORS=[
 {id:'blue',name:'Blue',hex:'#477eaf'},
 {id:'orange',name:'Orange',hex:'#b97741'},
 {id:'teal',name:'Teal',hex:'#328777'},
 {id:'purple',name:'Purple',hex:'#8664b4'},
 {id:'red',name:'Red',hex:'#bc5861'},
 {id:'green',name:'Green',hex:'#598a4d'},
 {id:'gold',name:'Gold',hex:'#a68536'},
 {id:'slate',name:'Slate',hex:'#637484'},
] as const;
export type CalendarBadgeColor=(typeof CALENDAR_BADGE_COLORS)[number]['id'];
export type CalendarBadgeSlot={metric:CalendarBadgeMetric;color:CalendarBadgeColor};
export interface HomeCalendarSettings{
 slots:[CalendarBadgeSlot,CalendarBadgeSlot,CalendarBadgeSlot,CalendarBadgeSlot];
 countDownCompletedTasks:boolean;
 showUrgentBadge:boolean;
}
export const DEFAULT_HOME_CALENDAR_SETTINGS:HomeCalendarSettings={
 slots:[
  {metric:'tasks',color:'blue'},
  {metric:'bid-due',color:'orange'},
  {metric:'activities',color:'teal'},
  {metric:'quotes-sent',color:'purple'},
 ],
 countDownCompletedTasks:true,
 showUrgentBadge:true,
};
const prefix='salesshop-home-calendar-badges-v1:';
const cache=new Map<string,HomeCalendarSettings>();
const listeners=new Set<()=>void>();
const metricIds=new Set<string>(CALENDAR_BADGE_OPTIONS.map(option=>option.id));
const colorIds=new Set<string>(CALENDAR_BADGE_COLORS.map(color=>color.id));
const cloneDefaults=():HomeCalendarSettings=>({
 slots:DEFAULT_HOME_CALENDAR_SETTINGS.slots.map(slot=>({...slot})) as HomeCalendarSettings['slots'],
 countDownCompletedTasks:true,showUrgentBadge:true,
});
export function homeCalendarScope(mode:'local'|'cloud',org?:string|null,userId?:string|null){
 return mode==='local'?'local':org&&userId?'cloud:'+org+':'+userId:'signed-out';
}
function parseSettings(value:unknown):HomeCalendarSettings{
 const settings=cloneDefaults();
 if(!value||typeof value!=='object')return settings;
 const obj=value as Record<string,unknown>;
 const seen=new Set<string>();
 if(Array.isArray(obj.slots))settings.slots=settings.slots.map((fallback,index)=>{
  const slot=obj.slots[index];
  if(!slot||typeof slot!=='object')return fallback;
  const input=slot as Record<string,unknown>;
  const metric=typeof input.metric==='string'&&metricIds.has(input.metric)&&
   (input.metric==='none'||!seen.has(input.metric))
   ?input.metric as CalendarBadgeMetric:'none';
  if(metric!=='none')seen.add(metric);
  return {metric,color:typeof input.color==='string'&&colorIds.has(input.color)
   ?input.color as CalendarBadgeColor:fallback.color};
 }) as HomeCalendarSettings['slots'];
 if(typeof obj.countDownCompletedTasks==='boolean')settings.countDownCompletedTasks=obj.countDownCompletedTasks;
 if(typeof obj.showUrgentBadge==='boolean')settings.showUrgentBadge=obj.showUrgentBadge;
 return settings;
}
export function readHomeCalendarSettings(scope:string):HomeCalendarSettings{
 const cached=cache.get(scope);
 if(cached)return cached;
 let settings=cloneDefaults();
 try{
  const raw=localStorage.getItem(prefix+scope);
  if(raw)settings=parseSettings(JSON.parse(raw));
 }catch{/* private browsing: use safe defaults */}
 cache.set(scope,settings);
 return settings;
}
export function saveHomeCalendarSettings(scope:string,settings:HomeCalendarSettings){
 const safe=parseSettings(settings);
 cache.set(scope,safe);
 try{localStorage.setItem(prefix+scope,JSON.stringify(safe));}
 catch{/* still works for this session */}
 listeners.forEach(listener=>listener());
}
function subscribe(listener:()=>void){
 listeners.add(listener);
 return()=>{listeners.delete(listener);};
}
export function useHomeCalendarSettings(scope:string){
 return useSyncExternalStore(subscribe,()=>readHomeCalendarSettings(scope),()=>DEFAULT_HOME_CALENDAR_SETTINGS);
}
export function badgeLabel(metric:CalendarBadgeMetric){
 return CALENDAR_BADGE_OPTIONS.find(option=>option.id===metric)?.label??'';
}
export function badgeColor(color:CalendarBadgeColor){
 return CALENDAR_BADGE_COLORS.find(option=>option.id===color)?.hex??'#637484';
}
