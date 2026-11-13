import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {taskLinkedRecordPreview} from './taskPreviewNavigation';
import {activityEditorCanUseDraft} from './activityEditorScope';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 341b — Task and Activity inspector navigation',()=>{
 it('maps every supported Task relation to the matching Record preview',()=>{
  expect(taskLinkedRecordPreview({type:'contact',id:'person-1'}))
   .toEqual({kind:'person',id:'person-1'});
  expect(taskLinkedRecordPreview({type:'project',id:'deal-1'}))
   .toEqual({kind:'deal',id:'deal-1'});
  expect(taskLinkedRecordPreview({type:'company',id:'company-1'}))
   .toEqual({kind:'company',id:'company-1'});
  expect(taskLinkedRecordPreview({type:'quote',id:'quote-1'}))
   .toEqual({kind:'quote',id:'quote-1'});
 });
 it('does not open a Record preview for Notebook navigation or empty links',()=>{
  expect(taskLinkedRecordPreview({type:'notebook',id:'notebook-1'})).toBeNull();
  expect(taskLinkedRecordPreview({type:'company',id:''})).toBeNull();
 });
 it('keeps the Task preview as the return point without stacking focus traps',()=>{
  const task=source('components/TaskModalHost.tsx');
  expect(task).toContain("request?.mode==='preview'&&!linkedPreview");
  expect(task).toContain("task&&!linkedPreview?<div");
  expect(task).toContain('const target=taskLinkedRecordPreview(link)');
  expect(task).toContain('if(target)setLinkedPreview(target)');
  expect(task).toContain("if(link.type==='notebook'){close();nav.openNotebookPage(link.id);return;}");
  expect(task).toContain('onClose={()=>setLinkedPreview(null)} onSelect={setLinkedPreview}');
  expect(task).toContain('returnToLabel="Task"');
  const preview=source('components/RecordPreviewDrawer.tsx');
  expect(preview).toContain("aria-label={'Back to '+returnToLabel}");
  expect(preview).toContain('onClick={onClose} aria-label={');
  expect(preview).toContain('onClick={backToRelated} aria-label="Back to previous related record"');
  expect(task).toContain("setLinkedPreview(null);setExternalDealId(null)");
  // The linked Record's local back trail is still available within its preview.
  const record=source('components/RecordPreviewDrawer.tsx');
  expect(record).toContain('setPreviewTrail(trail=>trail.slice(0,-1))');
  expect(record).toContain('onSelect(previous)');
 });
 it('only permits Activity edits for the same Activity and workspace key',()=>{
  const origin='org:shop:user:alex:activity:one';
  expect(activityEditorCanUseDraft(true,origin,origin,true)).toBe(true);
  expect(activityEditorCanUseDraft(false,origin,origin,true)).toBe(false);
  expect(activityEditorCanUseDraft(true,origin,'org:shop:user:alex:activity:two',true)).toBe(false);
  expect(activityEditorCanUseDraft(true,origin,'org:other:user:alex:activity:one',true)).toBe(false);
  expect(activityEditorCanUseDraft(true,origin,'org:shop:user:sam:activity:one',true)).toBe(false);
  expect(activityEditorCanUseDraft(true,origin,origin,false)).toBe(false);
  expect(activityEditorCanUseDraft(true,null,null,true)).toBe(false);
 });
 it('never stores old Activity fields under a new draft key during an inspector switch',()=>{
  const activity=source('components/CalendarActivityPreview.tsx');
  expect(activity).toContain('const [editorScopeKey,setEditorScopeKey]=useState<string|null>(null)');
  expect(activity).toContain('activityEditorCanUseDraft(editing,editorScopeKey,scopeKey,canEdit)');
  expect(activity).toContain('if(!activeEditing||!scopeKey)return;');
  expect(activity).toContain('writeSavedDraft(scopeKey,{method,occurred,notes,links,');
  expect(activity).toContain('setEditorScopeKey(scopeKey);setEditing(true)');
  expect(activity).toContain('setEditing(false);setEditorScopeKey(null);setError(\'\')');
  expect(activity).toContain('if(!activity||!activeEditing||saving)return;');
  expect(activity).toContain("{activeEditing?<form id=\"activity-preview-edit\"");
 });
 it('closes an Activity editor when its CRM editing right is withdrawn',()=>{
  const activity=source('components/CalendarActivityPreview.tsx');
  expect(activity).toContain('if(!canEdit&&editing){setEditing(false);setEditorScopeKey(null);');
  expect(activity).toContain('title={activeEditing?');
  expect(activity).toContain('aria-label={activeEditing?');
  expect(activity).toContain('onClick={()=>{setEditing(false);setEditorScopeKey(null);}}');
  expect(activity).toContain('clearSavedDraft(scopeKey);setEditing(false);setEditorScopeKey(null);');
 });
 it('reports a failed Task save without clearing the recoverable editor draft',()=>{
  const host=source('components/TaskModalHost.tsx');
  const editor=source('components/TasksWorkspace.tsx');
  expect(host).toContain("if(!newId)throw new Error('Task could not be saved.");
  expect(host).toContain('Your Task workspace changed. The unsaved Task draft was preserved.');
  expect(host).toContain('This Task is no longer available. The unsaved edit draft was preserved.');
  const start=editor.indexOf('const submit=(event:FormEvent)=>');
  const saveCall=editor.indexOf('onSave({title:title.trim()',start);
  const clear=editor.indexOf('clearSavedDraft(scopeKey);clearSavedDraft(activeKey)',saveCall);
  const catchError=editor.indexOf('}catch(reason){setFormError(',clear);
  expect(start).toBeGreaterThan(-1);
  expect(saveCall).toBeGreaterThan(start);
  expect(clear).toBeGreaterThan(saveCall);
  expect(catchError).toBeGreaterThan(clear);
  // Throwing from onSave skips draft cleanup and displays the error.
  expect(editor).toContain("reason instanceof Error?reason.message:'Unable to apply task changes. Draft preserved.'");
 });
 it('keeps Task completion guards consistent in the quick-view inspector',()=>{
  const task=source('components/TaskModalHost.tsx');
  expect(task).toContain("task.status==='canceled'||Boolean(taskCompletionBlocker(task))");
  expect(task).toContain("taskCompletionBlocker(task)==='incomplete-checklist'");
  expect(task).toContain("taskCompletionBlocker(task)==='bid-submission'");
  expect(task).toContain("task.status!=='canceled'&&!taskCompletionBlocker(task)");
  expect(task).toContain("!taskCompletionBlocker(task)&&");
 });
});
