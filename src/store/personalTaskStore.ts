import {create} from 'zustand';
import {scopedStorageKey} from '../lib/developerPlayground';

export type TaskLink={type:'quote'|'project'|'company'|'contact'|'notebook';id:string};
export type TaskType='todo'|'call'|'email'|'meeting'|'follow-up';
export type TaskPriority='low'|'normal'|'high'|'urgent';
export type TaskStatus='open'|'in-progress'|'waiting'|'completed'|'canceled';
export interface PersonalTask {
  id:string;title:string;dueDate?:string;dueTime?:string;sourceObjectId?:string;
  linked?:TaskLink;sourceLabel?:string;sourceText?:string;
  notes?:string;type?:TaskType;priority?:TaskPriority;status?:TaskStatus;
  queue?:string;reminderAt?:string;
  createdAt:string;updatedAt:string;completedAt?:string;
}
export type TaskChanges=Partial<Omit<PersonalTask,'id'|'createdAt'|'updatedAt'>>;
export interface TaskPromotion {title:string;linked?:TaskLink;sourceLabel?:string;sourceText?:string;sourceObjectId?:string;}
interface TaskState {
  scope:string|null;tasks:PersonalTask[];promotion:TaskPromotion|null;
  load:(scope:string|null)=>void;
  add:(title:string,dueDate?:string,linked?:TaskLink)=>string|null;
  createTask:(title:string,changes?:TaskChanges)=>string|null;
  updateTask:(id:string,changes:TaskChanges)=>void;
  complete:(id:string)=>void;
  reopen:(id:string)=>void;
  snooze:(id:string,until:string)=>void;
  remove:(id:string)=>void;
  beginPromotion:(draft:TaskPromotion|null)=>void;
}
export function taskScope(mode:'local'|'cloud',organizationId:string|null,userId:string|undefined){
  if(mode==='cloud'&&(!organizationId||!userId))return null;
  return mode==='cloud'?'org:'+organizationId+':user:'+userId:'local:user';
}
const prefix=scopedStorageKey('salesshop-personal-tasks-v1:');
const storageKey=(scope:string)=>prefix+scope;
const validDate=(date?:string)=>!!date&&/^\d{4}-\d{2}-\d{2}$/.test(date);
const trim=(value?:string,max=240)=>value?.trim().slice(0,max)||undefined;
function read(scope:string):PersonalTask[]{
  try{
    const value=JSON.parse(window.localStorage.getItem(storageKey(scope))??'[]') as unknown;
    if(!Array.isArray(value))return[];
    return value.filter((item):item is PersonalTask=>
      item!==null&&typeof item==='object'&&
      typeof item.id==='string'&&typeof item.title==='string'&&
      typeof item.createdAt==='string'&&typeof item.updatedAt==='string')
      .map(item=>({...item,title:item.title.slice(0,240),
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
  if('dueTime'in next&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.dueTime??''))next.dueTime=undefined;
  if('reminderAt'in next&&next.reminderAt&&!Number.isFinite(Date.parse(next.reminderAt)))next.reminderAt=undefined;
  return next;
}
export const usePersonalTaskStore=create<TaskState>((set,get)=>({
  scope:null,tasks:[],promotion:null,
  load:scope=>{
    if(!scope){set({scope:null,tasks:[],promotion:null});return;}
    if(get().scope===scope)return;
    set({scope,tasks:read(scope)});
  },
  createTask:(title,changes={})=>{
    const scope=get().scope;
    const clean=trim(title);
    if(!scope||!clean)return null;
    const now=new Date().toISOString();
    const fields=sanitize(changes);
    const task:PersonalTask={...fields,id:'task_'+crypto.randomUUID(),title:clean,
      type:fields.type??'todo',priority:fields.priority??'normal',
      status:'open',completedAt:undefined,createdAt:now,updatedAt:now};
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
    const next=tasks.filter(task=>task.id!==id);
    set({tasks:next});persist(scope,next);
  },
  beginPromotion:promotion=>set({promotion}),
}));
