import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const file=(name:string)=>readFileSync(join(process.cwd(),name),'utf8');

describe('Deal Company search/create edit field',()=>{
 it('reuses the Company page searchable picker and keeps newly named companies pending until Save',()=>{
  const deal=file('src/components/DealRecordPage.tsx');
  const picker=file('src/components/UnifiedRecordPicker.tsx');
  const related=file('src/components/RecordRelatedActions.tsx');
  expect(related).toContain('<UnifiedRecordPicker kind={kind}');
  expect(deal).toContain('<UnifiedRecordPicker kind="Company"');
  expect(deal).toContain('setNewCompanyName(name.trim())');
  expect(deal).toContain("const createdId=resolveCompany(clean,'customer')");
  expect(deal).toContain('setProjectCompany(deal.id,companyId)');
  expect(deal).toContain("setNewCompanyName('');");
  expect(deal).toContain('setEditing(false);');
  expect(deal).not.toContain('<label>Company<select');
  expect(picker).toContain("triggerLabel??'+ Add '+kind");
 });
});
