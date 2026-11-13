import {useEffect,useState,type SetStateAction} from 'react';

export interface WorktableDirectorySnapshot<T>{
 directory:string;
 value:T;
}

/** Resolve a table's presentation state without ever borrowing another
 * directory's value during the render after a Records tab switch. */
export function worktableDirectoryValue<T>(
 snapshot:WorktableDirectorySnapshot<T>,directory:string,load:(directory:string)=>T,
):T{
 return snapshot.directory===directory?snapshot.value:load(directory);
}

/** Scope state updates to the directory that initiated them. Functional
 * updates read the right directory even when the same component is reused. */
export function worktableDirectoryUpdate<T>(
 snapshot:WorktableDirectorySnapshot<T>,directory:string,
 update:SetStateAction<T>,load:(directory:string)=>T,
):WorktableDirectorySnapshot<T>{
 const previous=worktableDirectoryValue(snapshot,directory,load);
 return {directory,value:typeof update==='function'?
  (update as (previous:T)=>T)(previous):update};
}

/** Columns, pins, selection and pagination can share the same safe pattern.
 * Persistence receives the snapshot's OWN directory, not the currently shown
 * directory, so navigation cannot overwrite another directory's preferences. */
export function useWorktableDirectoryState<T>(
 directory:string,load:(directory:string)=>T,
 persist?:(directory:string,value:T)=>void,
):readonly [T,(update:SetStateAction<T>)=>void]{
 const [snapshot,setSnapshot]=useState<WorktableDirectorySnapshot<T>>(
  ()=>({directory,value:load(directory)}));
 const value=worktableDirectoryValue(snapshot,directory,load);
 useEffect(()=>{
  // Reset to this directory's saved preferences; non-persisted selections
  // load as empty on navigation and never transfer between Records tabs.
  setSnapshot(previous=>previous.directory===directory?previous:
   {directory,value:load(directory)});
 },[directory]);
 useEffect(()=>{
  persist?.(snapshot.directory,snapshot.value);
 },[snapshot]);
 const update=(change:SetStateAction<T>)=>{
  setSnapshot(previous=>worktableDirectoryUpdate(previous,directory,change,load));
 };
 return [value,update] as const;
}
