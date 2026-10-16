import {create} from 'zustand';
import {scopedStorageKey} from '../lib/developerPlayground';

export type TaskLink={type:'quote'|'project'|'company'|'contact';id:string};
export interface PersonalTask{
 id:string;title:string;dueDate?:string;linked?:TaskLink;
 createdAt:string;updatedAt:string;completedAt?:string;
}
interface TaskState{
 scope:string|null;
 tasks:PersonalTask[];
 load:(scope:string|null)=>void;
 add:(title:string,dueDate?:string,linked?:TaskLink)=>string|null;
 complete:(id:string)=>void;
 snooze:(id:string,until:string)=>void;
}
export function taskScope(mode:'local'|'cloud',organizationId:string|null,userId:string|undefined){
 if(mode==='cloud'&&(!organizationId||!userId))return null;
 return mode==='cloud'?`org:${organizationId}:user:${userId}`:'local:user';
}
const prefix=scopedStorageKey('salesshop-personal-tasks-v1:');
const storageKey=(scope:string)=>prefix+scope;
function read(scope:string):PersonalTask[]{
 try{
   const value=JSON.parse(window.localStorage.getItem(storageKey(scope))??'[]') as unknown;
   if(!Array.isArray(value))return[];
   return value.filter((item):item is PersonalTask=>
     item!==null&&typeof item==='object'&&
     typeof item.id==='string'&&typeof item.title==='string'&&
     typeof item.createdAt==='string'&&typeof item.updatedAt==='string')
     .map(item=>({...item,title:item.title.slice(0,240)}));
 }catch{return[];}
}
function persist(scope:string,tasks:PersonalTask[]){
 try{window.localStorage.setItem(storageKey(scope),JSON.stringify(tasks));}catch{/* storage unavailable */}
}
export const usePersonalTaskStore=create<TaskState>((set,get)=>({
 scope:null,tasks:[],
 load:scope=>{
   if(!scope){set({scope:null,tasks:[]});return;}
   if(get().scope===scope)return;
   set({scope,tasks:read(scope)});
 },
 add:(title,dueDate,linked)=>{
   const scope=get().scope;
   const clean=title.trim().slice(0,240);
   if(!scope||!clean)return null;
   const now=new Date().toISOString();
   const task:PersonalTask={id:'task_'+crypto.randomUUID(),title:clean,
     dueDate:dueDate&&/^\d{4}-\d{2}-\d{2}$/.test(dueDate)?dueDate:undefined,
     linked:linked?.id?linked:undefined,createdAt:now,updatedAt:now};
   const tasks=[task,...get().tasks];set({tasks});persist(scope,tasks);return task.id;
 },
 complete:id=>{
   const {scope,tasks}=get();if(!scope)return;
   const now=new Date().toISOString();
   const next=tasks.map(task=>task.id===id?{...task,completedAt:now,updatedAt:now}:task);
   set({tasks:next});persist(scope,next);
 },
 snooze:(id,until)=>{
   const {scope,tasks}=get();
   if(!scope||!/^\d{4}-\d{2}-\d{2}$/.test(until))return;
   const now=new Date().toISOString();
   const next=tasks.map(task=>task.id===id&&!task.completedAt?
     {...task,dueDate:until,updatedAt:now}:task);
   set({tasks:next});persist(scope,next);
 },
}));
