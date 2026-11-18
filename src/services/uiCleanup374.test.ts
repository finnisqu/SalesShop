import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {decodeInlineRecordText,encodeInlineRecordText,isInlineRecordTextPage}
 from '../components/RecordNotebookPanel374';
import type {NotebookEntry} from '../types/notebook';
const code=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Build #374 — Records layout and record-linked inline Notebook',()=>{
 it('round-trips typed text safely without turning symbols into HTML',()=>{
  const typed='Hello <builder> & team\nFollow up on "units" and the customer’s notes.';
  const html=encodeInlineRecordText(typed);
  expect(html).toContain('&lt;builder&gt; &amp; team<br/>Follow');
  expect(decodeInlineRecordText(html)).toBe(typed);
 });
 it('allows only record-created simple text pages to be edited inline',()=>{
  const entry={id:'page_record_inline_abc',contentHtml:'<p>Safe</p>',
    strokes:[],objects:[]} as unknown as NotebookEntry;
  expect(isInlineRecordTextPage(entry)).toBe(true);
  expect(isInlineRecordTextPage({...entry,id:'page_older'})).toBe(false);
  expect(isInlineRecordTextPage({...entry,objects:[{id:'o'} as never]})).toBe(false);
  expect(isInlineRecordTextPage({...entry,contentHtml:'<div>Rich</div>'})).toBe(false);
 });
 it('creates a linked Notebook page without hijacking the open Notebook document',()=>{
  const store=code('store/notebookStore.ts');
  expect(store).toContain('createRecordLinkedEntry: (input) =>');
  expect(store).toContain("id:id('page_record_inline')");
  expect(store).toContain("input.kind==='person'?{contactId:input.id}:{projectId:input.id}");
  expect(store).toContain('persist(entries,get().activeEntryId)');
  expect(store).toContain('set({entries,...historyFlags()});');
 });
 it('uses one record-aligned About, Files, Notebook etc tab panel on each left column',()=>{
  const person=code('components/PersonRecordPage.tsx');
  const company=code('components/CompanyRecordPage.tsx');
  const deal=code('components/DealRecordPage.tsx');
  expect(person).toContain('title={displayName} personalTarget="person" initialTab="about"');
  expect(company).toContain('title={company.name} personalTarget="company" initialTab="about"');
  expect(deal).toContain('title={deal.name} personalTarget="deal" initialTab="about"');
  expect(company).not.toContain("label:'Files & folders'");
  expect(company).not.toContain("label:'Notebook pages'");
  for(const [source,kind] of [[person,'person'],[company,'company'],[deal,'deal']] as const){
   expect(source).toContain('kind="'+kind+'"');
   expect(source).toContain('<RecordNotebookPanel374');
  }
 });
 it('prevents duplicate Person company badge and improves contact methods',()=>{
  const person=code('components/PersonRecordPage.tsx');
  expect(person).toContain('badge={isInternal?<span>Internal contact</span>:null}');
  expect(person).toContain('RecordContactIcon374 kind="call"');
  expect(person).toContain('RecordContactIcon374 kind="text"');
  expect(code('components/RecordContactIcon374.tsx')).toContain("kind==='text'?");
 });
 it('enforces natural header order and uniformly scrollable columns',()=>{
  const css=code('connections-record-pages.css');
  expect(css).toContain('display:flex!important;flex-direction:column!important');
  expect(css).toContain('>.connections-record-breadcrumb');
  expect(css).toContain('order:0!important');
  expect(css).toContain('order:1!important');
  expect(css).toContain('order:3!important');
  expect(css).toContain('overflow-x:hidden!important;overflow-y:auto!important');
  expect(css).toContain('grid-template-columns:minmax(88px,38%) minmax(0,1fr)');
 });
 it('keeps History free of nested horizontal filter and list scrollbars',()=>{
  const css=code('components/company-relationship-timeline.css');
  expect(css).toContain('flex-wrap:wrap!important;overflow-x:visible!important');
  expect(css).toContain('max-height:none!important;overflow:visible!important');
  const refined=code('record-page-refinement.css');
  expect(refined).toContain('.ss-record-tabbed-body .ss-deal-relations');
  expect(refined).toContain('max-height:none!important;overflow:visible!important');
  expect(code('components/DealPersonRelationships.tsx'))
   .toContain('<strong>Deals</strong><span>{direct.length}</span>');
 });
});
