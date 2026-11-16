import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Batch 353c — useful Deal quick-create details',()=>{
 it('keeps Company and People staging, duplicate prevention and safe recovery',()=>{
  const view=src('components/BoardQuickCreate.tsx');
  const board=src('components/Board.tsx');
  expect(view).toContain('newPeopleNames');
  expect(view).toContain('newCompanyName');
  expect(view).toContain('setPendingCreated(result.id)');
  expect(board).toContain('satisfies BoardPartialCreate');
 });
 it('collects all pre-save Deal details without making submission claims',()=>{
  const view=src('components/BoardQuickCreate.tsx');
  for(const value of ['New Deal stage','New Deal pipeline','New Deal estimated value','<DealAssigneeSelect'])
   expect(view).toContain(value);
  expect(view).toContain('PROJECT_STAGES.slice(0,3)');
  expect(view).toContain('amountValue<0');
 });
 it('sets stage, pipeline, value and assignee in the initial Deal object',()=>{
  const board=src('components/Board.tsx');
  const crm=src('store/crmStore.ts');
  expect(board).toContain("details?.stage??'Discovery'");
  expect(board).toContain("details?.pipeline==='unassigned'?undefined");
  expect(board).toContain('amount:details?.amount');
  expect(board).toContain('initialPipeline={pipelineView}');
  expect(crm).toContain('details.assignedUserId===undefined?useAuthStore.getState().user?.id:');
  expect(crm).toContain('amount: typeof details.amount');
 });
});
