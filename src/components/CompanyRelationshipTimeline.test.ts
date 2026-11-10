import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Company relationship timeline integration',()=>{
 it('renders one reusable account history on full page and quick preview',()=>{
  const page=source('src/components/CompanyRecordPage.tsx');
  const preview=source('src/components/RecordPreviewDrawer.tsx');
  expect(page).toContain('<CompanyRelationshipTimeline items={timeline}');
  expect(page).toContain('title="Relationship history"');
  expect(preview).toContain('<CompanyRelationshipTimeline items={companyHistory} compact');
  expect(preview).toContain('Recent relationship history');
  expect(page).not.toContain("setActivityFilter(");
 });
 it('uses explicit CRM associations and only private Tasks from the active scope',()=>{
  const service=source('src/services/companyRelationshipHistory.ts');
  const page=source('src/components/CompanyRecordPage.tsx');
  const preview=source('src/components/RecordPreviewDrawer.tsx');
  expect(service).toContain('quotesForCompany(company,projects,quotes)');
  expect(service).toContain('activityRelations(activity)');
  expect(service).toContain('normalizedTaskAssociations(task)');
  expect(service).toContain('task.workspaceScope!==personalTaskScope');
  expect(service).toContain('completedTaskActivityId(task.id,personalTaskScope)');
  expect(page).toContain('storedTaskScope===personalScope&&!perspective');
  expect(preview).toContain('currentPersonalTaskScope===personalScope');
 });
 it('offers quote, deal, contact and task filters without duplicate record cards',()=>{
  const component=source('src/components/CompanyRelationshipTimeline.tsx');
  expect(component).toContain("label:'Interactions'");
  expect(component).toContain("label:'Quotes'");
  expect(component).toContain("label:'Deals'");
  expect(component).toContain("label:'Tasks'");
  expect(component).toContain('onOpenTarget(item.target!)');
  expect(component).toContain('setVisibleCount(count=>count+25)');
 });
});
