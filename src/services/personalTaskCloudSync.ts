import {supabase} from '../lib/supabase';
import {usePersonalTaskStore,type PersonalTask} from '../store/personalTaskStore';

interface TaskDocument {schemaVersion:1;tasks:PersonalTask[];}
const DOCUMENT_KEY='tasks';
function readDocument(value:unknown):PersonalTask[]{
  if(!value||typeof value!=='object')return[];
  const record=value as Partial<TaskDocument>;
  if(record.schemaVersion!==1||!Array.isArray(record.tasks))return[];
  return record.tasks.filter(t=>t&&typeof t.id==='string'&&typeof t.title==='string'
    &&typeof t.updatedAt==='string');
}
/** Prefer explicit tombstones on equal clocks; never resurrect a deleted
 * task merely because another device sent an equally-timestamped edit. */
export function taskWinsMerge(candidate:PersonalTask,existing:PersonalTask):boolean{
  const a=Date.parse(candidate.updatedAt),b=Date.parse(existing.updatedAt);
  if(Number.isFinite(a)&&Number.isFinite(b)&&a!==b)return a>b;
  if(candidate.updatedAt!==existing.updatedAt)return candidate.updatedAt>existing.updatedAt;
  if(Boolean(candidate.deletedAt)!==Boolean(existing.deletedAt))return Boolean(candidate.deletedAt);
  return false; // Stable tie: retain existing remote record
}
export function mergePrivateTasks(local:readonly PersonalTask[],remote:readonly PersonalTask[]):PersonalTask[]{
  const all=new Map<string,PersonalTask>();
  for(const task of [...remote,...local]){
    const old=all.get(task.id);
    if(!old||taskWinsMerge(task,old))all.set(task.id,task);
  }
  return Array.from(all.values()).sort((a,b)=>
    b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
}
/** Reuses the per-user private_documents RLS policy. A row with document_key
 * "tasks" is never associated with the organization or any public CRM table.
 * Local writes remain authoritative until acknowledged by the server. */
export function startPersonalTaskCloudSync(scope:string,userId:string):()=>void{
  if(!supabase)return()=>{};
  const client=supabase;
  let cancelled=false,initializing=true,suppress=false,timer:ReturnType<typeof setTimeout>|null=null;
  let saving:Promise<void>|null=null,dirty=false;
  const store=usePersonalTaskStore;
  const status=store.getState().setSyncStatus;
  status('loading');
  const fetchRemote=async():Promise<PersonalTask[]>=>{
    const {data,error}=await client.from('private_documents')
      .select('document').eq('owner_id',userId).eq('document_key',DOCUMENT_KEY).maybeSingle();
    if(error)throw error;
    return readDocument(data?.document);
  };
  const upload=async()=>{
    if(cancelled||store.getState().scope!==scope)return;
    if(saving){dirty=true;return;}
    saving=(async()=>{
      try{
        const remote=await fetchRemote();
        if(cancelled)return;
        const latest=store.getState().tasks;
        const merged=mergePrivateTasks(latest,remote.filter(task=>task.workspaceScope===scope));
        // Never replace current local work with an outdated cloud response.
        suppress=true;store.getState().receiveCloud(scope,merged);suppress=false;
        // Preserve other company scopes owned by this user in the same private
        // document. Tasks remain invisible to other users through RLS.
        const document:TaskDocument={schemaVersion:1,
          tasks:[...remote.filter(task=>task.workspaceScope!==scope),...merged]};
        const {error}=await client.from('private_documents').upsert({
          owner_id:userId,document_key:DOCUMENT_KEY,document,
        },{onConflict:'owner_id,document_key'});
        if(error)throw error;
        if(!cancelled&&store.getState().scope===scope)status('saved');
      }catch(error){
        suppress=false;
        if(!cancelled)status('error',error instanceof Error?error.message:'Task cloud sync failed');
      }
    })();
    try{await saving;}finally{
      saving=null;
      if(dirty&&!cancelled){dirty=false;queue();}
    }
  };
  const queue=()=>{
    if(cancelled||initializing)return;
    if(timer)clearTimeout(timer);
    status('pending');
    timer=setTimeout(()=>{timer=null;void upload();},650);
  };
  const subscription=store.subscribe((next,previous)=>{
    if(next.scope!==scope||suppress||next.tasks===previous.tasks)return;
    queue();
  });
  void (async()=>{
    try{
      const remote=await fetchRemote();
      if(cancelled||store.getState().scope!==scope)return;
      const local=store.getState().tasks;
      const remoteInScope=remote.filter(task=>task.workspaceScope===scope);
      const merged=mergePrivateTasks(local,remoteInScope);
      suppress=true;store.getState().receiveCloud(scope,merged);suppress=false;
      initializing=false;
      // Ensure old device-only Home tasks are uploaded on first connection.
      if(JSON.stringify(merged)!==JSON.stringify(remoteInScope))queue();
      else status('saved');
    }catch(error){
      suppress=false;initializing=false;
      if(!cancelled)status('error',error instanceof Error?error.message:'Could not load cloud tasks');
    }
  })();
  return()=>{
    cancelled=true;subscription();
    if(timer)clearTimeout(timer);
  };
}
