import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {BoardQuickCreate} from '../components/BoardQuickCreate';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Board display and quick creation',()=>{
 const board=source('src/components/Board.tsx');
 const accounts=source('src/components/AccountsBoard.tsx');
 const quick=source('src/components/BoardQuickCreate.tsx');
 const css=source('src/board-layout-v3.css');
 const main=source('src/main.tsx');
 it('keeps both name-only create actions on the Board instead of navigating',()=>{
  expect(board).toContain('<BoardQuickCreate kind="Deal"');
  expect(accounts).toContain('<BoardQuickCreate kind="Account"');
  expect(board).toContain('onCreate={name=>createProject(name)}');
  expect(accounts).toContain("onCreate={name=>resolveCompany(name,'customer')}");
  expect(quick).toContain('onCreate(clean)');
  expect(quick).not.toContain('openCompany(');
  expect(quick).not.toContain('openProject(');
  expect(quick).not.toContain('navigate(');
  expect(board).not.toContain('setEditingId(projectId)');
  const dealHtml=renderToStaticMarkup(<BoardQuickCreate kind="Deal" onCreate={()=>null}/>);
  const accountHtml=renderToStaticMarkup(<BoardQuickCreate kind="Account" onCreate={()=>null}/>);
  expect(dealHtml).toContain('+ Deal');
  expect(accountHtml).toContain('+ Account');
 });
 it('shares a persisted compact-card preference across Accounts and Deals',()=>{
  expect(board).toContain('BOARD_COMPACT_KEY');
  expect(board).toContain('BOARD_COLLAPSED_KEY');
  expect(board).toContain('onToggleCompact={toggleCompact}');
  expect(board).toContain("isStageCollapsed('projects',stage)");
  expect(board).toContain("isStageCollapsed('accounts',stage)");
  expect(accounts).toContain('onToggleCompact={onToggleCompact}');
  expect(board).toContain('aria-pressed={compactCards}');
  expect(accounts).toContain('aria-pressed={compactCards}');
  expect(css).toContain('.board-view.is-compact');
 });
 it('supports accessible, reversible collapse controls on both board lenses',()=>{
  expect(board).toContain('aria-expanded={!collapsed}');
  expect(accounts).toContain('aria-expanded={!collapsed}');
  expect(board).toContain('Collapse ');
  expect(accounts).toContain('Expand ');
  expect(css).toContain('.board-column.is-collapsed');
  expect(css).toContain('writing-mode:vertical-rl');
  expect(css).toContain('.board-column.is-collapsed :is(.board-column-rule,.board-card-stack)');
 });
 it('fits stage mats to desktop viewport and scrolls cards independently',()=>{
  expect(css).toContain('.role-perspective-content');
  expect(css).toContain('overflow-x:auto;overflow-y:hidden');
  expect(css).toContain('overflow-x:hidden;overflow-y:auto');
  expect(css).toContain('flex:1 1 0;height:0;min-height:0');
  expect(css).toContain('max-height:100%');
  expect(css).toContain('scrollbar-gutter:stable');
  expect(main).toContain("import './board-layout-v3.css'");
 });
 it('removes redundant Accounts stage badges and cleanup controls but retains stage reasoning in details',()=>{
  expect(accounts).not.toContain('accounts-inference-note');
  expect(accounts).not.toContain('CrmCleanupPanel');
  expect(accounts).not.toContain('accounts-cleanup-button');
  expect(accounts).not.toContain('className="project-card-company">{health.stage}');
  expect(accounts).toContain('health.reason');
  expect(accounts).toContain('inferAccountHealth');
 });
});
