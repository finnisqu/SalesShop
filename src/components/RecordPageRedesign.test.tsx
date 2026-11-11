import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Board quick Deal creation and CRM record layout',()=>{
 it('keeps the desktop sections in the requested order',()=>{
  const app=source('src/App.tsx');
  const start=app.indexOf('<nav className="app-tabs"');
  const end=app.indexOf('</nav>',start);
  const tabMarkup=app.slice(start,end);
  const names=['Home','Board','Tasks','Connections','Quotes','Catalog','Notebook'];
  const indexes=names.map(name=>tabMarkup.indexOf('>'+name+'</button>'));
  expect(indexes.every(index=>index>=0)).toBe(true);
  expect(indexes).toEqual(indexes.slice().sort((a,b)=>a-b));
 });
 it('keeps the Board Deal name field and optional relationships in the same dialog',()=>{
  const quick=source('src/components/BoardQuickCreate.tsx');
  const board=source('src/components/Board.tsx');
  expect(quick).toContain('className="board-create-name-input"');
  expect(quick).toContain('More details');
  expect(quick).toContain('<UnifiedRecordPicker kind="Company"');
  expect(quick).toContain('<UnifiedRecordPicker kind="Person"');
  expect(quick).toContain('personIds,newPeopleNames');
  expect(quick).toContain('Bid due date');
  expect(quick).toContain('kind===\'Deal\'&&more?details:undefined');
  expect(quick).toContain('onCreate={value=>{setCompanyId');
  expect(quick).toContain('onCreate={name=>setNewPeopleNames');
  expect(board).toContain('const createDealWithDetails=async');
  expect(board).toContain('const id=createProject(name,\'Discovery\'');
  expect(board).toContain('if(details?.dueDate)updateProject(id,{dueDate:details.dueDate})');
  expect(board).toContain('await useDealPeopleStore.getState().add(id,personId)');
  expect(board).toContain('if(companyId)setProjectCompany(id,companyId)');
  // Creation is deferred until explicit submit. No record gets created on cancel.
  expect(quick).toContain('const id=await onCreate(');
 });
 it('keeps About values and pencil controls in the same compact property row',()=>{
  const content=source('src/components/RecordInlineProperty.tsx');
  expect(content).toContain('ss-record-inline-property');
  expect(content).toContain('ss-record-pencil');
  expect(content).toContain("aria-label={'Edit '+label}");
  expect(content).toContain('!editing?');
  expect(content).toContain("aria-label={'Save '+label}");
 });
 it('uses shared header tabs for the Recents Quotes/Activities panel',()=>{
  const content=source('src/components/RecordRecentsPanel.tsx');
  expect(content).toContain('role="tablist"');
  expect(content).toContain('role="tab"');
  expect(content).toContain("useState<'quotes'|'activities'>('quotes')");
  expect(content).toContain("tab==='quotes'?quotes:activities");
 });
 it('keeps Company and People on the right; Recents and Tasks in center',()=>{
  for(const page of ['CompanyRecordPage','DealRecordPage','PersonRecordPage']){
   const s=source('src/components/'+page+'.tsx');
   const center=s.slice(s.indexOf('center={<>'),s.indexOf('right={<>'));
   const right=s.slice(s.indexOf('right={<>'));
   expect(center.indexOf('<RecordRecentsPanel')).toBeGreaterThan(-1);
   expect(center.indexOf('<RecordTasksPanel')).toBeGreaterThan(center.indexOf('<RecordRecentsPanel'));
   expect(right).not.toContain('<RecordTasksPanel');
   expect(s).toContain('<RecordActionsMenu unlinking={unlinking}');
   expect(s).toContain('<RecordInlineProperty');
   expect(s).toContain('onUnlink={()=>');
  }
  const deal=source('src/components/DealRecordPage.tsx');
  const person=source('src/components/PersonRecordPage.tsx');
  expect(deal.slice(deal.indexOf('right={<>'))).toContain('<RecordCard title="Company"');
  expect(person.slice(person.indexOf('right={<>'))).toContain('<RecordCard title="Company"');
 });
 it('uses the same unlink button for private Tasks and direct Deal People',()=>{
  const tasks=source('src/components/RecordTasksPanel.tsx');
  const people=source('src/components/DealPersonRelationships.tsx');
  const menu=source('src/components/RecordActionsMenu.tsx');
  expect(tasks).toContain('isProtectedBidTask(task)');
  expect(tasks).toContain('normalizedTaskAssociations(task).filter(');
  expect(tasks).toContain('className="ss-record-unlink-button"');
  expect(people).toContain('const editingThisRole=editingRole===person.id');
  expect((people.match(/className="ss-record-unlink-button"/g)??[]).toHaveLength(2);
  expect(menu).toContain('Unlink connections');
  expect(menu).toContain('Delete record…');
  expect(menu).toContain('window.confirm(');
 });
});
