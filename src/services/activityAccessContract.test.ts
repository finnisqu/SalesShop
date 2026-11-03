import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
describe('manual CRM activity access and recovery policy',()=>{
 it('restricts INSERT to CRM editors AND editable linked quote',()=>{
  const sql=readFileSync('supabase/migrations/20261103183000_activity_quote_link_insert_gate.sql','utf8');
  expect(sql).toContain('private.can_edit_org_area');
  expect(sql).toContain('private.can_edit_quote(organization_id,quote_id)');
  expect(sql).toContain('to authenticated');
 });
});
