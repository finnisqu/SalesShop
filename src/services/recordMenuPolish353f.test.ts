import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Batch 353f — Task follow-up and record action grouping',()=>{
 it('both Task previews provide the same optional next follow-up flow',()=>{
  const global=source('components/TaskModalHost.tsx');
  const workspace=source('components/TasksWorkspace.tsx');
  expect(global).toContain('Complete + Log');
  expect(workspace).toContain('Complete + Log');
  expect(global).toContain('planFollowUp:true');
  expect(workspace).toContain('planFollowUp:true');
 });
 it('record menus limit global actions to deletion; unlinking is record-panel scoped',()=>{
  const menu=source('components/RecordActionsMenu.tsx');
  expect(menu).not.toContain('ss-record-actions-label">Connections');
  expect(menu).toContain('ss-record-actions-label">Record');
  expect(menu).not.toContain('onUnlink');
   for(const page of ['CompanyRecordPage','PersonRecordPage','DealRecordPage']){
    const content=source('components/'+page+'.tsx');
    expect(content).toContain('Manage links');
    expect(content).toContain('<RecordUnlinkAction');
   }
  expect(menu).toContain('window.confirm(');
  expect(menu).not.toContain('Archive record');
  expect(source('record-page-refinement.css')).toContain('.ss-record-actions-label.is-separated');
 });
});
