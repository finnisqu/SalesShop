import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createMultifamilyStarterSchedule} from '../services/dealScheduleTemplates';
import {updateScheduleRow} from '../services/dealScheduleEditing';
import {
  createSharedSchedule,fetchSharedSchedules,saveSharedSchedule,SharedScheduleConflict,
  type SharedScheduleRecord,
} from '../services/dealScheduleCloud';
import {useSharedDealScheduleStore} from './sharedDealScheduleStore';

vi.mock('../services/dealScheduleCloud',async(importOriginal)=>{
  const original=await importOriginal<typeof import('../services/dealScheduleCloud')>();
  return {...original,
    createSharedSchedule:vi.fn(),
    fetchSharedSchedules:vi.fn(),
    saveSharedSchedule:vi.fn(),
  };
});

function record(dealId:string,revision=1):SharedScheduleRecord{
  return {schedule:createMultifamilyStarterSchedule({dealId}),
    revision,updatedAt:'2026-11-08T12:00:00Z'};
}

describe('shared multifamily timeline state',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    useSharedDealScheduleStore.setState({
      scope:null,schedules:{},revisions:{},status:'idle',error:null,
    });
  });

  it('never retains org A data when switched to org B',async()=>{
    vi.mocked(fetchSharedSchedules).mockImplementation(async orgId=>
      orgId==='org-A'?{'deal-A':record('deal-A')}:{'deal-B':record('deal-B')});
    await useSharedDealScheduleStore.getState().load('org-A','alice');
    expect(useSharedDealScheduleStore.getState().schedules['deal-A']).toBeDefined();
    await useSharedDealScheduleStore.getState().load('org-B','bob');
    expect(useSharedDealScheduleStore.getState().schedules['deal-A']).toBeUndefined();
    expect(useSharedDealScheduleStore.getState().schedules['deal-B']).toBeDefined();
  });

  it('accepts only a server-confirmed revision after save',async()=>{
    vi.mocked(fetchSharedSchedules).mockResolvedValue({'deal-1':record('deal-1',3)});
    const saved={...record('deal-1',4),
      schedule:updateScheduleRow(record('deal-1',3).schedule,'deposit-received',{status:'complete' as const})};
    vi.mocked(saveSharedSchedule).mockResolvedValue(saved);
    await useSharedDealScheduleStore.getState().load('org-A','alice');
    await useSharedDealScheduleStore.getState().edit('deal-1','deposit-received',{status:'complete'});
    const store=useSharedDealScheduleStore.getState();
    expect(saveSharedSchedule).toHaveBeenCalledWith('org-A','alice','deal-1',3,expect.any(Object));
    expect(store.revisions['deal-1']).toBe(4);
    expect(store.schedules['deal-1'].rows.find(row=>row.id==='deposit-received')?.status).toBe('complete');
    expect(store.status).toBe('ready');
  });

  it('rejects stale overwrites, loads remote state, and requires explicit refresh',async()=>{
    const current=record('deal-1',1);
    const revised={...record('deal-1',2),
      schedule:updateScheduleRow(current.schedule,'shop-drawings-approved',{status:'complete' as const})};
    vi.mocked(fetchSharedSchedules)
      .mockResolvedValueOnce({'deal-1':current})
      .mockResolvedValue({'deal-1':revised});
    vi.mocked(saveSharedSchedule).mockRejectedValueOnce(new SharedScheduleConflict());
    await useSharedDealScheduleStore.getState().load('org-A','alice');
    await useSharedDealScheduleStore.getState().edit('deal-1','deposit-received',{status:'complete'});
    const conflicted=useSharedDealScheduleStore.getState();
    expect(conflicted.status).toBe('conflict');
    expect(conflicted.revisions['deal-1']).toBe(2);
    expect(conflicted.schedules['deal-1'].rows.find(row=>row.id==='deposit-received')?.status).toBe('not-started');
    expect(conflicted.schedules['deal-1'].rows.find(row=>row.id==='shop-drawings-approved')?.status).toBe('complete');
    await conflicted.refresh();
    expect(useSharedDealScheduleStore.getState().status).toBe('ready');
  });

  it('does not replace an existing cloud schedule when importing a device draft',async()=>{
    const remote=record('deal-1',6);
    vi.mocked(fetchSharedSchedules).mockResolvedValue({'deal-1':remote});
    await useSharedDealScheduleStore.getState().load('org-A','alice');
    await useSharedDealScheduleStore.getState().begin('deal-1',record('deal-1').schedule);
    expect(createSharedSchedule).not.toHaveBeenCalled();
    expect(useSharedDealScheduleStore.getState().revisions['deal-1']).toBe(6);
  });
});
