import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

type DocumentKind='notebook'|'crm';
type GetResponse={document:unknown;revision:number;updatedAt:string|null};
type SaveResponse={revision:number;updatedAt:string|null};

export interface HeadquartersDocumentState<T> {
 document:T;loading:boolean;saving:boolean;dirty:boolean;error:string;
 updatedAt:string|null;
 change:(updater:(previous:T)=>T)=>void;
 reload:()=>Promise<void>;
}

/** Persistent per-developer documents. Never references any tenant data store.
 * Save is serialized and checks server revisions to prevent silent data loss. */
export function useHeadquartersDocument<T>(
 kind:DocumentKind,empty:()=>T,normalize:(value:unknown)=>T,
 enabled:boolean,
):HeadquartersDocumentState<T> {
 const [document,setDocument]=useState<T>(()=>empty());
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [error,setError]=useState('');
 const [updatedAt,setUpdatedAt]=useState<string|null>(null);
 const revision=useRef(0);
 const mutation=useRef(0);
 const active=useRef(true);
 const saveInFlight=useRef(false);

 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const reload=useCallback(async()=>{
   if(!enabled || !supabase)return;
   setLoading(true);setError('');setDirty(false);
   try {
     const {data,error:loadError}=await supabase.rpc('platform_hq_get_document',{p_kind:kind});
     if(loadError)throw loadError;
     const snapshot=data as GetResponse|null;
     if(!active.current)return;
     revision.current=Number(snapshot?.revision ?? 0);
     setDocument(normalize(snapshot?.document));
     setUpdatedAt(snapshot?.updatedAt ?? null);
   } catch(err) {
     if(active.current)setError(err instanceof Error?err.message:'Could not load private headquarters data.');
   } finally {if(active.current)setLoading(false);}
 },[kind,enabled,normalize]);
 useEffect(()=>{void reload();},[reload]);

 const change=useCallback((updater:(prev:T)=>T)=>{
   setDocument(prev=>updater(prev));mutation.current+=1;setDirty(true);
 },[]);

 useEffect(()=>{
   if(!dirty||loading||saving||error||!enabled||!supabase||saveInFlight.current)return;
   const timer=window.setTimeout(()=>{
     if(saveInFlight.current||!supabase)return;
     const submittedMutation=mutation.current;
     const submittedDoc=document;
     const expected=revision.current;
     saveInFlight.current=true;setSaving(true);
     void (async()=>{
       try{
         const {data,error:saveError}=await supabase.rpc('platform_hq_save_document',{
           p_kind:kind,p_document:submittedDoc,p_expected_revision:expected,
         });
         if(saveError)throw saveError;
         const response=data as SaveResponse;
         if(!active.current)return;
         revision.current=Number(response.revision);
         setUpdatedAt(response.updatedAt);
         if(mutation.current===submittedMutation)setDirty(false);
       }catch(err){
         if(active.current)setError(err instanceof Error?err.message:'Could not save private headquarters data.');
       }finally{
         saveInFlight.current=false;
         if(active.current)setSaving(false);
       }
     })();
   },650);
   return()=>window.clearTimeout(timer);
 },[dirty,loading,saving,error,enabled,document,kind]);

 useEffect(()=>{
   if(!dirty||!enabled)return;
   const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
   window.addEventListener('beforeunload',beforeUnload);
   return()=>window.removeEventListener('beforeunload',beforeUnload);
 },[dirty,enabled]);

 return {document,loading,saving,dirty,error,updatedAt,change,reload};
}
