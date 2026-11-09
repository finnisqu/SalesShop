import {create} from 'zustand';
import {scopedStorageKey} from '../lib/developerPlayground';
import type {Project} from '../types/crm';

export type TaskLink={type:'quote'|'project'|'company'|'contact'|'notebook';id:string};
export type TaskAssociation=TaskLink&{label?:string};
export const taskAssociationKey=(link:TaskLink)=>link.type+':'+link.id;
export function normalizedTaskAssociations(task:Pick<PersonalTask,'associations'|'linked'|'sourceLabel'>):TaskAssociation[]{
 const records=task.associations!==undefined?task.associations:(task.linked?[{...task.linked,label:task.sourceLabel}]:[]);
 const seen=new Set<string>();
 return records.filter(link=>{
   if(!link?.id||!link.type)return false;
   const key=taskAssociationKey(link);
   if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,40);
}
export type TaskType='todo'|'call'|'email'|'meeting'|'follow-up';
export type TaskPriority='low'|'normal'|'high'|'urgent';
export type TaskStatus='open'|'in-progress'|'waiting'|'completed'|'canceled';
export interface TaskSubtask{id:string;title:string;completed:boolean;}
/** Generated bid-due tasks can be completed only by confirmed quote delivery
 * or a recorded external quote submission, never by a manual Task action. */
export const isProtectedBidTask=(task:Pick<PersonalTask,'sourceObjectId'>):boolean=>
 Boolean(task.sourceObjectId?.startsWith('deal-submit:'));
export const bidTaskDealId=(task:Pick<PersonalTask,'sourceObjectId'>):string|null=>
 isProtectedBidTask(task)?task.sourceObjectId!.slice('deal-submit:'.length):null;
export function normalizedSubtasks(value:unknown):TaskSubtask[]{
 if(!Array.isArray(value))return[];
 const seen=new Set<string>();
 return value.slice(0,60).flatMap((item):TaskSubtask[]=>{
  if(!item||typeof item!=='object')return [];
  const row=item as Record<string,unknown>;
  const id=typeof row.id==='string'?row.id.trim().slice(0,90):'';
  const title=typeof row.title==='string'?row.title.trim().slice(0,180):'';
  if(!id||!title||seen.has(id))return[];
  seen.add(id);return [{id,title,completed:row.completed===true}];
 });
}
export function subtaskProgress(task:Pick<PersonalTask,'subtasks'>){
 const items=normalizedSubtasks(task.subtasks);
 const done=items.filter(item=>item.completed).length;
 return {total:items.length,done,remaining:items.length-done};
}
function deriveSubtaskStatus(status:TaskStatus,subtasks:TaskSubtask[]):TaskStatus{
 if(!subtasks.length||status==='canceled')return status;
 return subtasks.every(item=>item.completed)?'completed':status==='completed'?'open':status;
}
export interface PersonalTask {
  id:string;title:string;dueDate?:string;dueTime?:string;sourceObjectId?:string;deletedAt?:string;workspaceScope?:string;
  linked?:TaskLink;associations?:TaskAssociation[];sourceLabel?:string;sourceText?:string;
  startDate?:string;
  notes?:string;type?:TaskType;priority?:TaskPriority;status?:TaskStatus;
  queue?:string;reminderAt?:string;subtasks?:TaskSubtask[];
  createdAt:string;updatedAt:string;completedAt?:string;
}
export type TaskChanges=Partial<Omit<PersonalTask,'id'|'createdAt'|'updatedAt'>>;
export type NotebookPromotionKind='task'|'touchpoint'|'deal'|'contact'|'company';
export interface TaskPromotion {
  title:string;target?:NotebookPromotionKind;linked?:TaskLink;associations?:TaskAssociation[];
  sourceLabel?:string;sourceText?:string;sourceObjectId?:string;
  /** Unsaved contextual new-Task draft identity, never persisted as a Task field. */
  draftIdentity?:string;
}
interface TaskState {
  scope:string|null;tasks:PersonalTask[];promotion:TaskPromotion|null;
  syncStatus:'local'|'loading'|'pending'|'saved'|'error';syncError:string|null;
  setSyncStatus:(status:TaskState['syncStatus'],error?:string|null)=>void;
  receiveCloud:(scope:string,tasks:PersonalTask[])=>void;
  load:(scope:string|null)=>void;
  add:(title:string,dueDate?:string,linked?:TaskLink)=>string|null;
  createTask:(title:string,changes?:TaskChanges)=>string|null;
  updateTask:(id:string,changes:TaskChanges)=>void;
  complete:(id:string)=>void;
  reopen:(id:string)=>void;
  snooze:(id:string,until:string)=>void;
  remove:(id:string)=>void;
  beginPromotion:(draft:TaskPromotion|null)=>void;
  syncDealSubmissionTasks:(deals:readonly Project[])=>void;
  completeDealSubmissionTasks:(dealId:string)=>void;
}
export function taskScope(mode:'local'|'cloud',organizationId:string|null,userId:string|undefined){
  if(mode==='cloud'&&(!organizationId||!userId))return null;
  return mode==='cloud'?'org:'+organizationId+':user:'+userId:'local:user';
}
const prefix=scopedStorageKey('salesshop-personal-tasks-v1:');
const storageKey=(scope:string)=>prefix+scope;
const validDate=(date?:string)=>!!date&&/^\d{4}-\d{2}-\d{2}$/.test(date);
/** A second edit in the same millisecond must still beat a prior cloud copy.
 * This timestamp is the private Task merge's concurrency version. */
export function nextTaskEditTimestamp(previous:string,clock=Date.now()):string {
  const old=Date.parse(previous);
  const time=Number.isFinite(old)?Math.max(clock,old+1):clock;
  return new Date(time).toISOString();
}
/** A submission obligation exists only before the bid is sent or closed. */
export const dealNeedsSubmission=(deal:Project)=>!!deal.dueDate&&validDate(deal.dueDate)&&
 ['Discovery','Intent to Bid','Bid Development'].includes(deal.stage);
const trim=(value?:string,max=240)=>value?.trim().slice(0,max)||undefined;
function read(scope:string):PersonalTask[]{
  try{
    const value=JSON.parse(window.localStorage.getItem(storageKey(scope))??'[]') as unknown;
    if(!Array.isArray(value))return[];
    return value.filter((item):item is PersonalTask=>
      item!==null&&typeof item==='object'&&
      typeof item.id==='string'&&typeof item.title==='string'&&
      typeof item.createdAt==='string'&&typeof item.updatedAt==='string')
      .map(item=>({...item,workspaceScope:item.workspaceScope??scope,title:item.title.slice(0,240),
        status:item.status??(item.completedAt?'completed':'open'),
        type:item.type??'todo',priority:item.priority??'normal',
        subtasks:normalizedSubtasks(item.subtasks)}));
  }catch{return[];}
}
function persist(scope:string,tasks:PersonalTask[]){
  try{window.localStorage.setItem(storageKey(scope),JSON.stringify(tasks));}
  catch{/* storage unavailable; existing local-first behavior */ }
}
function sanitize(change:TaskChanges):TaskChanges {
  const next:TaskChanges={...change};
  if('title'in next)next.title=trim(next.title);
  if('notes'in next)next.notes=trim(next.notes,5000);
  if('queue'in next)next.queue=trim(next.queue,80);
  if('subtasks'in next)next.subtasks=normalizedSubtasks(next.subtasks);
  if('dueDate'in next&&!validDate(next.dueDate))next.dueDate=undefined;
  if('startDate'in next&&!validDate(next.startDate))next.startDate=undefined;
  if('associations'in next){
    next.associations=normalizedTaskAssociations({associations:next.associations,linked:next.linked,sourceLabel:next.sourceLabel})
      .map(link=>({...link,label:trim(link.label,120)}));
    next.linked=next.associations[0]?{type:next.associations[0].type,id:next.associations[0].id}:undefined;
    next.sourceLabel=next.associations[0]?.label;
  }
  if('dueTime'in next&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.dueTime??''))next.dueTime=undefined;
  if('reminderAt'in next&&next.reminderAt&&!Number.isFinite(Date.parse(next.reminderAt)))next.reminderAt=undefined;
  return next;
}
export const usePersonalTaskStore=create<TaskState>((set,get)=>({
  scope:null,tasks:[],promotion:null,syncStatus:'local',syncError:null,
  setSyncStatus:(syncStatus,syncError=null)=>set({syncStatus,syncError}),
  receiveCloud:(scope,tasks)=>{
    if(scope!==get().scope)return;
    set({tasks});persist(scope,tasks);
  },
  load:scope=>{
    if(!scope){set({scope:null,tasks:[],syncStatus:'local',syncError:null});return;}
    if(get().scope===scope)return;
    set({scope,tasks:read(scope),syncStatus:'local',syncError:null});
  },
  createTask:(title,changes={})=>{
    const scope=get().scope;
    const clean=trim(title);
    if(!scope||!clean)return null;
    const now=new Date().toISOString();
    const fields=sanitize(changes);
    const nextStatus=deriveSubtaskStatus(fields.status??'open',fields.subtasks??[]);
    const task:PersonalTask={...fields,id:'task_'+crypto.randomUUID(),title:clean,workspaceScope:scope,
      type:fields.type??'todo',priority:fields.priority??'normal',
      status:nextStatus,completedAt:nextStatus==='completed'?now:undefined,
      createdAt:now,updatedAt:now};
    const tasks=[task,...get().tasks];
    set({tasks});persist(scope,tasks);return task.id;
  },
  add:(title,dueDate,linked)=>get().createTask(title,{dueDate,linked}),
  updateTask:(id,changes)=>{
    const {scope,tasks}=get();if(!scope)return;
    const original=tasks.find(task=>task.id===id&&
      task.workspaceScope===scope&&!task.deletedAt);
    if(!original)return;
    const now=nextTaskEditTimestamp(original.updatedAt),patch=sanitize(changes);
    // Do not allow changing the protected identity or marking a submission task
    // complete via editor, bulk actions, checklists, or manual Task controls.
    if(isProtectedBidTask(original)){
      delete patch.sourceObjectId;
      if(patch.status==='completed')patch.status=original.status==='completed'?'completed':'open';
    }
    const next=tasks.map(task=>{
      if(task.id!==id)return task;
      const proposed=deriveSubtaskStatus(patch.status??task.status??'open',
        patch.subtasks??normalizedSubtasks(task.subtasks));
      const status=isProtectedBidTask(task)&&task.status!=='completed'&&proposed==='completed'
        ?'open':proposed;
      return {...task,...patch,title:patch.title||task.title,
        completedAt:status==='completed'?(task.completedAt??now):undefined,
        status,updatedAt:now};
    });
    set({tasks:next});persist(scope,next);
  },
  complete:id=>get().updateTask(id,{status:'completed'}),
  reopen:id=>get().updateTask(id,{status:'open'}),
  snooze:(id,until)=>{if(validDate(until))get().updateTask(id,{dueDate:until,status:'open'});},
  remove:id=>{
    const {scope,tasks}=get();if(!scope)return;
    const original=tasks.find(task=>task.id===id&&
      task.workspaceScope===scope&&!task.deletedAt);
    if(!original)return;
    const now=nextTaskEditTimestamp(original.updatedAt);
    // Tombstones prevent another signed-in device from resurrecting deleted tasks.
    const next=tasks.map(task=>task.id===id?{...task,deletedAt:now,updatedAt:now}:task);
    set({tasks:next});persist(scope,next);
  },
  /** Close only submission work associated with this Deal. Unrelated tasks remain open. */
  completeDealSubmissionTasks:dealId=>{
    const {scope,tasks}=get();
    if(!scope)return;
    let changed=false;
    const updated=tasks.map(task=>{
      if(task.deletedAt||task.completedAt||
         task.status==='completed'||task.status==='canceled')return task;
      const automated=task.sourceObjectId==='deal-submit:'+dealId;
      const authored=/submit.*(quote|bid)|send.*(quote|bid)/i.test(task.title)&&
        normalizedTaskAssociations(task).some(link=>link.type==='project'&&link.id===dealId);
      if(!automated&&!authored)return task;
      // Quoting events cannot bypass an unfinished checklist. The user can
      // still finish the supporting documents after submitting the bid.
      if(normalizedSubtasks(task.subtasks).some(item=>!item.completed))return task;
      changed=true;
      const timestamp=nextTaskEditTimestamp(task.updatedAt);
      return {...task,status:'completed' as const,completedAt:timestamp,updatedAt:timestamp};
    });
    if(changed){set({tasks:updated});persist(scope,updated);}
  },
  /** Exactly one private, editable submission task per deal due date.
   * Tasks use stable ids, so cloud merge / rehydration can't duplicate them. */
  syncDealSubmissionTasks:deals=>{
    const {scope,tasks}=get();
    if(!scope)return;
    const due=new Map(deals.filter(dealNeedsSubmission)
      .map(deal=>[deal.id,deal] as const));
    const allDeals=new Map(deals.map(deal=>[deal.id,deal] as const));
    const existing=new Set(tasks.map(task=>task.id));
    const now=new Date().toISOString();
    let changed=false;
    const updated=tasks.map(task=>{
      if(!task.sourceObjectId?.startsWith('deal-submit:')||task.deletedAt)return task;
      const dealId=task.sourceObjectId.slice('deal-submit:'.length);
      const deal=due.get(dealId);
      if(!deal){
       if(task.status==='canceled'||task.status==='completed')return task;
       const stage=allDeals.get(dealId)?.stage;
       // A manually changed CRM stage is NOT evidence of customer delivery.
       // Preserve the submission Task until a confirmed quote or external
       // submission calls completeDealSubmissionTasks for this Deal.
       if(stage&&['Bid Sent','Negotiation','Closed Won','Completed'].includes(stage))return task;
       changed=true;
       return {...task,status:'canceled' as const,updatedAt:now};
      }
      // An intentional cancel is a user override, not a retry condition.
      if(task.status==='canceled'||task.dueDate===deal.dueDate)return task;
      changed=true;
      return {...task,dueDate:deal.dueDate,updatedAt:now};
    });
    for(const deal of due.values()){
      const id='task_deal_submit_'+deal.id;
      if(existing.has(id))continue;
      // An existing user-authored submission Task takes precedence over automation.
      if(tasks.some(task=>!task.deletedAt&&task.status!=='canceled'&&
       task.dueDate===deal.dueDate&&/submit.*quote/i.test(task.title)&&
       normalizedTaskAssociations(task).some(link=>link.type==='project'&&link.id===deal.id)))
       continue;
      changed=true;
      updated.unshift({
       id,title:'Submit quote · '+deal.name,dueDate:deal.dueDate,
       type:'todo',priority:'normal',status:'open',queue:'Bid submissions',
       sourceObjectId:'deal-submit:'+deal.id,
       linked:{type:'project',id:deal.id},
       associations:[{type:'project',id:deal.id,label:'Deal · '+deal.name}],
       sourceLabel:'Deal · '+deal.name,
       notes:'Automatic bid deadline. Completion requires confirmed customer delivery of a linked SalesShop Quote, or a recorded external quote submission.',
       workspaceScope:scope,createdAt:now,updatedAt:now,
      });
    }
    if(changed){set({tasks:updated});persist(scope,updated);}
  },
  beginPromotion:promotion=>set({promotion}),
}));
