import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Build #375 — minimal Deal People, local editing and History alignment',()=>{
 it('uses a permission-checked live Deal stage selector in the header',()=>{
  const deal=source('components/DealRecordPage.tsx');
  expect(deal).toContain('className="ss-deal-stage-control"');
  expect(deal).toContain('aria-label="Deal stage"');
  expect(deal).toContain('value={deal.stage} disabled={!canEditCrm}');
  expect(deal).toContain('onChange={event=>updateDeal(deal.id,{stage:event.target.value as ProjectStage})}');
  expect(deal).toContain('PROJECT_STAGES.map(stage');
 });
 it('puts Edit details inside About, not in the record header',()=>{
  for(const name of ['Deal','Company','Person']){
   const code=source('components/'+name+'RecordPage.tsx');
   const head=code.slice(code.indexOf('actions={<>'),code.indexOf('left={<>'));
   expect(head).not.toContain('Edit Page');
   expect(head).not.toContain('onUnlink');
   expect(code).toContain('Edit details');
   expect(code).toContain('<RecordInlineProperty');
  }
 });
 it('gives each relationship pane a local Manage links control and retains guarded unlink',()=>{
  const tab=source('components/RecordTabbedGroup372.tsx');
  expect(tab).toContain('tools?:ReactNode');
  expect(tab).toContain('selected.tools');
  for(const name of ['Deal','Person','Company']){
   const code=source('components/'+name+'RecordPage.tsx');
   expect(code).toContain('Done managing links');
   expect(code).toContain('Manage Quote links');
   expect(code).toContain('<RecordUnlinkAction');
  }
  const menu=source('components/RecordActionsMenu.tsx');
  expect(menu).not.toContain('Unlink connections');
  expect(menu).toContain('Delete record…');
 });
 it('clears empty Deal People instructions without losing direct or quote-linked contacts',()=>{
  const deal=source('components/DealRecordPage.tsx');
  const direct=source('components/DealPersonRelationships.tsx');
  const roles=source('components/PrivateDealContactRoles.tsx');
  expect(deal).not.toContain('Linked People from Quotes and Activities appear below');
  expect(deal).not.toContain('No contacts linked through Quotes or Activities.');
  expect(deal).toContain('<DealPeopleRelationships');
  expect(deal).toContain('Other linked People');
  expect(deal).toContain('!directIds.has(person.id)');
  expect(direct).not.toContain('Shared contact assignments. Link people');
  expect(direct).not.toContain('No direct contacts assigned yet.');
  expect(roles).toContain('if(!eligiblePeople.length||!scope)return null;');
 });
 it('keeps History transparent and date pinned on the right even with long subjects',()=>{
  const css=source('record-page-refinement.css');
  expect(css).toContain('grid-template-columns:minmax(0,1fr) max-content!important');
  expect(css).toContain('grid-column:2!important;grid-row:1!important');
  expect(css).toContain('white-space:nowrap!important');
  expect(css).toContain('background:transparent!important;background-color:transparent!important');
  expect(css).toContain('white-space:normal!important;overflow-wrap:anywhere!important');
 });
 it('offers explicit permission-checked Forecast editing with validated values',()=>{
  const company=source('components/CompanyRecordPage.tsx');
  const editor=source('components/CompanyForecastEditor375.tsx');
  expect(company).toContain('<CompanyForecastEditor375 company={company} canEdit={canEditRecord}/>');
  expect(editor).toContain('Edit forecast');
  expect(editor).toContain("integer:true");
  expect(editor).toContain("max:100");
  expect(editor).toContain("await updateCompany(company.id,values)");
  expect(editor).toContain('if(!canEdit||saving)return');
 });
});
