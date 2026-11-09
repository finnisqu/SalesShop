import {usePersonalTaskStore,taskScope,normalizedTaskAssociations,subtaskProgress} from '../store/personalTaskStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {requestTaskModal} from './TaskModalHost';
import {RecordCard} from './RecordPageLayout';
import {UnifiedRecordPicker} from './UnifiedRecordPicker';
import type {RelatedEntityKind} from './RecordRelatedActions';

export function RecordTasksPanel({kind,id,name}:{kind:RelatedEntityKind;id:string;name:string}){
 const tasks=usePersonalTaskStore(s=>s.tasks);
 const updateTask=usePersonalTaskStore(s=>s.updateTask);
 const storedScope=usePersonalTaskStore(s=>s.scope);
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id);
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 const scope=taskScope(mode,org,user);
 const linkType=kind==='deal'?'project':kind==='person'?'contact':'company';
 const related=scope&&storedScope===scope&&!preview?tasks.filter(task=>
  !task.deletedAt&&task.workspaceScope===scope&&normalizedTaskAssociations(task)
   .some(link=>link.type===linkType&&link.id===id)):[];
 const openTasks=related.filter(t=>t.status!=='completed'&&t.status!=='canceled');

 return <RecordCard title="Tasks" extra={<span>{openTasks.length} open · private</span>}>
  <p className="connections-record-helper">Tasks linked to this record, private to your account.</p>
  <div className="connections-record-entity-list">
   {related.slice().sort((a,b)=>Number(a.status==='completed')-Number(b.status==='completed')||
    (a.dueDate??'9999').localeCompare(b.dueDate??'9999')).map(task=><button
     type="button" key={task.id} onClick={()=>requestTaskModal({mode:'preview',id:task.id})}>
     <strong>{task.title}</strong>
     <small>{task.status==='completed'?'Completed':task.dueDate?'Due '+task.dueDate:'Open'}
      {subtaskProgress(task).total?' · '+subtaskProgress(task).done+'/'+subtaskProgress(task).total+' subtasks':''} →</small>
    </button>)}
   {!related.length&&<p className="connections-record-empty">No tasks linked yet.</p>}
  </div>
  {!preview&&Boolean(scope)&&storedScope===scope&&
   <UnifiedRecordPicker kind="Task"
    items={tasks.filter(task=>!task.deletedAt&&task.workspaceScope===scope&&
      !normalizedTaskAssociations(task).some(link=>link.type===linkType&&link.id===id))
      .map(task=>({id:task.id,name:task.title,detail:task.status}))}
    onLink={taskId=>{
      const task=tasks.find(item=>item.id===taskId&&item.workspaceScope===scope&&!item.deletedAt);
      if(!task)throw new Error('This Task is no longer available.');
      updateTask(taskId,{associations:[...normalizedTaskAssociations(task),
        {type:linkType,id,label:(kind==='person'?'Person':kind==='deal'?'Deal':'Company')+' · '+name}]});
    }}
    onCreate={title=>{
      requestTaskModal({mode:'create',title,associations:[{type:linkType,id,
       label:(kind==='person'?'Person':kind==='deal'?'Deal':'Company')+' · '+name}]});
    }}
    helper="Existing Tasks remain private to you. Creating a new Task opens the normal editor."/>}
 </RecordCard>;
}
