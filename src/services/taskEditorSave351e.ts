import type {PersonalTask,TaskChanges} from '../store/personalTaskStore';

export interface TaskEditorSaveSnapshot{
 scope:string|null;
 tasks:readonly Pick<PersonalTask,'id'|'workspaceScope'|'deletedAt'|'updatedAt'>[];
}
export interface TaskEditorSavePort{
 snapshot:()=>TaskEditorSaveSnapshot;
 create:(title:string,changes:TaskChanges)=>string|null;
 update:(id:string,changes:TaskChanges)=>void;
}

/** Save a Task editor draft only against its original, still-loaded workspace.
 * The Task store intentionally treats deleted/missing update IDs as no-ops;
 * silently treating those no-ops as success would close the editor and erase
 * the locally recovered Task draft (including newly created CRM links). */
export function saveTaskEditorChanges(
 expectedScope:string|null,taskId:string|null,changes:TaskChanges&{title:string},
 port:TaskEditorSavePort,
):string{
 const before=port.snapshot();
 if(!expectedScope||before.scope!==expectedScope)
  throw new Error('Task workspace changed or is still loading. Your draft is preserved; reopen the correct workspace to save.');
 if(!taskId){
  const created=port.create(changes.title,changes);
  if(!created)throw new Error('Unable to add this task. Your draft is preserved.');
  return created;
 }
 const prior=before.tasks.find(task=>task.id===taskId&&
  task.workspaceScope===expectedScope&&!task.deletedAt);
 if(!prior)
  throw new Error('This Task is no longer available in the current workspace. Your changes are preserved as a draft; reopen or create a new Task.');
 port.update(taskId,changes);
 const after=port.snapshot();
 const updated=after.scope===expectedScope?after.tasks.find(task=>
  task.id===taskId&&task.workspaceScope===expectedScope&&!task.deletedAt):undefined;
 // The store advances the edit timestamp strictly even for same-millisecond
 // saves. A missing/unchanged version means its update was a silent no-op.
 if(!updated||!(Date.parse(updated.updatedAt)>Date.parse(prior.updatedAt)))
  throw new Error('The Task update could not be verified. Your draft is preserved; retry after Tasks finish loading.');
 return taskId;
}
