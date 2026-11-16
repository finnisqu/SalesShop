import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 recordViewsStorageKey,readSavedRecordViews,normalizeSavedRecordViews,
 createSavedRecordView,updateSavedRecordView,removeSavedRecordView,
 savedRecordViewMatches,MAX_SAVED_RECORD_VIEWS,
 type SavedRecordView,
} from './recordSavedViews352a';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const available=['name','industry','email','updated','status'];
const allowed=[10,25,50,100];
const fallback={key:'name',reverse:false};
const layout={columns:['name','industry'],sort:{key:'updated',reverse:true},pageSize:25};
const view=(id='v1',name='Builder contacts'):SavedRecordView=>
 ({id,name,...layout,sort:{...layout.sort},columns:[...layout.columns]});

describe('Batch 352a — named Records view presets',()=>{
 it('isolates user and organization preferences while preserving each Records directory',()=>{
  const a=recordViewsStorageKey('companies','cloud','org-1','user-1');
  expect(a).not.toBe(recordViewsStorageKey('people','cloud','org-1','user-1'));
  expect(a).not.toBe(recordViewsStorageKey('companies','cloud','org-1','user-2'));
  expect(a).not.toBe(recordViewsStorageKey('companies','cloud','org-2','user-1'));
  expect(a).not.toBe(recordViewsStorageKey('companies','local',null));
  expect(a).toContain('salesshop-record-views-v1:');
 });
 it('restores named layout and sort without mutating source columns',()=>{
  const input=JSON.stringify([view()]);
  const result=readSavedRecordViews(input,available,fallback,allowed,25);
  expect(result).toEqual([view()]);
  expect(result[0].columns).not.toBe(layout.columns);
  expect(available).toEqual(['name','industry','email','updated','status']);
 });
 it('ignores corrupt or malformed storage safely and preserves the required Name column',()=>{
  expect(readSavedRecordViews('{broken',available,fallback,allowed,25)).toEqual([]);
  const parsed=normalizeSavedRecordViews([
   {id:'v1',name:'   Empty   ',columns:['removed','industry','industry'],sort:{key:'removed',reverse:true},pageSize:999},
   {id:null,name:'bad'},null,{id:'v2',name:'   '},
  ],available,fallback,allowed,25);
  expect(parsed).toEqual([{
   id:'v1',name:'Empty',columns:['name','industry'],
   sort:{key:'name',reverse:true},pageSize:25,
  }]);
 });
 it('discards duplicate ID or name records from untrusted storage',()=>{
  const restored=normalizeSavedRecordViews([
   view('v1','Builder contacts'),view('v1','Other name'),view('v2','builder CONTACTS'),
   view('v3','Other name'),
  ],available,fallback,allowed,25);
  expect(restored.map(row=>row.id)).toEqual(['v1','v3']);
 });
 it('creates independently named views with a bound and case-insensitive names',()=>{
  const a=createSavedRecordView([],'  Sales outreach  ','one',layout);
  expect(a[0].name).toBe('Sales outreach');
  const b=createSavedRecordView(a,'Admin follow-ups','two',layout);
  expect(b).toHaveLength(2);
  expect(()=>createSavedRecordView(b,' SALES OUTREACH ','three',layout)).toThrow('already exists');
  expect(()=>createSavedRecordView(a,'    ','three',layout)).toThrow('Enter a name');
  expect(()=>createSavedRecordView(a,'Duplicate ID','one',layout)).toThrow('unique view ID');
  expect(a).toHaveLength(1);
 });
 it('enforces a maximum of twelve presets per directory without deleting existing presets',()=>{
  const many=Array.from({length:MAX_SAVED_RECORD_VIEWS},(_,i)=>view('v'+i,'View '+i));
  expect(()=>createSavedRecordView(many,'One more','new',layout)).toThrow('up to 12');
  expect(many).toHaveLength(12);
 });
 it('updates a saved layout while keeping its name, ID and other views unchanged',()=>{
  const before=[view('one','Outreach'),view('two','Active bids')];
  const updated=updateSavedRecordView(before,'one',{
   columns:['name','email','status'],sort:{key:'name',reverse:false},pageSize:50,
  });
  expect(updated[0]).toMatchObject({
   id:'one',name:'Outreach',columns:['name','email','status'],
   sort:{key:'name',reverse:false},pageSize:50,
  });
  expect(updated[1]).toBe(before[1]);
  expect(before[0].columns).toEqual(['name','industry']);
 });
 it('deletes only the requested preset, without touching the table layout or records',()=>{
  const before=[view('one','Outreach'),view('two','Active bids')];
  expect(removeSavedRecordView(before,'one')).toEqual([before[1]]);
  expect(removeSavedRecordView(before,'missing')).toEqual(before);
  expect(before).toHaveLength(2);
 });
 it('reports unsaved layout modifications precisely including column order',()=>{
  const original=view();
  expect(savedRecordViewMatches(original,layout)).toBe(true);
  expect(savedRecordViewMatches(original,{...layout,columns:['industry','name']})).toBe(false);
  expect(savedRecordViewMatches(original,{...layout,sort:{...layout.sort,reverse:false}})).toBe(false);
  expect(savedRecordViewMatches(original,{...layout,pageSize:50})).toBe(false);
 });
 it('integrates the reusable menu into the Records worktable, preserving existing controls',()=>{
  const table=src('components/ConnectionsTable.tsx');
  const css=src('connections-table.css');
  const gate=src('../package.json');
  expect(table).toContain("const recordViewsScope=recordViewsStorageKey(tableKey,authMode,organizationId,userId);");
  expect(table).toContain('useWorktableDirectoryState<SavedRecordView[]>(recordViewsScope,');
  expect(table).toContain('readSavedRecordViews(localStorage.getItem(scope),');
  expect(table).toContain('const applySavedView=(view:SavedRecordView)=>');
  expect(table).toContain('setKeys(view.columns);');
  expect(table).toContain('setSort({tableKey,...view.sort});');
  expect(table).toContain('setPageSize(view.pageSize);');
  expect(table).toContain('setSelected([]);');
  expect(table).toContain('createSavedRecordView(savedViews,newViewName,id,currentViewLayout)');
  expect(table).toContain('updateSavedRecordView(current,selectedView.id,currentViewLayout)');
  expect(table).toContain('removeSavedRecordView(current,view.id)');
  expect(table).toContain('savedRecordViewMatches(selectedView,currentViewLayout)');
  expect(table).toContain('ref={viewsMenuRef}');
  expect(table).toContain('useDismissibleDetails(viewsMenuRef)');
  expect(table).toContain('useViewportBoundDetails(viewsMenuRef)');
  expect(table).toContain('<details className="connections-columns-menu" ref={columnsMenuRef}>');
  expect(table).toContain('onClick={()=>setKeys(columns.map(c=>c.key))}>Reset columns</button>');
  expect(css).toContain('.connections-views-popover');
  expect(css).toContain('.connections-views-current');
  expect(css).toContain('min-height:44px;');
  expect(gate).toContain('recordSavedViews352a.test.ts');
 });
});
