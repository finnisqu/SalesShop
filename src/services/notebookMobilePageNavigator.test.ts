import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Notebook single-page mobile header and paper alignment',()=>{
 it('replaces the Agenda header tab with a dynamic page navigator',()=>{
  const app=read('src/App.tsx');
  expect(app).toContain('mobileTabs={notebookPageOptions}');
  expect(app).toContain('mobileTabValue={entry.id}');
  expect(app).toContain('onMobileTabChange={openPrimary}');
  expect(app).toContain('notebook-header-page-navigator');
  expect(app).toContain('aria-label="Choose Notebook page"');
  expect(app).not.toContain('notebookHeaderSection');
  expect(app).not.toContain("{value:'agenda',label:'Agenda'}");
  expect(app).toContain("candidate.title.toLowerCase().includes(search)");
 });
 it('disables Split View for phone-sized screens without erasing desktop preferences',()=>{
  const app=read('src/App.tsx');
  expect(app).toContain("window.matchMedia('(max-width:820px)')");
  expect(app).toContain('const companion = !notebookCompact');
  expect(app).toContain('if(notebookCompact)return;');
  expect(app).toContain('{!notebookCompact&&<Sidebar');
  expect(app).toContain('{!notebookCompact&&<div className="notebook-split-controls">');
  expect(app).toContain('more={notebookCompact?<SalesCalendarLauncher compact label="Notebook calendar"/>');
  expect(app).toContain('writeNotebookSplitPreference(splitScope,{rightId:companionId,stacked:splitStacked})');
  expect(app).toContain('onClick={()=>useNotebookStore.getState().createEntry()}');
 });
 it('uses the same 32px text baseline and background rule cadence on desktop and mobile',()=>{
  const css=read('src/notebook-responsive-polish.css');
  expect(css).toContain('--notebook-rule-step:32px');
  expect(css).toContain('line-height:var(--notebook-rule-step)!important');
  expect(css).toContain('background-position:0 0!important');
  expect(css).toContain('var(--notebook-rule-step) - 1px');
  expect(css).toContain('.paper-sheet:is(.paper-lined,.paper-cornell,.paper-two-column)');
  expect(css).toContain('.paper-sheet.paper-grid');
  expect(read('src/main.tsx')).toContain("import './notebook-responsive-polish.css'");
 });
});
