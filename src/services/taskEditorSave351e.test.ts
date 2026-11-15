import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {saveTaskEditorChanges,type TaskEditorSaveSnapshot,
 type TaskEditorSavePort} from './taskEditorSave351e';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const scope='local:user';
const task={id:'task-1',workspaceScope:scope,updatedAt:'2026-11-15T10:00:00.000Z'};
const changes={title:'Follow up with estimator',notes:'Use CRM Person link.'};

function fixture(initial:TaskEditorSaveSnapshot={scope,tasks:[task]}){
 let state=initial;
 const create=vi.fn((title:string)=>{
  const id='task-created';
  state={...state,tasks:[...state.tasks,{id,workspaceScope:state.scope??undefined,
   updatedAt:'2026-11-15T10:00:01.000Z'}]};
  return id;
 });
 const update=vi.fn((id:string)=>{
  state={...state,tasks:state.tasks.map(row=>row.id===id?
   {...row,updatedAt:'2026-11-15T10:00:01.000Z'}:row)};
 });
 const port:TaskEditorSavePort={
  snapshot:()=>state,
  create:(title)=>create(title),
  update:(id)=>update(id),
 };
 return {port,create,update,state:()=>state,setState:(value:TaskEditorSaveSnapshot)=>{state=value;}};
}

describe('Batch 351e — verified Task save and stale-editor recovery',()=>{
 it('creates a new Task in the loaded workspace',()=>{
  const f=fixture();
  expect(saveTaskEditorChanges(scope,null,changes,f.port)).toBe('task-created');
  expect(f.create).toHaveBeenCalledTimes(1);
  expect(f.create).toHaveBeenCalledWith(changes.title);
  expect(f.state().tasks.some(item=>item.id==='task-created')).toBe(true);
  expect(f.update).not.toHaveBeenCalled();
 });
 it('refuses to create a Task when the workspace has not loaded',()=>{
  const f=fixture({scope:null,tasks:[]});
  expect(()=>saveTaskEditorChanges(scope,null,changes,f.port)).toThrow('workspace changed');
  expect(f.create).not.toHaveBeenCalled();
  expect(f.update).not.toHaveBeenCalled();
 });
 it('refuses to save a draft after switching organization or account',()=>{
  const f=fixture({scope:'org:other:user:bob',tasks:[task]});
  expect(()=>saveTaskEditorChanges(scope,'task-1',changes,f.port)).toThrow('workspace changed');
  expect(f.update).not.toHaveBeenCalled();
 });
 it('keeps the Task draft when its original record was deleted',()=>{
  const f=fixture({scope,tasks:[{...task,deletedAt:'2026-11-15T10:00:02.000Z'}]});
  expect(()=>saveTaskEditorChanges(scope,'task-1',changes,f.port)).toThrow('no longer available');
  expect(f.update).not.toHaveBeenCalled();
 });
 it('blocks updates to missing or foreign-workspace Task IDs',()=>{
  const f=fixture({scope,tasks:[{...task,id:'other-task'},
   {...task,id:'task-1',workspaceScope:'org:other:user:bob'}]});
  expect(()=>saveTaskEditorChanges(scope,'task-1',changes,f.port)).toThrow('no longer available');
  expect(f.update).not.toHaveBeenCalled();
 });
 it('verifies that the update actually advances the version before closing',()=>{
  const f=fixture();
  expect(saveTaskEditorChanges(scope,'task-1',changes,f.port)).toBe('task-1');
  expect(f.create).not.toHaveBeenCalled();
  expect(f.update).toHaveBeenCalledOnce();
  expect(f.update).toHaveBeenCalledWith('task-1');
  expect(f.state().tasks[0].updatedAt).toBe('2026-11-15T10:00:01.000Z');
 });
 it('rejects a silent no-op update without falsely reporting success',()=>{
  const f=fixture();
  f.port.update=()=>{};
  expect(()=>saveTaskEditorChanges(scope,'task-1',changes,f.port)).toThrow('could not be verified');
 });
 it('rejects an update made against a workspace that changed mid-save',()=>{
  const f=fixture();
  f.port.update=()=>f.setState({scope:'org:elsewhere:user:me',tasks:[{...task,
   updatedAt:'2026-11-15T10:00:01.000Z'}]});
  expect(()=>saveTaskEditorChanges(scope,'task-1',changes,f.port)).toThrow('could not be verified');
 });
 it('retains source-form error feedback and draft relationships on save failures',()=>{
  const workspace=source('components/TasksWorkspace.tsx');
  const store=source('store/personalTaskStore.ts');
  expect(workspace).toContain("import {saveTaskEditorChanges} from '../services/taskEditorSave351e';");
  expect(workspace).toContain('saveTaskEditorChanges(scope,taskId,changes,{');
  expect(workspace).toContain('snapshot:()=>{');
  expect(workspace).toContain('const state=usePersonalTaskStore.getState();');
  expect(workspace).toContain('return {scope:state.scope,tasks:state.tasks};');
  expect(workspace).toContain("setFormError(reason instanceof Error?reason.message:'Unable to apply task changes. Draft preserved.')");
  expect(workspace).toContain('writeSavedDraft(scopeKey,{');
  expect(workspace).toContain('notes,queue,subtasks:savedSubtasks,associations:selectedLinks,');
  expect(workspace).toContain('clearSavedDraft(scopeKey);clearSavedDraft(activeKey);');
  expect(store).toContain("const {scope,tasks}=get();if(!scope)return;");
  expect(store).toContain('if(!original)return;');
  const verified=workspace.indexOf('saveTaskEditorChanges(scope,taskId,changes,{');
  const dismiss=workspace.indexOf('setEditing(null);',verified);
  expect(dismiss).toBeGreaterThan(verified);
 });
});
