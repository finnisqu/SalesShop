import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source = path => readFileSync(join(process.cwd(),path),'utf8');
const contains = (text, pieces) => pieces.every(piece=>text.includes(piece));
const app=source('src/App.tsx');
const start=app.indexOf('<nav className="app-tabs"');
const tabs=app.slice(start,app.indexOf('</nav>',start));
const names=['Home','Board','Tasks','Connections','Quotes','Catalog','Notebook'];
const positions=names.map(name=>tabs.indexOf('>'+name+'</button>'));
assert(positions.every(position=>position>=0),'Missing desktop navigation item');
assert.deepEqual(positions,[...positions].sort((a,b)=>a-b),'Incorrect desktop navigation order');

const quick=source('src/components/BoardQuickCreate.tsx');
assert(contains(quick,[
  'className="board-create-name-input"','More details',
  '<UnifiedRecordPicker kind="Company"','<UnifiedRecordPicker kind="Person"',
  'personIds,newPeopleNames','Bid due date',
  "kind==='Deal'&&more?details:undefined",
  'onCreate={value=>{setCompanyId',
  'onCreate={name=>setNewPeopleNames',
  'const id=await onCreate('
]),'Board Deal quick-create details are incomplete');

const board=source('src/components/Board.tsx');
assert(contains(board,[
  'const createDealWithDetails=async',
  "const id=createProject(name,'Discovery'",
  'if(details?.dueDate)updateProject(id,{dueDate:details.dueDate})',
  'await useDealPeopleStore.getState().add(id,personId)',
  'if(companyId)setProjectCompany(id,companyId)'
]),'Board Deal relationship persistence changed');

const inline=source('src/components/RecordInlineProperty.tsx');
assert(contains(inline,[
  'ss-record-inline-property','ss-record-pencil',
  "aria-label={'Edit '+label}",'!editing?',
  "aria-label={'Save '+label}"
]),'Inline property editor changed');

const recents=source('src/components/RecordRecentsPanel.tsx');
assert(contains(recents,[
  'role="tablist"','role="tab"',
  "useState<'quotes'|'activities'>('quotes')",
  "tab==='quotes'?quotes:activities"
]),'Recents tabs changed');

for(const page of ['CompanyRecordPage','DealRecordPage','PersonRecordPage']){
  const content=source('src/components/'+page+'.tsx');
  const center=content.slice(content.indexOf('center={<>'),content.indexOf('right={<>'));
  const right=content.slice(content.indexOf('right={<>'));
  assert(center.includes('<RecordRecentsPanel'),page+' missing center Recents');
  assert(center.indexOf('<RecordTasksPanel')>center.indexOf('<RecordRecentsPanel'),page+' Tasks not in center after Recents');
  assert(!right.includes('<RecordTasksPanel'),page+' Tasks duplicated in right column');
  assert(contains(content,['<RecordActionsMenu unlinking={unlinking}','<RecordInlineProperty','onUnlink={()=>']),page+' missing edit/unlink assets');
}
for(const page of ['DealRecordPage','PersonRecordPage'])
  assert(source('src/components/'+page+'.tsx').split('right={<>')[1].includes('<RecordCard title="Company"'),
    page+' missing right-column Company');

const tasks=source('src/components/RecordTasksPanel.tsx');
assert(contains(tasks,[
  'isProtectedBidTask(task)','normalizedTaskAssociations(task).filter(',
  'className="ss-record-unlink-button"'
]),'Task unlink protections changed');
const people=source('src/components/DealPersonRelationships.tsx');
assert(people.includes('const editingThisRole=editingRole===person.id'),'Direct person role edit changed');
assert.equal((people.match(/className="ss-record-unlink-button"/g)||[]).length,2,
  'People unlink control mismatch');
const menu=source('src/components/RecordActionsMenu.tsx');
assert(contains(menu,['Unlink connections','Delete record…','window.confirm(']),
  'Record actions delete/unlink protections changed');

process.stdout.write('Board and record-page source regression gate passed.\\n');
