import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {useDealScheduleStore} from './dealScheduleStore';

describe('Deal schedule device draft storage',()=>{
  beforeEach(()=>{
    const data=new Map<string,string>();
    vi.stubGlobal('window',{localStorage:{
      getItem:(key:string)=>data.get(key)??null,
      setItem:(key:string,value:string)=>{data.set(key,value);},
      removeItem:(key:string)=>{data.delete(key);},
    }});
    useDealScheduleStore.setState({scope:'',loaded:false,schedules:{},error:null});
  });
  afterEach(()=>{vi.unstubAllGlobals();});

  it('only creates a Deal schedule once, including across repeated reloads',()=>{
    const store=useDealScheduleStore.getState();
    store.load('org:demo:user:alice');
    store.begin('deal-1');
    const original=useDealScheduleStore.getState().schedules['deal-1'];
    store.begin('deal-1');
    expect(useDealScheduleStore.getState().schedules['deal-1'].rows.length).toBe(original.rows.length);
    store.edit('deal-1','deposit-received',{status:'complete'});
    store.load('org:demo:user:bob');
    expect(useDealScheduleStore.getState().schedules['deal-1']).toBeUndefined();
    store.load('org:demo:user:alice');
    expect(useDealScheduleStore.getState().schedules['deal-1'].rows.find(
      row=>row.id==='deposit-received')?.status).toBe('complete');
  });

  it('isolates device-local schedules by both organization and member',()=>{
    const store=useDealScheduleStore.getState();
    store.load('org:A:user:rep-1');
    store.begin('deal-a');
    expect(useDealScheduleStore.getState().schedules['deal-a']).toBeDefined();
    store.load('org:B:user:rep-1');
    expect(useDealScheduleStore.getState().schedules['deal-a']).toBeUndefined();
    store.load('org:A:user:rep-2');
    expect(useDealScheduleStore.getState().schedules['deal-a']).toBeUndefined();
    store.load('org:A:user:rep-1');
    expect(useDealScheduleStore.getState().schedules['deal-a']).toBeDefined();
  });

  it('retains original schedule if an invalid date update is attempted',()=>{
    const store=useDealScheduleStore.getState();
    store.load('offline');
    store.begin('deal-2');
    store.edit('deal-2','building-1-install',{plannedStart:'2027-04-15'});
    store.edit('deal-2','building-1-install',{plannedFinish:'2027-04-01'});
    const row=useDealScheduleStore.getState().schedules['deal-2'].rows.find(
      item=>item.id==='building-1-install');
    expect(row?.plannedStart).toBe('2027-04-15');
    expect(row?.plannedFinish).toBeUndefined();
    expect(useDealScheduleStore.getState().error).toMatch(/precedes start/);
  });
});
