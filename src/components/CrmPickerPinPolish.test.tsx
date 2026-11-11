import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {WorkspaceChromeIcon} from './WorkspaceChromeIcon';
const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Unified CRM relationship field and pin polish',()=>{
 it('stages a Person Company selection or creation until saving, and discards it on cancel',()=>{
  const person=source('src/components/PersonRecordPage.tsx');
  expect(person).toContain('<UnifiedRecordPicker kind="Company"');
  expect(person).toContain("setNewCompanyName(name.trim())");
  expect(person).toContain("const createdId=resolveCompany(clean,'customer')");
  expect(person).toContain('companyId,');
  expect(person).toContain("setNewCompanyName('');setEditing(false);");
  expect(person).not.toContain('<label>Company<select');
 });
 it('searches and creates external-quote Deals with one shared picker',()=>{
  const external=source('src/components/ExternalQuoteBackfillDialog.tsx');
  expect(external).toContain('<UnifiedRecordPicker kind="Deal"');
  expect(external).toContain('onCreate={createFromPicker}');
  expect(external).toContain('onLink={id=>{setSelectedId(id)');
  expect(external).toContain('setSelectedId(id);');
  expect(external).toContain('<ExternalQuoteSentForm key={selected.id}');
  expect(external).not.toContain('newDealOpen');
 });
 it('renders a symmetric, readable shared pin used by the worktables and Materials',()=>{
  const icon=renderToStaticMarkup(<WorkspaceChromeIcon name="pin"/>);
  expect(icon).toContain('M9 3h6v6l3 4v2H6v-2l3-4V3Z');
  expect(icon).toContain('M12 15v6');
  expect(icon).not.toContain('m16 3 5 5-4 1-4 5');
  expect(source('src/components/ConnectionsTable.tsx')).toContain('<WorkspaceChromeIcon name="pin"/>');
  expect(source('src/components/MaterialsWorkspace.tsx')).toContain('<WorkspaceChromeIcon name="pin"/>');
 });
});