import {describe,expect,it} from 'vitest';
import {createMultifamilyStarterSchedule,validateDealScheduleRows} from './dealScheduleTemplates';

describe('multifamily deal Gantt starter',()=>{
  it('includes project-level drawings, deposit and final retainage',()=>{
    const draft=createMultifamilyStarterSchedule({dealId:'deal-1'});
    const labels=draft.rows.map(row=>row.label);
    expect(draft.dealId).toBe('deal-1');
    expect(labels).toContain('Shop drawings submitted');
    expect(labels).toContain('Shop drawings approved');
    expect(labels).toContain('Deposit invoiced');
    expect(labels).toContain('Deposit received');
    expect(labels).toContain('Retainage invoice / release request');
    expect(labels).toContain('Retainage received');
    expect(validateDealScheduleRows(draft.rows)).toEqual([]);
  });

  it('creates independent production, water transit and site delivery for phased imports',()=>{
    const draft=createMultifamilyStarterSchedule({importNames:['Containers A','Containers B','Containers C'],buildingNames:['Bldg 1']});
    expect(draft.rows.filter(row=>row.label==='On water / ocean transit')).toHaveLength(3);
    expect(draft.rows.filter(row=>row.label==='Production')).toHaveLength(3);
    expect(draft.rows.filter(row=>row.label==='Delivery to site')).toHaveLength(3);
    expect(draft.rows.find(row=>row.id==='import-2-on-water')?.predecessorIds).toEqual(['import-2-production']);
    expect(draft.rows.find(row=>row.id==='import-3-on-water')?.predecessorIds).toEqual(['import-3-production']);
    expect(validateDealScheduleRows(draft.rows)).toEqual([]);
  });

  it('tracks install, invoicing and payment separately for each building',()=>{
    const draft=createMultifamilyStarterSchedule({importNames:['Lot 1'],buildingNames:['A','B','C']});
    expect(draft.rows.filter(row=>row.label==='Installation')).toHaveLength(3);
    expect(draft.rows.filter(row=>row.label==='Progress invoice submitted')).toHaveLength(3);
    expect(draft.rows.filter(row=>row.label==='Progress invoice paid')).toHaveLength(3);
    expect(draft.rows.find(row=>row.id==='all-buildings-complete')?.predecessorIds)
      .toEqual(['building-1-punch','building-2-punch','building-3-punch']);
    expect(validateDealScheduleRows(draft.rows)).toEqual([]);
  });

  it('only links imports to building deliveries when explicitly assigned',()=>{
    const unassigned=createMultifamilyStarterSchedule({importNames:['Phase One','Phase Two'],buildingNames:['Bldg A']});
    expect(unassigned.rows.find(row=>row.id==='building-1-delivery')?.predecessorIds)
      .toEqual(['building-1-site-ready']);
    const assigned=createMultifamilyStarterSchedule({
      importNames:['Phase One','Phase Two'],buildingNames:['Bldg A'],
      buildingImports:{'Bldg A':['Phase One','Phase Two']},
    });
    expect(assigned.rows.find(row=>row.id==='building-1')?.sourceImportIds)
      .toEqual(['import-1','import-2']);
    expect(assigned.rows.find(row=>row.id==='building-1-delivery')?.predecessorIds)
      .toEqual(['building-1-site-ready','import-1-site','import-2-site']);
    expect(validateDealScheduleRows(assigned.rows)).toEqual([]);
  });

  it('never invents ship dates, install dates, deposits, invoice amounts or retainage percentages',()=>{
    const rows=createMultifamilyStarterSchedule().rows;
    for(const row of rows){
      expect(row.plannedStart).toBeUndefined();
      expect(row.plannedFinish).toBeUndefined();
      expect(row.actualStart).toBeUndefined();
      expect(row.actualFinish).toBeUndefined();
      expect(row.amount).toBeUndefined();
      expect(row.retainagePercent).toBeUndefined();
      expect(row.status).toBe('not-started');
    }
  });

  it('reports broken template references',()=>{
    const draft=createMultifamilyStarterSchedule();
    const broken=draft.rows.map(row=>row.id==='retainage-received'
      ?{...row,predecessorIds:['nonexistent']}
      :row);
    expect(validateDealScheduleRows(broken)).toContain('Missing predecessor for retainage-received: nonexistent');
  });
});
