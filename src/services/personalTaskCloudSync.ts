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
  const aValid=Number.isFinite(a),bValid=Number.isFinite(b);
  // A corrupt offline clock/string must never outrank the valid cloud copy.
  if(aValid!==bValid)return aValid;
  if(aValid&&bValid&&a!==b)return a>b;
  // Different ISO strings can represent the same instant. Never compare
  // their spelling; preserve tombstones on equal or untrusted clocks.
  if(Boolean(candidate.deletedAt)!==Boolean(existing.deletedAt))return Boolean(candidate.deletedAt);
  return false; // Stable tie: retain existing remote record
}
/** Submission confirmation is monotonic evidence. A different device can
 * update a protected bid Task's title/due date with a later timestamp but
 * must not erase proof already recorded by a confirmed customer submission.
 * Keep the winning record's status/checklist/tombstone and only restore
 * proof for the exact same Task, Deal and workspace. */
export function preserveBidSubmissionProof(
 winner:PersonalTask,other:PersonalTask,
):PersonalTask{
 if(winner.deletedAt||other.deletedAt||
  !winner.sourceObjectId?.startsWith('deal-submit:')||
  winner.sourceObjectId!==other.sourceObjectId||
  (winner.workspaceScope&&other.workspaceScope&&
   winner.workspaceScope!==other.workspaceScope))return winner;
 const evidence=[winner.submissionConfirmedAt,other.submissionConfirmedAt]
  .filter((value):value is string=>typeof value==='string'&&
   Number.isFinite(Date.parse(value)))
  .sort((a,b)=>Date.parse(a)-Date.parse(b))[0];
 return evidence&&winner.submissionConfirmedAt!==evidence
  ?{...winner,submissionConfirmedAt:evidence}:winner;
}

export function mergePrivateTasks(local:readonly PersonalTask[],remote:readonly PersonalTask[]):PersonalTask[]{
  const all=new Map<string,PersonalTask>();
  for(const task of [...remote,...local]){
    const old=all.get(task.id);
    if(!old){all.set(task.id,task);continue;}
    const winner=taskWinsMerge(task,old)?task:old;
    const loser=winner===task?old:task;
    all.set(task.id,preserveBidSubmissionProof(winner,loser));
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
  let lastRecoveryRetry=0;
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
        if(cancelled||store.getState().scope!==scope)return;
        const latest=store.getState().tasks;
        const merged=mergePrivateTasks(latest,remote.filter(task=>task.workspaceScope===scope));
        // Never replace current local work with an outdated cloud response.
        suppress=true;store.getState().receiveCloud(scope,merged);suppress=false;
        // Preserve other company scopes owned by this user in the same private
        // document. Tasks remain invisible to other users through RLS.
        const document:TaskDocument={schemaVersion:1,
          tasks:[...remote.filter(task=>task.workspaceScope!==scope),...merged]};
        if(cancelled||store.getState().scope!==scope)return;
        const {error}=await client.from('private_documents').upsert({
          owner_id:userId,document_key:DOCUMENT_KEY,document,
        },{onConflict:'owner_id,document_key'});
        if(error)throw error;
        // A newer edit may be queued while this older save is in flight.
        // Do not show "Saved" until that latest version is acknowledged.
        if(!cancelled&&store.getState().scope===scope&&
          !dirty&&!timer&&store.getState().tasks===merged)status('saved');
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
  // Offline errors otherwise stay red indefinitely unless the user edits
  // another Task. Retry on reconnect or foreground, but never in a new scope.
  const retryFailed=()=>{
    if(cancelled||initializing||store.getState().scope!==scope||
      store.getState().syncStatus!=='error')return;
    if(Date.now()-lastRecoveryRetry<15000)return;
    lastRecoveryRetry=Date.now();
    queue();
  };
  const retryWhenVisible=()=>{if(document.visibilityState==='visible')retryFailed();};
  window.addEventListener('online',retryFailed);
  document.addEventListener('visibilitychange',retryWhenVisible);
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
    window.removeEventListener('online',retryFailed);
    document.removeEventListener('visibilitychange',retryWhenVisible);
    if(timer)clearTimeout(timer);
  };
}
