import {useEffect,useSyncExternalStore} from 'react';
import {supabase} from '../lib/supabase';
import {useAuthStore} from './authStore';

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
export const HOME_SECTION_IDS=['quickActions','calendar','recent'] as const;
export type HomeSectionId=(typeof HOME_SECTION_IDS)[number];
export type HomeCalendarDefaultView='auto'|'week'|'month';
export interface HomeCalendarSettings{
 clickableMobileBadges:boolean;
 defaultCalendarView:HomeCalendarDefaultView;
 visibleSections:Record<HomeSectionId,boolean>;
 sectionOrder:HomeSectionId[];
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
 clickableMobileBadges:false,
 defaultCalendarView:'auto',
 visibleSections:{quickActions:true,calendar:true,recent:true},
 sectionOrder:[...HOME_SECTION_IDS],
};
const prefix='salesshop-home-calendar-badges-v1:';
const stampPrefix='salesshop-home-calendar-updated-v1:';
const cloudMetadataKey='salesshop_home_preferences_v2';
type CloudValue={settings:unknown;updatedAt:number};
const inflight=new Map<string,Promise<'saved'|'loaded'|'local-only'|'error'>>();
const cache=new Map<string,HomeCalendarSettings>();
const listeners=new Set<()=>void>();
const metricIds=new Set<string>(CALENDAR_BADGE_OPTIONS.map(option=>option.id));
const colorIds=new Set<string>(CALENDAR_BADGE_COLORS.map(color=>color.id));
const cloneDefaults=():HomeCalendarSettings=>({
 slots:DEFAULT_HOME_CALENDAR_SETTINGS.slots.map(slot=>({...slot})) as HomeCalendarSettings['slots'],
 countDownCompletedTasks:true,showUrgentBadge:true,
 clickableMobileBadges:false,defaultCalendarView:'auto',
 visibleSections:{...DEFAULT_HOME_CALENDAR_SETTINGS.visibleSections},
 sectionOrder:[...HOME_SECTION_IDS],
});
export function homeCalendarScope(mode:'local'|'cloud',org?:string|null,userId?:string|null){
 return mode==='local'?'local':org&&userId?'cloud:'+org+':'+userId:'signed-out';
}
function parseSettings(value:unknown):HomeCalendarSettings{
 const settings=cloneDefaults();
 if(!value||typeof value!=='object')return settings;
 const obj=value as Record<string,unknown>;
 const seen=new Set<string>();
 const savedSlots=obj.slots;
 if(Array.isArray(savedSlots))settings.slots=settings.slots.map((fallback,index)=>{
  const slot=savedSlots[index];
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
 if(typeof obj.clickableMobileBadges==='boolean')settings.clickableMobileBadges=obj.clickableMobileBadges;
 if(obj.defaultCalendarView==='week'||obj.defaultCalendarView==='month'||obj.defaultCalendarView==='auto')
  settings.defaultCalendarView=obj.defaultCalendarView;
 if(obj.visibleSections&&typeof obj.visibleSections==='object'){
  const visible=obj.visibleSections as Record<string,unknown>;
  for(const key of HOME_SECTION_IDS)if(typeof visible[key]==='boolean')settings.visibleSections[key]=visible[key];
 }
 if(Array.isArray(obj.sectionOrder)){
  const order=obj.sectionOrder.filter((id):id is HomeSectionId=>
   typeof id==='string'&&HOME_SECTION_IDS.some(valid=>valid===id));
  settings.sectionOrder=[...new Set([...order,...HOME_SECTION_IDS])];
 }
 // The screen must never become completely blank.
 if(!HOME_SECTION_IDS.some(key=>settings.visibleSections[key]))settings.visibleSections.calendar=true;
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
function writeLocal(scope:string,settings:HomeCalendarSettings,stamp:number){
 cache.set(scope,settings);
 try{
  localStorage.setItem(prefix+scope,JSON.stringify(settings));
  localStorage.setItem(stampPrefix+scope,String(stamp));
 }catch{/* still works for this session */}
 listeners.forEach(listener=>listener());
}
export function saveHomeCalendarSettings(scope:string,settings:HomeCalendarSettings){
 writeLocal(scope,parseSettings(settings),Date.now());
}
function localStamp(scope:string){
 try{return Number(localStorage.getItem(stampPrefix+scope))||0;}catch{return 0;}
}
function scopeCloudParts(scope:string){
 const parts=scope.split(':');
 return parts.length===3&&parts[0]==='cloud'&&parts[1]&&parts[2]
  ?{orgId:parts[1],userId:parts[2]}:null;
}
/** Sync only the signed-in user's own settings, never organization-wide CRM data.
 * Supabase Auth metadata needs no schema migration. It is merged by organization,
 * with timestamps to avoid overwriting a newer change from another device. */
export async function syncHomeCalendarSettings(scope:string):Promise<'saved'|'loaded'|'local-only'|'error'>{
 const context=scopeCloudParts(scope);
 if(!context||!supabase)return 'local-only';
 const current=useAuthStore.getState();
 if(current.mode!=='cloud'||current.organizationId!==context.orgId||
    current.user?.id!==context.userId)return 'local-only';
 const running=inflight.get(scope);
 if(running)return running;
 const job=(async():Promise<'saved'|'loaded'|'local-only'|'error'>=>{
  try{
   const {data,error}=await supabase.auth.getUser();
   if(error||!data.user||data.user.id!==context.userId)return 'error';
   const remoteAll=data.user.user_metadata?.[cloudMetadataKey] as Record<string,CloudValue>|undefined;
   const remote=remoteAll&&typeof remoteAll==='object'?remoteAll[context.orgId]:undefined;
   const remoteStamp=Number(remote?.updatedAt)||0;
   const localUpdated=localStamp(scope);
   if(remote&&remoteStamp>0&&remoteStamp>=localUpdated){
    // Do not regress a user's newer in-flight local change.
    if(localStamp(scope)>remoteStamp)return 'local-only';
    writeLocal(scope,parseSettings(remote.settings),remoteStamp);
    return 'loaded';
   }
   const hasLocalSave=localUpdated>0||(()=>{
    try{return Boolean(localStorage.getItem(prefix+scope));}catch{return false;}
   })();
   if(!hasLocalSave)return 'local-only';
   const stamp=Math.max(Date.now(),localUpdated,remoteStamp+1);
   const merged={...(remoteAll&&typeof remoteAll==='object'?remoteAll:{}),
    [context.orgId]:{settings:readHomeCalendarSettings(scope),updatedAt:stamp}};
   // Guard against identity changes while awaiting the network.
   const active=useAuthStore.getState();
   if(active.user?.id!==context.userId||active.organizationId!==context.orgId)return 'local-only';
   const {error:writeError}=await supabase.auth.updateUser({
    data:{[cloudMetadataKey]:merged},
   });
   if(writeError)return 'error';
   // Never overwrite a newer local edit made during the upload.
   if(localStamp(scope)<=localUpdated)writeLocal(scope,readHomeCalendarSettings(scope),stamp);
   return 'saved';
  }catch{return 'error';}
 })();
 inflight.set(scope,job);
 try{return await job;}finally{inflight.delete(scope);}
}
export async function saveHomeCalendarSettingsWithSync(scope:string,settings:HomeCalendarSettings){
 saveHomeCalendarSettings(scope,settings);
 // A load triggered on Home mount may already be running. Finish it first,
 // then always upload this newly saved preference snapshot.
 const running=inflight.get(scope);
 if(running)await running;
 return syncHomeCalendarSettings(scope);
}
function subscribe(listener:()=>void){
 listeners.add(listener);
 return()=>{listeners.delete(listener);};
}
export function useHomeCalendarSettings(scope:string){
 useEffect(()=>{
  if(typeof window==='undefined')return;
  const changed=(event:StorageEvent)=>{
   if(event.key===prefix+scope||event.key===stampPrefix+scope){
    cache.delete(scope);listeners.forEach(listener=>listener());
   }
  };
  window.addEventListener('storage',changed);
  return()=>window.removeEventListener('storage',changed);
 },[scope]);
 return useSyncExternalStore(subscribe,()=>readHomeCalendarSettings(scope),()=>DEFAULT_HOME_CALENDAR_SETTINGS);
}
export function badgeLabel(metric:CalendarBadgeMetric){
 return CALENDAR_BADGE_OPTIONS.find(option=>option.id===metric)?.label??'';
}
export function badgeColor(color:CalendarBadgeColor){
 return CALENDAR_BADGE_COLORS.find(option=>option.id===color)?.hex??'#637484';
}
