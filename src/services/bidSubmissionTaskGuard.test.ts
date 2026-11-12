import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(name:string)=>readFileSync(join(process.cwd(),name),'utf8');
const tasks=read('src/store/personalTaskStore.ts');
const crm=read('src/services/quoteCrmService.ts');
const external=read('src/components/ExternalQuoteSentForm.tsx');
const modal=read('src/components/TaskModalHost.tsx');
const workspace=read('src/components/TasksWorkspace.tsx');

describe('bid submission Task confirmation boundary',()=>{
 it('prevents direct Task completion without recorded submission proof',()=>{
  expect(tasks).toContain('isProtectedBidTask(original)');
  expect(tasks).toContain('delete patch.submissionConfirmedAt');
  expect(tasks).toContain('task.status!==\'completed\'&&proposed===\'completed\'');
  expect(tasks).toContain('submissionConfirmedAt:task.submissionConfirmedAt??timestamp');
  expect(tasks).not.toContain('return submitted\n');
 });
 it('records proof after delivery, not merely issue',()=>{
  const delivered=crm.slice(crm.indexOf('export function recordQuoteDelivered('),
   crm.indexOf('export function applyQuoteStatusChange('));
  const issued=crm.slice(crm.indexOf('export function applyQuoteSent('),
   crm.indexOf('export function recordQuoteDelivered('));
  expect(delivered).toContain('completeDealSubmissionTasks(project.id)');
  expect(delivered).toContain('if(quote.projectId===project.id)');
  expect(issued).not.toContain('completeDealSubmissionTasks(');
  expect(external).toContain('if(!historical)completeSubmissionTasks(deal.id)');
  expect(external).toContain('if(!saved)');
 });
 it('offers the correct proof actions in both quick views',()=>{
  for(const view of [modal,workspace]){
   expect(view).toContain('isProtectedBidTask(');
   expect(view).toContain('Record external quote');
   expect(view).toContain('Open linked Deal ↗');
   expect(view).toContain('Open linked Quote ↗');
   expect(view).toContain('<TaskPreviewDueControls');
   expect(view).toContain('Complete · quote required');
   expect(view).toContain('initialDealId={externalDealId}');
   expect(view).toContain('<PencilIcon/> Edit');
   expect(view).toContain('tasks-preview-actions-left');
   expect(view).toContain('tasks-preview-actions-right');
  }
 });
});
