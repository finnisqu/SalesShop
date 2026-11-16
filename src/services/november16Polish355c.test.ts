import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const load=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
describe('Nov 16 Board header consolidation #355c',()=>{
 it('embedded Boards use only the page-header create control',()=>{
  const connections=load('components/Connections.tsx');
  const board=load('components/Board.tsx'),accounts=load('components/AccountsBoard.tsx');
  expect(connections).toContain("new Event('salesshop:board-header-create')");
  expect(board).toContain('hideLauncher launchEvent="salesshop:board-header-create"');
  expect(accounts).toContain('launchEvent="salesshop:board-header-create"');
  expect(board).not.toContain('className="connections-board-tools"');
  expect(accounts).not.toContain('className="connections-board-tools"');
 });
 it('header owns Board filters and compact mode',()=>{
  const connections=load('components/Connections.tsx');
  expect(connections).toContain('label="Board options"');
  expect(connections).toContain("choosePipelineFilter('all')");
  expect(connections).toContain("chooseCompanyFilter(item)");
  expect(connections).toContain('salesshop:toggle-embedded-board-compact');
 });
 it('does not remove partial-link recovery when hiding the launcher',()=>{
  const src=load('components/BoardQuickCreate.tsx');
  expect(src).toContain('hideLauncher');
  expect(src).toContain('setPendingCreated(result.id)');
 });
});
