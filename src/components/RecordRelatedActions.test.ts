import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(name:string)=>readFileSync(join(process.cwd(),name),'utf8');
const company=read('src/components/CompanyRecordPage.tsx');
const person=read('src/components/PersonRecordPage.tsx');
const deal=read('src/components/DealRecordPage.tsx');
const relation=read('src/components/RecordRelatedActions.tsx');
const tasks=read('src/components/RecordTasksPanel.tsx');
const picker=read('src/components/UnifiedRecordPicker.tsx');

describe('Unified CRM Add existing / Create new actions',()=>{
 it('uses one searchable picker for all core Company/Person/Deal links',()=>{
  expect(company).toContain('target="deal"');
  expect(company).toContain('target="quote"');
  expect(company).toContain('target="person"');
  expect(company).toContain('<RecordRelationshipPicker');
  expect(person).toContain('target="company"');
  expect(person).toContain('target="quote"');
  expect(deal).toContain('target="company"');
  expect(deal).toContain('target="quote"');
  expect(picker).toContain('type="search"');
  expect(picker).toContain('+ Create New ');
  expect(picker).toContain('onLink(option.id)');
  expect(relation).toContain('setProjectCompany(id,source.id)');
  expect(relation).toContain('updateContact(id,{companyId:source.id})');
  expect(relation).not.toContain('recordActivity(');
 });
 it('links/creates direct Deal People without creating fake Activity records',()=>{
  const direct=read('src/components/DealPersonRelationships.tsx');
  expect(direct).toContain('<UnifiedRecordPicker kind="Person"');
  expect(direct).toContain('<UnifiedRecordPicker kind="Deal"');
  expect(direct).toContain("await manager.add(dealId,id,role)");
  expect(direct).toContain("await manager.add(id,personId,role)");
  expect(direct).not.toContain('recordActivity(');
  expect(tasks).toContain('<UnifiedRecordPicker kind="Task"');
  expect(tasks).toContain("requestTaskModal({mode:'create',title");
  expect(tasks).toContain("normalizedTaskAssociations(task)");
 });
 it('retains SELF Company membership and hides identity behind advanced edit section',()=>{
  expect(company).toContain('Company identity');
  expect(company).toContain('This is our company');
  expect(company).toContain('ourCompanyPatch');
  expect(company).toContain('ourOrgPeople(contacts,companies)');
  const roster=read('src/components/OurOrganizationDirectory.tsx');
  expect(roster).toContain('View {ownCompany.name} · SELF');
  const list=read('src/components/Connections.tsx');
  expect(list).toContain('<option value="self">Our Company (SELF)</option>');
 });
 it('protects issued/signed quotes from quick reassignment',()=>{
  expect(relation).toContain("['Draft','Ready'].includes(q.status)");
  expect(relation).toContain('Only Draft/Ready Quotes can be reassigned');
  expect(picker).toContain('Matching existing records');
 });
});
