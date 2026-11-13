import {createContext,useCallback,useContext,useId,useMemo,useRef,useState,type ReactNode} from 'react';

interface RecordInlineEditScopeState{
 activeId:string|null;
 claim:(id:string)=>boolean;
 release:(id:string)=>void;
}
const Context=createContext<RecordInlineEditScopeState|null>(null);

/** A per-record scope: only one About field may hold an unsaved draft at a time.
 * An attempt to start another edit never silently discards the first draft.
 * A new record key remounts this scope so a prior record's editor cannot leak. */
export function RecordInlineEditScope({children}:{children:ReactNode}){
 const holder=useRef<string|null>(null);
 const [activeId,setActiveId]=useState<string|null>(null);
 const claim=useCallback((id:string)=>{
  if(holder.current!==null&&holder.current!==id)return false;
  holder.current=id;
  setActiveId(id);
  return true;
 },[]);
 const release=useCallback((id:string)=>{
  if(holder.current!==id)return;
  holder.current=null;
  setActiveId(null);
 },[]);
 const value=useMemo(()=>({activeId,claim,release}),[activeId,claim,release]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useRecordInlineEditScope(){
 const value=useContext(Context);
 const id=useId();
 return {id,activeId:value?.activeId??null,claim:value?.claim,release:value?.release};
}
