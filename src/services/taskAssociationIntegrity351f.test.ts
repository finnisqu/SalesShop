import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {TaskAssociation} from '../store/personalTaskStore';
import {unavailableTaskAssociations,unavailableAssociationSaveError,
 replaceTaskAssociation} from './taskAssociationIntegrity351f';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const person:TaskAssociation={type:'contact',id:'p-1',label:'Person · Jamie Lee'};
const company:TaskAssociation={type:'company',id:'c-1',label:'Company · Cedar Builder'};
const deal:TaskAssociation={type:'project',id:'d-1',label:'Deal · Cedar Units'};
const quote:TaskAssociation={type:'quote',id:'q-1',label:'Quote · Unit A'};
const option=(type:string,id:string)=>({key:type+':'+id});

describe('Batch 351f — Task and Activity unavailable relationship integrity',()=>{
 it('does not report missing People before CRM hydration',()=>{
  expect(unavailableTaskAssociations([person],[],{contact:false})).toEqual([]);
  expect(unavailableTaskAssociations([person],[],{})).toEqual([]);
 });
 it('detects deleted/inaccessible links only after their collection is verified',()=>{
  expect(unavailableTaskAssociations([person,company,deal],
   [option('contact','p-1')],{contact:true,company:true,project:true}))
   .toEqual([company,deal]);
 });
 it('checks identity by record type AND exact ID, never by name or bare ID',()=>{
  expect(unavailableTaskAssociations([person,company],
   [option('company','p-1'),option('contact','c-1')],
   {contact:true,company:true})).toEqual([person,company]);
  expect(unavailableTaskAssociations([person],[option('contact','p-1')],
   {contact:true})).toEqual([]);
 });
 it('validates Quote availability independently from CRM hydration',()=>{
  expect(unavailableTaskAssociations([person,quote],
   [option('contact','p-1')],{contact:true,quote:false})).toEqual([]);
  expect(unavailableTaskAssociations([person,quote],
   [option('contact','p-1')],{contact:true,quote:true})).toEqual([quote]);
 });
 it('never treats Notebook references as missing without notebook readiness',()=>{
  const notebook:TaskAssociation={type:'notebook',id:'page-1',label:'Notebook · Nov 15'};
  expect(unavailableTaskAssociations([notebook],[],{contact:true,company:true})).toEqual([]);
  expect(unavailableTaskAssociations([notebook],[],{notebook:true})).toEqual([notebook]);
 });
 it('reports a duplicated stale relationship once rather than multiplying warnings',()=>{
  expect(unavailableTaskAssociations([deal,{...deal}],[],{project:true})).toEqual([deal]);
 });
 it('replaces a missing reference at its original position with the new real ID',()=>{
  const newCompany:TaskAssociation={type:'company',id:'c-2',label:'Company · Maple Co'};
  const replaced=replaceTaskAssociation([person,company,deal],'company:c-1',newCompany);
  expect(replaced).toEqual([person,newCompany,deal]);
  expect(replaced).not.toContain(company);
  expect(company.id).toBe('c-1');
 });
 it('refuses duplicate replacements and never silently deletes existing links',()=>{
  expect(replaceTaskAssociation([person,company],'company:c-1',person)).toEqual([person,company]);
  expect(replaceTaskAssociation([person],'company:does-not-exist',company))
   .toEqual([person,company]);
 });
 it('leaves all links unchanged when a replacement search is cancelled',()=>{
  const before=[person,company,deal];
  expect(before).toHaveLength(3);
  // The UI records a replacingKey but only invokes the pure replacement
  // helper after a user actually selects a different available record.
  const field=source('components/TaskAssociationsField.tsx');
  expect(field).toContain('setReplacingKey(taskAssociationKey(link));');
  expect(field).toContain('replacingKey?replaceTaskAssociation(value,replacingKey,next)');
  expect(field).toContain("setOpen(false);setReplacingKey(null);");
 });
 it('gives actionable singular/plural errors without removing the draft',()=>{
  expect(unavailableAssociationSaveError([])).toBeNull();
  expect(unavailableAssociationSaveError([person])).toContain('1 related record is unavailable');
  expect(unavailableAssociationSaveError([person,company])).toContain('2 related records are unavailable');
  expect(unavailableAssociationSaveError([person])).toContain('Your draft is preserved.');
 });
 it('shows unavailable chips and provides explicit Remove/Replace controls',()=>{
  const picker=source('components/TaskAssociationsField.tsx');
  const styles=source('task-association-popover.css');
  expect(picker).toContain('unavailableTaskAssociations(value,options,verifiedTypes)');
  expect(picker).toContain('className="tasks-associations-unavailable" role="status"');
  expect(picker).toContain("' is-unavailable'");
  expect(picker).toContain('Unlink {unavailable.length===1?');
  expect(picker).toContain('onClick={()=>replace(link)}');
  expect(picker).toContain('onChange(value.filter(link=>!unavailableKeys.has(taskAssociationKey(link))))');
  expect(styles).toContain('.tasks-association-chip.is-unavailable');
  expect(styles).toContain('.tasks-associations-unavailable');
  expect(styles).toContain('min-height:44px');
 });
 it('blocks stale Task links on Save, after each collection has hydrated',()=>{
  const workspace=source('components/TasksWorkspace.tsx');
  expect(workspace).toContain('const crmHydrated=useCrmStore(s=>s.hydrated)');
  expect(workspace).toContain('const quoteHydrated=useQuoteStore(s=>s.hydrated)');
  expect(workspace).toContain('const notebookHydrated=useNotebookStore(s=>s.hydrated)');
  expect(workspace).toContain('const unavailable=unavailableTaskAssociations(selectedLinks,associations,verifiedTypes);');
  expect(workspace).toContain('if(linkError){setFormError(linkError);return;}');
  expect(workspace).toContain('verifiedTypes={verifiedTypes}');
  const guard=workspace.indexOf('const unavailable=unavailableTaskAssociations(');
  expect(guard).toBeGreaterThan(0);
  expect(workspace.indexOf('onSave({title:',guard)).toBeGreaterThan(guard);
  expect(workspace).toContain('writeSavedDraft(scopeKey,{');
 });
 it('preserves logged Activity retries and repairs only not-yet-saved relationships',()=>{
  const activity=source('components/QuickActivityLauncher.tsx');
  const preview=source('components/CalendarActivityPreview.tsx');
  expect(activity).toContain('if(!loggedPendingActivity){');
  expect(activity).toContain('unavailableTaskAssociations(links,options,verifiedTypes)');
  expect(activity).toContain('if(linkError)return setError(linkError);');
  expect(activity).toContain('verifiedTypes={verifiedTypes}');
  expect(activity).toContain('const loggedId=recordActivityOnce(');
  expect(preview).toContain('unavailableTaskAssociations(links,options,verifiedTypes)');
  expect(preview).toContain('if(linkError){setError(linkError);return;}');
  expect(preview).toContain('verifiedTypes={verifiedTypes}');
  expect(preview).toContain('clearSavedDraft(scopeKey);setEditing(false);');
 });
});
