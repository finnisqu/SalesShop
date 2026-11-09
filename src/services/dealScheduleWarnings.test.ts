import {describe,expect,it} from 'vitest';
import {createMultifamilyStarterSchedule} from './dealScheduleTemplates';
import {updateScheduleRow,assertValidSchedule} from './dealScheduleEditing';
import {dealScheduleWarnings} from './dealScheduleWarnings';

describe('multifamily schedule warnings',()=>{
  it('does not invent delivery or payment dates for an undated starter',()=>{
    const schedule=createMultifamilyStarterSchedule({dealId:'deal-1'});
    expect(dealScheduleWarnings(schedule,'2027-02-01')).toEqual([]);
  });

  it('warns on a missed shop drawing approval, but not a completed approval',()=>{
    let schedule=createMultifamilyStarterSchedule();
    schedule=updateScheduleRow(schedule,'shop-drawings-approved',{plannedFinish:'2027-01-03'});
    expect(dealScheduleWarnings(schedule,'2027-01-04').filter(w=>w.kind==='overdue'))
      .toMatchObject([{rowId:'shop-drawings-approved'}]);
    schedule=updateScheduleRow(schedule,'shop-drawings-approved',{status:'complete'});
    expect(dealScheduleWarnings(schedule,'2027-01-04').filter(w=>w.kind==='overdue')).toEqual([]);
  });

  it('warns when building installation precedes the scheduled material delivery',()=>{
    let schedule=createMultifamilyStarterSchedule();
    schedule=updateScheduleRow(schedule,'building-1-delivery',{plannedFinish:'2027-03-05'});
    schedule=updateScheduleRow(schedule,'building-1-install',{
      plannedStart:'2027-03-03',plannedFinish:'2027-03-15',
    });
    const warnings=dealScheduleWarnings(schedule,'2027-02-01');
    expect(warnings.some(w=>w.kind==='sequence'&&w.rowId==='building-1-install')).toBe(true);
    expect(warnings.some(w=>w.kind==='overdue')).toBe(false);
  });

  it('uses an actual completed date instead of an outdated predecessor plan',()=>{
    let schedule=createMultifamilyStarterSchedule();
    schedule=updateScheduleRow(schedule,'import-1-production',{
      plannedFinish:'2027-03-15',actualFinish:'2027-03-03',status:'complete',
    });
    schedule=updateScheduleRow(schedule,'import-1-on-water',{plannedStart:'2027-03-05'});
    expect(dealScheduleWarnings(schedule,'2027-03-01').some(
      w=>w.rowId==='import-1-on-water'&&w.kind==='sequence')).toBe(false);
  });

  it('keeps planned overlaps advisory and never silently moves dates',()=>{
    let schedule=createMultifamilyStarterSchedule();
    schedule=updateScheduleRow(schedule,'import-2-production',{plannedFinish:'2027-04-15'});
    schedule=updateScheduleRow(schedule,'import-2-on-water',{plannedStart:'2027-04-10'});
    expect(dealScheduleWarnings(schedule,'2027-04-01')).toHaveLength(1);
    expect(schedule.rows.find(row=>row.id==='import-2-on-water')?.plannedStart).toBe('2027-04-10');
    expect(()=>assertValidSchedule(schedule)).not.toThrow();
  });

  it('validates impossible real dates, negative invoice amounts and retainage',()=>{
    const original=createMultifamilyStarterSchedule();
    const impossible=updateScheduleRow(original,'import-1-site',{plannedFinish:'2027-02-30'});
    const invalidAmount=updateScheduleRow(original,'building-1-invoice',{amount:-1});
    const invalidRetainage=updateScheduleRow(original,'retainage-request',{retainagePercent:110});
    expect(()=>assertValidSchedule(impossible)).toThrow('invalid calendar date');
    expect(()=>assertValidSchedule(invalidAmount)).toThrow('amount must be nonnegative');
    expect(()=>assertValidSchedule(invalidRetainage)).toThrow('invalid retainage');
  });

  it('keeps PO/invoice references and notes associated with the original phase',()=>{
    const initial=createMultifamilyStarterSchedule();
    const withInvoice=updateScheduleRow(initial,'building-2-invoice',{
      reference:' INV-2205 ',notes:' 2nd building progress invoice ',amount:12000,
    });
    expect(withInvoice.rows.find(row=>row.id==='building-2-invoice')).toMatchObject({
      reference:'INV-2205',notes:'2nd building progress invoice',amount:12000,
    });
    expect(initial.rows.find(row=>row.id==='building-2-invoice')?.reference).toBeUndefined();
    expect(()=>assertValidSchedule(withInvoice)).not.toThrow();
  });
});
