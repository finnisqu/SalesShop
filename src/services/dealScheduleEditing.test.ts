import {describe,expect,it} from 'vitest';
import {createMultifamilyStarterSchedule,validateDealScheduleRows} from './dealScheduleTemplates';
import {
  appendSchedulePhase,assignBuildingImports,assertValidSchedule,removeSchedulePhase,
  scheduleDateIssues,scheduleProgress,updateScheduleRow,
} from './dealScheduleEditing';

describe('editable multifamily Deal execution schedule',()=>{
  it('adds independent import phases without changing the existing batches',()=>{
    const original=createMultifamilyStarterSchedule({dealId:'deal-42'});
    const extended=appendSchedulePhase(original,'import');
    const groups=extended.rows.filter(row=>row.scope==='import'&&row.kind==='group');
    expect(groups).toHaveLength(3);
    expect(groups.map(row=>row.id).filter(id=>id==='import-1')).toEqual(['import-1']);
    const next=groups[2].id;
    expect(extended.rows.find(row=>row.id===next+'-on-water')?.predecessorIds)
      .toEqual([next+'-production']);
    expect(validateDealScheduleRows(extended.rows)).toEqual([]);
    expect(original.rows.filter(row=>row.scope==='import'&&row.kind==='group')).toHaveLength(2);
  });

  it('adds a building and updates project closeout dependencies',()=>{
    const initial=createMultifamilyStarterSchedule();
    const extended=appendSchedulePhase(initial,'building');
    const third=extended.rows.filter(row=>row.scope==='building'&&row.kind==='group')[2];
    expect(extended.rows.find(row=>row.id==='all-buildings-complete')?.predecessorIds)
      .toContain(third.id+'-punch');
    expect(extended.rows.find(row=>row.id==='final-billing')?.predecessorIds)
      .toContain(third.id+'-invoice');
    expect(validateDealScheduleRows(extended.rows)).toEqual([]);
  });

  it('assigns several imports to one building without inventing assignments for others',()=>{
    const initial=createMultifamilyStarterSchedule();
    const linked=assignBuildingImports(initial,'building-1',['import-1','import-2','import-2','not-a-batch']);
    expect(linked.rows.find(row=>row.id==='building-1')?.sourceImportIds)
      .toEqual(['import-1','import-2']);
    expect(linked.rows.find(row=>row.id==='building-1-delivery')?.predecessorIds)
      .toEqual(['building-1-site-ready','import-1-site','import-2-site']);
    expect(linked.rows.find(row=>row.id==='building-2')?.sourceImportIds).toEqual([]);
    expect(validateDealScheduleRows(linked.rows)).toEqual([]);
  });

  it('removes a batch safely and cleans building delivery references',()=>{
    const initial=assignBuildingImports(createMultifamilyStarterSchedule(),
      'building-1',['import-1','import-2']);
    const removed=removeSchedulePhase(initial,'import-1');
    expect(removed.rows.some(row=>row.id==='import-1'||row.id.startsWith('import-1-'))).toBe(false);
    expect(removed.rows.find(row=>row.id==='building-1')?.sourceImportIds)
      .toEqual(['import-2']);
    expect(removed.rows.find(row=>row.id==='building-1-delivery')?.predecessorIds)
      .toEqual(['building-1-site-ready','import-2-site']);
    expect(validateDealScheduleRows(removed.rows)).toEqual([]);
  });

  it('removes a building without leaving closeout dependent on it',()=>{
    const initial=createMultifamilyStarterSchedule();
    const removed=removeSchedulePhase(initial,'building-2');
    expect(removed.rows.find(row=>row.id==='all-buildings-complete')?.predecessorIds)
      .toEqual(['building-1-punch']);
    expect(removed.rows.find(row=>row.id==='final-billing')?.predecessorIds)
      .toEqual(['building-1-invoice']);
    expect(validateDealScheduleRows(removed.rows)).toEqual([]);
  });

  it('edits planned and actual dates without silently inventing the others',()=>{
    const original=createMultifamilyStarterSchedule();
    const updated=updateScheduleRow(original,'import-1-on-water',{
      plannedStart:'2026-12-01',plannedFinish:'2026-12-19',status:'in-progress',
    });
    const row=updated.rows.find(item=>item.id==='import-1-on-water');
    expect(row?.plannedStart).toBe('2026-12-01');
    expect(row?.plannedFinish).toBe('2026-12-19');
    expect(row?.actualStart).toBeUndefined();
    expect(row?.actualFinish).toBeUndefined();
    expect(original.rows.find(item=>item.id==='import-1-on-water')?.plannedStart).toBeUndefined();
    expect(scheduleDateIssues(updated.rows)).toEqual([]);
    expect(()=>assertValidSchedule(updated)).not.toThrow();
  });

  it('rejects reversed date ranges rather than silently moving commitments',()=>{
    const original=createMultifamilyStarterSchedule();
    const invalid=updateScheduleRow(original,'building-1-install',{
      plannedStart:'2027-03-20',plannedFinish:'2027-03-01',
    });
    expect(scheduleDateIssues(invalid.rows)).toHaveLength(1);
    expect(()=>assertValidSchedule(invalid)).toThrow('planned finish precedes start');
  });

  it('counts progress on executable tasks, not roll-up group rows',()=>{
    const original=createMultifamilyStarterSchedule();
    const updated=updateScheduleRow(original,'deposit-received',{status:'complete'});
    expect(scheduleProgress(updated).done).toBe(1);
    expect(scheduleProgress(updated).total).toBe(updated.rows.filter(row=>row.kind!=='group').length);
    expect(scheduleProgress(updated).percent).toBeGreaterThan(0);
  });
});
