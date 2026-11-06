import type {SalesCalendarKind} from './salesCalendar';
import {CALENDAR_BADGE_COLORS,badgeColor,type CalendarBadgeColor,
 type CalendarBadgeMetric,type HomeCalendarSettings} from '../store/homeCalendarSettings';

/** Make the pending-work agenda agree with customizable calendar badges.
 * Direct category badges win, then the combined deadline badge; untracked
 * categories retain recognizable defaults unless another metric owns them. */
export function homeAgendaDotColors(settings:HomeCalendarSettings):Record<SalesCalendarKind,string>{
 const active=settings.slots.filter(slot=>slot.metric!=='none');
 const selected=(metrics:readonly CalendarBadgeMetric[])=>{
  for(const metric of metrics){
   const chosen=active.find(slot=>slot.metric===metric);
   if(chosen)return chosen.color;
  }
  return null;
 };
 const taskSelected=selected(['tasks','due-dates']);
 const bidSelected=selected(['bid-due','due-dates']);
 const reserved=new Set<CalendarBadgeColor>(active.map(slot=>slot.color));
 const chooseFallback=(order:readonly CalendarBadgeColor[],avoid:CalendarBadgeColor|null)=>{
  const available=order.find(color=>!reserved.has(color)&&color!==avoid);
  return available??order.find(color=>color!==avoid)??order[0];
 };
 const task=taskSelected??chooseFallback(
  ['blue','teal','purple','green','gold','slate','red','orange'],bidSelected);
 const bid=bidSelected??chooseFallback(
  ['orange','gold','red','slate','purple','green','teal','blue'],task);
 return {task:badgeColor(task),bid:badgeColor(bid)};
}
