import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {timelineBetaScope,useDealTimelineBetaStore} from './dealTimelineBetaStore';

describe('opt-in project timeline beta',()=>{
  const values=new Map<string,string>();
  beforeEach(()=>{
    values.clear();
    vi.stubGlobal('window',{localStorage:{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,value);},
    }});
    vi.stubGlobal('crypto',{randomUUID:()=> 'abc12345678942-0000-0000-0000-000000000000'});
    useDealTimelineBetaStore.setState({enabled:false,loadedScope:null,drafts:{},error:null});
  });
  afterEach(()=>vi.unstubAllGlobals());

  it('does not load org-specific drafts before the user and org are known',()=>{
    expect(timelineBetaScope('cloud',null,'alice')).toBeNull();
    expect(timelineBetaScope('cloud','org-1',null)).toBeNull();
    expect(timelineBetaScope('cloud','org-1','alice')).toBe('org:org-1:user:alice');
    expect(timelineBetaScope('local',null,null)).toBe('local');
  });
  it('starts once, and persists only in the current account and device scope',()=>{
    const store=useDealTimelineBetaStore.getState();
    const scope='org:org-A:user:alice';
    store.load(scope);
    store.start(scope,'deal-1');
    store.start(scope,'deal-1');
    expect(useDealTimelineBetaStore.getState().drafts['deal-1'].rows.length).toBeGreaterThan(20);
    store.patch(scope,'deal-1','shop-drawings-approved',{plannedFinish:'2027-03-12',status:'complete'});
    store.load('org:org-A:user:bob');
    expect(useDealTimelineBetaStore.getState().drafts['deal-1']).toBeUndefined();
    store.load(scope);
    expect(useDealTimelineBetaStore.getState().drafts['deal-1'].rows.find(
      row=>row.id==='shop-drawings-approved')?.status).toBe('complete');
  });
  it('adds independently identifiable buildings without mutating previous revision',()=>{
    const scope='local';
    const store=useDealTimelineBetaStore.getState();
    store.load(scope);store.start(scope,'deal-A');
    const before=useDealTimelineBetaStore.getState().drafts['deal-A'];
    store.addPhase(scope,'deal-A','building');
    const after=useDealTimelineBetaStore.getState().drafts['deal-A'];
    expect(after.rows.filter(row=>row.parentId==='buildings')).toHaveLength(3);
    expect(before.rows.filter(row=>row.parentId==='buildings')).toHaveLength(2);
    const newId=after.rows.find(row=>row.parentId==='buildings'&&row.id!=='building-1'&&row.id!=='building-2')!.id;
    expect(after.rows.find(row=>row.id==='all-buildings-complete')?.predecessorIds).toContain(newId+'-punch');
    expect(before.rows.find(row=>row.id==='all-buildings-complete')?.predecessorIds).not.toContain(newId+'-punch');
  });
  it('refuses reversed dates and does not clear the validation error',()=>{
    const scope='local',store=useDealTimelineBetaStore.getState();
    store.load(scope);store.start(scope,'deal-A');
    store.patch(scope,'deal-A','building-1-install',{plannedStart:'2027-04-15'});
    store.patch(scope,'deal-A','building-1-install',{plannedFinish:'2027-04-01'});
    const state=useDealTimelineBetaStore.getState();
    expect(state.error).toMatch(/finish cannot be before/);
    expect(state.drafts['deal-A'].rows.find(row=>row.id==='building-1-install')?.plannedFinish).toBeUndefined();
  });
  it('turns the beta off without deleting its drafts',()=>{
    const scope='local',store=useDealTimelineBetaStore.getState();
    store.load(scope);store.start(scope,'deal-A');
    store.setEnabled(true);store.setEnabled(false);
    expect(useDealTimelineBetaStore.getState().enabled).toBe(false);
    store.load('org:other:user:bob');store.load(scope);
    expect(useDealTimelineBetaStore.getState().drafts['deal-A']).toBeDefined();
  });
});
