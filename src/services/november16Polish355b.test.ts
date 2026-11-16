import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const load=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
describe('Nov 16 workflow polish #355b',()=>{
 it('Deal and Company create no Quote before template/name confirmation',()=>{
  for(const name of ['DealRecordPage','CompanyRecordPage']){
   const file=load('components/'+name+'.tsx');
   expect(file).toContain('openGuidedQuoteCreation({kind:');
   expect(file).not.toContain('const createQuote = useQuoteStore(');
  }
  expect(load('components/QuotesMobileBeta.tsx')).toContain("if(!title){setError('Enter a document name");
 });
 it('Home Today shortcut respects private scope and protected bid deadlines',()=>{
  const s=load('components/SalesCalendarLauncher.tsx');
  expect(s).toContain("task.dueDate!==today&&!isProtectedBidTask(task)&&storedScope===personal");
  expect(s).toContain("updateTask(task.id,{dueDate:today})");
 });
 it('Settings has one shared header and no duplicate PageHeader',()=>{
  const s=load('components/CompanySettings.tsx');
  expect(s).toContain('<WorkspaceHeader title="Settings"');
  expect(s).toContain('<SectionTabs className="settings-header-tabs');
  expect(s).not.toContain('<PageHeader');
 });
});
