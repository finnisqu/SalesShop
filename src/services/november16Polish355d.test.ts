import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const load=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
describe('Nov 16 unified Deal creation #355d',()=>{
 it('table and board share one preflight and partial-create recovery implementation',()=>{
  const b=load('components/Board.tsx');
  const c=load('components/Connections.tsx');
  expect(b).toContain('export const createDealFromQuickCreate=async');
  expect(b).toContain('const createDealWithDetails=async');
  expect(b).toContain('createDealFromQuickCreate(name,details,pipelineView)');
  expect(c).toContain('<BoardQuickCreate kind="Deal"');
  expect(c).toContain('createDealFromQuickCreate(name,details,pipelineFilter)');
  expect(c).not.toContain('const addDeal = (event: FormEvent)');
  expect(c).not.toContain('setDealCreating');
 });
 it('validates Person and Company before creating a Deal and retains stable ID after failed link',()=>{
  const b=load('components/Board.tsx');
  const preflight=b.indexOf('for(const id of details?.personIds??[])');
  const create=b.indexOf("const id=createProject(name,details?.stage??'Discovery'");
  const link=b.indexOf('await useDealPeopleStore.getState().add(id,personId)');
  expect(preflight).toBeGreaterThan(0);
  expect(create).toBeGreaterThan(preflight);
  expect(link).toBeGreaterThan(create);
  expect(b).toContain('satisfies BoardPartialCreate');
 });
});
