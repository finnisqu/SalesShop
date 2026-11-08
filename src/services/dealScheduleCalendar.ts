import type {Project} from '../types/crm';
import type {DealScheduleDraft,DealScheduleRow} from './dealScheduleTemplates';

export interface DealScheduleCalendarMilestone{
  id:string;dealId:string;rowId:string;date:string;title:string;detail:string;
  status:DealScheduleRow['status'];actual:boolean;
}
const DAY=/^\d{4}-\d{2}-\d{2}$/;
/**
 * A dated phase is not automatically a Personal Task.
 * This projection belongs under "On this day" in Home, never in the pending
 * Task/Bid agenda or its existing badge counters.
 */
export function dealScheduleCalendarMilestones(
  schedules:Readonly<Record<string,DealScheduleDraft>>,
  visibleDeals:readonly Project[],
):DealScheduleCalendarMilestone[]{
  const output:DealScheduleCalendarMilestone[]=[];
  for(const deal of visibleDeals){
    const schedule=schedules[deal.id];
    if(!schedule||schedule.dealId!==deal.id)continue;
    const byId=new Map(schedule.rows.map(row=>[row.id,row]));
    for(const row of schedule.rows){
      if(row.kind==='group')continue;
      const actual=!!(row.status==='complete'&&row.actualFinish&&DAY.test(row.actualFinish));
      const date=actual?row.actualFinish:row.plannedFinish??row.plannedStart;
      if(!date||!DAY.test(date))continue;
      const parent=row.parentId?byId.get(row.parentId):undefined;
      output.push({
        id:'deal-schedule:'+deal.id+':'+row.id,
        dealId:deal.id,rowId:row.id,date,
        title:row.label,detail:deal.name+(parent?' · '+parent.label:''),
        status:row.status,actual,
      });
    }
  }
  return output.sort((a,b)=>a.date.localeCompare(b.date)||
    a.detail.localeCompare(b.detail)||a.title.localeCompare(b.title));
}

/** One personally actionable reminder per milestone, only when requested. */
export function milestoneFollowupFields(deal:Project,row:DealScheduleRow){
  return {
    title:'Follow up · '+row.label+' · '+deal.name,
    dueDate:row.plannedFinish??row.plannedStart,
    sourceObjectId:'deal-schedule:'+deal.id+':'+row.id,
    linked:{type:'project' as const,id:deal.id},
    associations:[{type:'project' as const,id:deal.id,label:'Deal · '+deal.name}],
    notes:'Project timeline milestone: '+row.label+'. Review the Deal timeline before marking this task complete.',
    type:'follow-up' as const,
    status:'open' as const,
  };
}
