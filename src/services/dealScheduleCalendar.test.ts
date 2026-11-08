import {describe,expect,it} from 'vitest';
import type {Project} from '../types/crm';
import {createMultifamilyStarterSchedule} from './dealScheduleTemplates';
import {updateScheduleRow} from './dealScheduleEditing';
import {dealScheduleCalendarMilestones,milestoneFollowupFields} from './dealScheduleCalendar';

const deal:Project={
  id:'deal-a',name:'Westfield Apartments',stage:'Closed Won',pipeline:'multifamily',
  createdAt:'2026-10-01T12:00:00Z',updatedAt:'2026-10-01T12:00:00Z',
};
describe('execution milestone calendar projection',()=>{
  it('does not add group rows or undated tasks to the calendar',()=>{
    const schedule=createMultifamilyStarterSchedule({dealId:deal.id});
    expect(dealScheduleCalendarMilestones({[deal.id]:schedule},[deal])).toEqual([]);
  });
  it('shows project, building and phase without creating personal tasks',()=>{
    let schedule=createMultifamilyStarterSchedule({dealId:deal.id});
    schedule=updateScheduleRow(schedule,'building-1-install',{
      plannedStart:'2027-02-10',plannedFinish:'2027-02-21',
    });
    schedule=updateScheduleRow(schedule,'import-2-site',{plannedFinish:'2027-02-08'});
    const items=dealScheduleCalendarMilestones({[deal.id]:schedule},[deal]);
    expect(items).toHaveLength(2);
    expect(items.find(item=>item.rowId==='building-1-install')).toMatchObject({
      date:'2027-02-21',actual:false,detail:'Westfield Apartments · Building 1',
    });
    expect(items.find(item=>item.rowId==='import-2-site')?.date).toBe('2027-02-08');
  });
  it('moves completed milestone history to its actual finish',()=>{
    let schedule=createMultifamilyStarterSchedule({dealId:deal.id});
    schedule=updateScheduleRow(schedule,'building-2-invoice',{
      status:'complete',plannedFinish:'2027-03-01',actualFinish:'2027-03-04',
    });
    const [entry]=dealScheduleCalendarMilestones({[deal.id]:schedule},[deal]);
    expect(entry.date).toBe('2027-03-04');
    expect(entry.actual).toBe(true);
  });
  it('keeps schedules isolated to the Deals supplied by calendar permissions',()=>{
    const schedule=createMultifamilyStarterSchedule({dealId:deal.id});
    const dated=updateScheduleRow(schedule,'deposit-received',{plannedFinish:'2026-11-21'});
    expect(dealScheduleCalendarMilestones({[deal.id]:dated},[])).toEqual([]);
    expect(dealScheduleCalendarMilestones({[deal.id]:dated},[{...deal,id:'different'}])).toEqual([]);
  });
  it('creates an opt-in personal follow-up with stable source identity',()=>{
    const row=createMultifamilyStarterSchedule().rows.find(row=>row.id==='building-1-install')!;
    const task=milestoneFollowupFields(deal,{...row,plannedFinish:'2027-02-21'});
    expect(task.sourceObjectId).toBe('deal-schedule:deal-a:building-1-install');
    expect(task.dueDate).toBe('2027-02-21');
    expect(task.linked).toEqual({type:'project',id:deal.id});
    expect(task.type).toBe('follow-up');
  });
});
