import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('CRM record page action and relationship parity',()=>{
 it('shows the shared three primary actions on Company, Person and Deal records',()=>{
  for(const page of ['CompanyRecordPage','PersonRecordPage','DealRecordPage']){
   const content=source('src/components/'+page+'.tsx');
   expect(content).toContain('Edit Page');
   expect(content).toContain('Log Activity');
   expect(content).toContain('<QuickCreate context={{kind:');
   expect(content).toContain('launcherLabel="+ New"');
   expect(content).toContain('editing');
  }
  const deal=source('src/components/DealRecordPage.tsx');
  const header=deal.slice(deal.indexOf('actions={<>'),deal.indexOf('left={<>'));
  expect(header).not.toContain('Project timeline');
  expect(header).not.toContain('Record external quote');
  expect(deal).toContain('Record external quote');
 });
 it('binds contextual Task, Activity, Quote and Notebook creation to the source record',()=>{
  const create=source('src/components/QuickCreate.tsx');
  const guide=source('src/services/quoteCreationNavigation.ts');
  const quotes=source('src/components/QuotesMobileBeta.tsx');
  expect(create).toContain('contextTaskAssociation(context)');
  expect(create).toContain('requestTaskModal({mode:\'create\',...(context?{associations:');
  expect(create).toContain('openGuidedQuoteCreation(context)');
  expect(create).toContain('setNotebookRelatedRecord(pageId,context)');
  expect(guide).toContain('readQuoteCreateAssociation()');
  expect(quotes).toContain('const association=readQuoteCreateAssociation()');
  expect(quotes).toContain('...linkedPatch');
  expect(quotes).toContain('clearQuoteCreateAssociation()');
 });
 it('unlinks only confirmed direct relationships and protects issued quotes and bid tasks',()=>{
  const unlink=source('src/components/RecordUnlinkAction.tsx');
  const tasks=source('src/components/RecordTasksPanel.tsx');
  expect(unlink).toContain('const direct=');
  expect(unlink).toContain("['Draft','Ready'].includes(quote.status)");
  expect(unlink).toContain("!(target.kind==='person'&&internal)");
  expect(unlink).toContain('window.confirm(');
  expect(unlink).toContain('setProjectCompany(target.id,undefined)');
  expect(unlink).toContain("updateContact(target.id,{companyId:undefined})");
  expect(unlink).toContain("updateQuote(target.id,{projectId:undefined})");
  expect(tasks).toContain('editing&&!preview&&storedScope===scope&&!isProtectedBidTask(task)');
  expect(tasks).toContain('normalizedTaskAssociations(task).filter(');
 });
 it('moves SELF selection exclusively to Company settings and hides default owner Change',()=>{
  const company=source('src/components/CompanyRecordPage.tsx');
  const settings=source('src/components/CompanySettings.tsx');
  const owner=source('src/components/CrmOwnerControl.tsx');
  expect(company).not.toContain('This is our company');
  expect(company).not.toContain('draft.isSelf');
  expect(company).toContain('showChange={false}');
  expect(settings).toContain('This is our company');
  expect(settings).toContain('onLink={selectSelfCompany} onCreate={createSelfCompany}');
  expect(settings).toContain('canEditCompany');
  expect(owner).toContain('showChange=true');
 });
 it('caps history and unifies the Board Deal Company selector',()=>{
  const history=source('src/components/company-relationship-timeline.css');
  const board=source('src/components/Board.tsx');
  expect(history).toContain('max-height:360px;overflow-y:auto;');
  expect(board).toContain('<UnifiedRecordPicker kind="Company"');
  expect(board).toContain('setProjectCompany(project.id,companyId)');
  expect(board).not.toContain('<label><span>Company</span><input value={draft.companyName}');
 });
});
