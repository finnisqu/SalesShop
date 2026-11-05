import {beforeEach,describe,expect,it,vi} from 'vitest';
import {mergePrivateTasks} from '../services/personalTaskCloudSync';
import {nextTaskEditTimestamp,usePersonalTaskStore,type PersonalTask} from './personalTaskStore';

const scope='org:shop:user:owner';
const stamp='2026-11-05T14:00:00.000Z';
const task=(id:string,fields:Partial<PersonalTask>={}):PersonalTask=>({
  id,title:'Send customer quote',workspaceScope:scope,
  createdAt:stamp,updatedAt:stamp,priority:'normal',status:'open',type:'todo',
  ...fields,
});

describe('fast mobile Task edits and private cloud merge',()=>{
  beforeEach(()=>{
    vi.stubGlobal('window',{localStorage:{setItem:vi.fn()}});
    usePersonalTaskStore.setState({scope,tasks:[task('task-a')],
      syncStatus:'local',syncError:null});
  });

  it('moves forward at least one millisecond when edits share a clock tick',()=>{
    const clock=Date.parse(stamp);
    expect(nextTaskEditTimestamp(stamp,clock)).toBe('2026-11-05T14:00:00.001Z');
    expect(nextTaskEditTimestamp('2026-11-05T14:00:00.001Z',clock))
      .toBe('2026-11-05T14:00:00.002Z');
  });

  it('preserves priority and due-today edits across a rapid cloud merge',()=>{
    vi.useFakeTimers();
    try{
      vi.setSystemTime(new Date(stamp));
      const prior=task('task-a');
      usePersonalTaskStore.getState().updateTask('task-a',{priority:'urgent'});
      usePersonalTaskStore.getState().updateTask('task-a',{dueDate:'2026-11-05'});
      const latest=usePersonalTaskStore.getState().tasks[0];
      expect(latest.updatedAt).toBe('2026-11-05T14:00:00.002Z');
      const merged=mergePrivateTasks([latest],[prior]);
      expect(merged[0]).toMatchObject({priority:'urgent',dueDate:'2026-11-05'});
    }finally{vi.useRealTimers();}
  });

  it('does not mutate a deleted task or cross-scope record',()=>{
    const deleted=task('deleted',{deletedAt:stamp});
    const foreign=task('foreign',{workspaceScope:'org:another:user:owner'});
    usePersonalTaskStore.setState({tasks:[deleted,foreign]});
    const before=usePersonalTaskStore.getState().tasks;
    usePersonalTaskStore.getState().updateTask('deleted',{priority:'urgent'});
    usePersonalTaskStore.getState().updateTask('foreign',{priority:'urgent'});
    usePersonalTaskStore.getState().updateTask('not-there',{priority:'urgent'});
    expect(usePersonalTaskStore.getState().tasks).toBe(before);
  });

  it('does not replace deletion tombstones when removing repeatedly',()=>{
    const active=task('task-a');
    usePersonalTaskStore.getState().remove('task-a');
    const first=usePersonalTaskStore.getState().tasks[0];
    expect(first.deletedAt).toBeTruthy();
    expect(Date.parse(first.updatedAt)).toBeGreaterThan(Date.parse(active.updatedAt));
    const snapshot=usePersonalTaskStore.getState().tasks;
    usePersonalTaskStore.getState().remove('task-a');
    expect(usePersonalTaskStore.getState().tasks).toBe(snapshot);
  });
});
