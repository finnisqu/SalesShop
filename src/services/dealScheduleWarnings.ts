import type {DealScheduleDraft,DealScheduleRow} from './dealScheduleTemplates';

export interface DealScheduleWarning {
  id:string;
  rowId:string;
  kind:'overdue'|'sequence';
  label:string;
  detail:string;
}
const datePattern=/^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date, not UTC, so the overdue threshold respects the user's day. */
export function localTimelineDay(now:Date=new Date()):string{
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),
    String(now.getDate()).padStart(2,'0')].join('-');
}

/**
 * Advisory-only issues. A warning never moves a date, changes Deal stage or
 * creates a Task. Missing planned dates are allowed and never inferred.
 */
export function dealScheduleWarnings(
  schedule:DealScheduleDraft,today:string=localTimelineDay(),
):DealScheduleWarning[]{
  const rowsById=new Map(schedule.rows.map(row=>[row.id,row]));
  const warnings:DealScheduleWarning[]=[];
  for(const row of schedule.rows){
    if(row.kind==='group')continue;
    if(row.status==='complete')continue;
    if(row.plannedFinish&&datePattern.test(row.plannedFinish)&&row.plannedFinish<today){
      warnings.push({id:'overdue:'+row.id,rowId:row.id,kind:'overdue',label:row.label,
        detail:'Planned finish '+row.plannedFinish+' has passed; milestone is not marked complete.'});
    }
    if(!row.plannedStart||!datePattern.test(row.plannedStart))continue;
    const conflictingPredecessors:DealScheduleRow[]=[];
    for(const id of row.predecessorIds){
      const predecessor=rowsById.get(id);
      if(!predecessor)continue;
      const finish=predecessor.status==='complete'
        ?predecessor.actualFinish??predecessor.plannedFinish
        :predecessor.plannedFinish;
      if(finish&&datePattern.test(finish)&&finish>row.plannedStart){
        conflictingPredecessors.push(predecessor);
      }
    }
    if(conflictingPredecessors.length){
      warnings.push({
        id:'sequence:'+row.id,rowId:row.id,kind:'sequence',label:row.label,
        detail:'Planned to begin '+row.plannedStart+' before '+conflictingPredecessors
          .map(item=>item.label).join(', ')+' finishes. Confirm this overlap is intentional.',
      });
    }
  }
  return warnings.sort((a,b)=>
    (a.kind==='overdue'?-1:1)-(b.kind==='overdue'?-1:1)||
    a.label.localeCompare(b.label)||a.id.localeCompare(b.id));
}
