import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {activityAttemptId,recordActivityOnce} from './activitySaveRecovery351d';
import {completedTaskActivityId} from './taskActivityWorkflow';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 351d — idempotent Activity saves and recoverable follow-ups',()=>{
 it('generates one stable manual Activity identity for a new attempt',()=>{
  const generate=vi.fn(()=> 'random-1');
  const created=activityAttemptId(null,'local:user',null,generate);
  expect(created).toBe('activity_manual_random-1');
  expect(activityAttemptId(null,'local:user',created,generate)).toBe(created);
  expect(generate).toHaveBeenCalledTimes(1);
 });
 it('uses distinct IDs for distinct new Activity drafts',()=>{
  expect(activityAttemptId(null,'local:user',null,()=> 'one'))
   .not.toBe(activityAttemptId(null,'local:user',null,()=> 'two'));
 });
 it('retains task-completion identity rather than using a stale manual attempt',()=>{
  const owner='org:one:user:alice';
  const expected=completedTaskActivityId('task-7',owner);
  const generate=vi.fn(()=> 'should-not-generate');
  expect(activityAttemptId('task-7',owner,'activity_manual_other',generate))
   .toBe(expected);
  expect(generate).not.toHaveBeenCalled();
  expect(activityAttemptId('task-7',owner,null,generate)).toBe(expected);
  expect(activityAttemptId('task-7','org:one:user:bob',null,generate)).not.toBe(expected);
 });
 it('does not insert a second Activity when the same attempt is already logged',()=>{
  const record=vi.fn(id=>id);
  const id=activityAttemptId(null,'local:user','activity_manual_saved');
  expect(recordActivityOnce(id,[{id}],record)).toBe(id);
  expect(record).not.toHaveBeenCalled();
 });
 it('records a new Activity once and passes its stable ID to the CRM store',()=>{
  const id='activity_manual_first';
  const record=vi.fn((value:string)=>value);
  expect(recordActivityOnce(id,[],record)).toBe(id);
  expect(record).toHaveBeenCalledExactlyOnceWith(id);
 });
 it('retries a failed follow-up without creating a duplicate interaction',()=>{
  const activities:{id:string}[]=[];
  const followups:{sourceObjectId:string}[]=[];
  const id=activityAttemptId(null,'local:user',null,()=> 'retry-id');
  let failFollowUp=true;
  const save=()=>{
   const logged=recordActivityOnce(id,activities,stableId=>{
    activities.push({id:stableId});
    return stableId;
   });
   if(!followups.some(t=>t.sourceObjectId==='activity-followup:'+logged)){
    if(failFollowUp)throw new Error('follow-up store unavailable');
    followups.push({sourceObjectId:'activity-followup:'+logged});
   }
  };
  expect(save).toThrow('follow-up store unavailable');
  expect(activities).toHaveLength(1);
  failFollowUp=false;
  expect(save).not.toThrow();
  expect(save).not.toThrow();
  expect(activities).toEqual([{id}]);
  expect(followups).toEqual([{sourceObjectId:'activity-followup:'+id}]);
 });
 it('reuses the same pending ID after a pre-record write error',()=>{
  const id=activityAttemptId(null,'local:user',null,()=> 'pending');
  const recorder=vi.fn().mockImplementationOnce(()=>{throw new Error('CRM unavailable');})
   .mockImplementation((value:string)=>value);
  expect(()=>recordActivityOnce(id,[],recorder)).toThrow('CRM unavailable');
  expect(recordActivityOnce(activityAttemptId(null,'local:user',id),[],recorder)).toBe(id);
  expect(recorder).toHaveBeenCalledTimes(2);
  expect(recorder).toHaveBeenNthCalledWith(2,id);
 });
 it('writes a scoped retry identity before recording, and clears it on success/discard',()=>{
  const launcher=source('components/QuickActivityLauncher.tsx');
  expect(launcher).toContain('const [pendingActivityId,setPendingActivityId]=useState<string|null>');
  expect(launcher).toContain('pendingActivityId:activityId});');
  const draft=launcher.indexOf('writeSavedDraft(draftKey,{open:true,method,notes,occurred,links,createFollowUp,');
  const record=launcher.indexOf('const loggedId=recordActivityOnce(');
  expect(draft).toBeGreaterThan(0);
  expect(record).toBeGreaterThan(draft);
  expect(launcher).toContain('const activityId=activityAttemptId(workflowTaskId,privateScope,pendingActivityId);');
  expect(launcher).toContain('setWorkflowTaskId(null);setPendingActivityId(null);setLinks([]);close();');
  expect(launcher).toContain('setWorkflowTaskId(null);setPendingActivityId(null);\n  close();');
  expect(launcher).toContain('clearSavedDraft(draftKey);');
 });
 it('reopening an unfinished manual Activity retains its pending identity',()=>{
  const launcher=source('components/QuickActivityLauncher.tsx');
  expect(launcher).toContain('// Just reopening a manual Activity keeps its pending retry ID.');
  expect(launcher).toContain('setPendingActivityId(null);\n    }else if(workflowTaskId)');
  expect(launcher).toContain('setPendingActivityId(null);\n    setWorkflowTaskId(current.id);');
  expect(launcher).toContain('||pendingActivityId)&&');
  expect(launcher).toContain('window.addEventListener(\'salesshop:open-activity\',openForDate)');
  expect(launcher).toContain('const savingRef=useRef(false);');
  expect(launcher).toContain('if(savingRef.current)return;');
  expect(launcher).toContain('finally{savingRef.current=false;setSaving(false);}');
 });
 it('locks logged interaction details while keeping follow-up completion available',()=>{
  const launcher=source('components/QuickActivityLauncher.tsx');
  const css=source('components/sales-calendar.css');
  expect(launcher).toContain('const loggedPendingActivity=useCrmStore(');
  expect(launcher).toContain('className="sales-activity-recovery" role="status"');
  expect(launcher).toContain('disabled={loggedPendingActivity}');
  expect(launcher).toContain('{!loggedPendingActivity&&<>');
  expect(launcher).toContain('Finish pending work');
  expect(launcher).toContain('This Activity has already been logged. Discard the remaining follow-up draft?');
  expect(launcher).toContain('sourceObjectId===\'activity-followup:\'+loggedId');
  expect(launcher).toContain("Creating a Person, Company, or Deal saves that CRM record even if the Activity is canceled.");
  expect(css).toContain('.sales-activity-recovery{');
  expect(css).toContain('var(--ss-theme-tint');
 });
});
