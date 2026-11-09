import {beforeEach,describe,expect,it} from 'vitest';
import {normalizedSubtasks,subtaskProgress,usePersonalTaskStore,type PersonalTask} from './personalTaskStore';
const item=(id:string,title:string,completed:boolean)=>({id,title,completed});
const task:PersonalTask={id:'task-subtest',title:'Submit extra documents',workspaceScope:'local:user',
 status:'open',createdAt:'2026-11-09T11:00:00.000Z',updatedAt:'2026-11-09T11:00:00.000Z',
 subtasks:[item('w9','W9',false),item('coi','COI',false)]};
describe('Task checklist subtasks',()=>{
 beforeEach(()=>usePersonalTaskStore.setState({scope:'local:user',tasks:[task],syncStatus:'local',syncError:null}));
 it('sanitizes malformed and duplicate checklist rows without losing valid data',()=>{
  expect(normalizedSubtasks([item('w9',' W9 ',false),item('w9','duplicate',true),
   {id:'coi',title:' COI ',completed:1},null])).toEqual([
    item('w9','W9',false),item('coi','COI',false)]);
 });
 it('does not complete the parent while any checklist item remains',()=>{
  usePersonalTaskStore.getState().updateTask(task.id,{subtasks:[item('w9','W9',true),item('coi','COI',false)]});
  const result=usePersonalTaskStore.getState().tasks[0];
  expect(result.status).toBe('open');
  expect(result.completedAt).toBeUndefined();
  expect(subtaskProgress(result)).toEqual({total:2,done:1,remaining:1});
  usePersonalTaskStore.getState().complete(task.id);
  expect(usePersonalTaskStore.getState().tasks[0].status).toBe('open');
 });
 it('keeps a Deal submission task open when quote submission leaves required documents unchecked',()=>{
  usePersonalTaskStore.setState({scope:'local:user',tasks:[{
   ...task,sourceObjectId:'deal-submit:deal-1',
   linked:{type:'project',id:'deal-1'},
   associations:[{type:'project',id:'deal-1',label:'Deal'}],
  }]});
  usePersonalTaskStore.getState().completeDealSubmissionTasks('deal-1');
  expect(usePersonalTaskStore.getState().tasks[0].status).toBe('open');
  usePersonalTaskStore.getState().updateTask(task.id,{subtasks:[
   item('w9','W9',true),item('coi','COI',true)]});
  expect(usePersonalTaskStore.getState().tasks[0].status).toBe('completed');
 });
 it('automatically completes on the final checkbox and reopens on uncheck',()=>{
  usePersonalTaskStore.getState().updateTask(task.id,{subtasks:[item('w9','W9',true),item('coi','COI',true)]});
  const done=usePersonalTaskStore.getState().tasks[0];
  expect(done.status).toBe('completed');
  expect(done.completedAt).toBeTruthy();
  usePersonalTaskStore.getState().updateTask(task.id,{subtasks:[item('w9','W9',true),item('coi','COI',false)]});
  const reopened=usePersonalTaskStore.getState().tasks[0];
  expect(reopened.status).toBe('open');
  expect(reopened.completedAt).toBeUndefined();
 });
});
