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
export interface PersonalTask {
  id:string;title:string;dueDate?:string;dueTime?:string;sourceObjectId?:string;deletedAt?:string;workspaceScope?:string;
  linked?:TaskLink;associations?:TaskAssociation[];sourceLabel?:string;sourceText?:string;
  startDate?:string;
  notes?:string;type?:TaskType;priority?:TaskPriority;status?:TaskStatus;
  queue?:string;reminderAt?:string;
  createdAt:string;updatedAt:string;completedAt?:string;
}
export type TaskChanges=Partial<Omit<PersonalTask,'id'|'createdAt'|'updatedAt'>>;
export type NotebookPromotionKind='task'|'touchpoint'|'deal'|'contact'|'company';
export interface TaskPromotion {
  title:string;target?:NotebookPromotionKind;linked?:TaskLink;associations?:TaskAssociation[];
  sourceLabel?:string;sourceText?:string;sourceObjectId?:string;
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
}
export function taskScope(mode:'local'|'cloud',organizationId:string|null,userId:string|undefined){
  if(mode==='cloud'&&(!organizationId||!userId))return null;
  return mode==='cloud'?'org:'+organizationId+':user:'+userId:'local:user';
}
const prefix=scopedStorageKey('salesshop-personal-tasks-v1:');
const storageKey=(scope:string)=>prefix+scope;
const validDate=(date?:string)=>!!date&&/^\d{4}-\d{2}-\d{2}$/.test(date);
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
        type:item.type??'todo',priority:item.priority??'normal'}));
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
    const nextStatus=fields.status??'open';
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
    const now=new Date().toISOString(),patch=sanitize(changes);
    const next=tasks.map(task=>{
      if(task.id!==id)return task;
      const status=patch.status??task.status??'open';
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
    const now=new Date().toISOString();
    // Tombstones prevent another signed-in device from resurrecting deleted tasks.
    const next=tasks.map(task=>task.id===id?{...task,deletedAt:now,updatedAt:now}:task);
    set({tasks:next});persist(scope,next);
  },
  /** Exactly one private, editable submission task per deal due date.
   * Tasks use stable ids, so cloud merge / rehydration can't duplicate them. */
  syncDealSubmissionTasks:deals=>{
    const {scope,tasks}=get();
    if(!scope)return;
    const due=new Map(deals.filter(dealNeedsSubmission)
      .map(deal=>[deal.id,deal] as const));
    const existing=new Set(tasks.map(task=>task.id));
    const now=new Date().toISOString();
    let changed=false;
    const updated=tasks.map(task=>{
      if(!task.sourceObjectId?.startsWith('deal-submit:')||task.deletedAt)return task;
      const dealId=task.sourceObjectId.slice('deal-submit:'.length);
      const deal=due.get(dealId);
      if(!deal){
       // Preserve completed submissions as history; cancel only unfinished work.
       if(task.status==='canceled'||task.status==='completed')return task;
       changed=true;return {...task,status:'canceled' as const,updatedAt:now};
      }
      if(task.dueDate===deal.dueDate&&task.status!=='canceled')return task;
      changed=true;
      return {...task,dueDate:deal.dueDate,
       status:task.status==='canceled'?'open' as const:task.status,
       updatedAt:now};
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
       notes:'Automatically linked to the deal bid due date. Complete after submitting the quote.',
       workspaceScope:scope,createdAt:now,updatedAt:now,
      });
    }
    if(changed){set({tasks:updated});persist(scope,updated);}
  },
  beginPromotion:promotion=>set({promotion}),
}));
