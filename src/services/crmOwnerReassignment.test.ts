import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
 canReassignCrmOwner,crmOwnerDisplay,initialCrmOwnerUserId,
 type CrmOwnerMember,
} from './crmRecordOwnership';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const roster:CrmOwnerMember[]=[
 {userId:'u-a',name:'Alex',role:'owner'},
 {userId:'u-b',name:'Bill',role:'member'},
];
describe('Company/Person owner reassignment security and UX',()=>{
 it('requires owner/admin and a connected non-preview workspace',()=>{
  expect(canReassignCrmOwner('owner','cloud')).toBe(true);
  expect(canReassignCrmOwner('admin','cloud')).toBe(true);
  expect(canReassignCrmOwner('member','cloud')).toBe(false);
  expect(canReassignCrmOwner('viewer','cloud')).toBe(false);
  expect(canReassignCrmOwner(null,'cloud')).toBe(false);
  expect(canReassignCrmOwner('owner','local')).toBe(false);
  expect(canReassignCrmOwner('admin','cloud',true)).toBe(false);
 });
 it('preserves creator, unassigned, and teammate names',()=>{
  expect(initialCrmOwnerUserId('cloud','u-a')).toBe('u-a');
  expect(crmOwnerDisplay('u-a','u-a','cloud',roster)).toBe('You');
  expect(crmOwnerDisplay('u-b','u-a','cloud',roster)).toBe('Bill');
  expect(crmOwnerDisplay(undefined,'u-a','cloud',roster)).toContain('Unassigned');
  expect(crmOwnerDisplay('u-c','u-a','cloud',roster)).toBe('Assigned teammate');
  expect(crmOwnerDisplay(undefined,undefined,'local',roster)).toContain('local workspace');
 });
 it('persists ownership only after a server-confirmed compare-and-swap',()=>{
  const store=read('src/store/crmStore.ts');
  expect(store).toContain('assignCrmRecordOwner:async(kind,recordId,ownerUserId)=>');
  expect(store).toContain('if(!canReassignCrmOwner(');
  expect(store).toContain(".eq('organization_id',organizationId).eq('id',recordId)");
  expect(store).toContain("query.is('owner_user_id',null)");
  expect(store).toContain("query.eq('owner_user_id',current.ownerUserId)");
  expect(store).toContain(".select('owner_user_id,updated_at').maybeSingle()");
  expect(store).toContain("if(!data)throw new Error(");
  expect(store).toContain('if(confirmed!==selected)');
  expect(store).toContain("latestAuth.organizationId!==organizationId");
  expect(store).toContain("if(!latest||latest.ownerUserId!==current.ownerUserId)");
  expect(store.indexOf("const {data,error}=await query.select('owner_user_id,updated_at').maybeSingle()"))
    .toBeLessThan(store.indexOf('const companies=get().companies.map(c=>c.id===recordId'));
 });
 it('keeps owner assignment separate from regular CRM cloud document writes',()=>{
  const sync=read('src/services/normalizedCrmSync.ts');
  expect(sync).toContain('ownerUserId:valueOrUndefined(row.owner_user_id)');
  expect(sync).not.toContain('owner_user_id: company.ownerUserId');
  expect(sync).not.toContain('owner_user_id: contact.ownerUserId');
  const sql=read('supabase/migrations/20261110171330_guard_crm_owner_reassignment_20261110.sql');
  expect(sql).toContain('create or replace function private.enforce_crm_record_owner_change()');
  expect(sql).toContain('security invoker');
  expect(sql).toContain("m.role in ('owner', 'admin')");
  expect(sql).toContain("errcode = '42501'");
  expect(sql).toContain('before insert or update of owner_user_id on public.companies');
  expect(sql).toContain('before insert or update of owner_user_id on public.contacts');
 });
 it('renders compact permission-gated controls without a mobile modal or duplicate handle',()=>{
  const component=read('src/components/CrmOwnerControl.tsx');
  expect(component).toContain('canReassignCrmOwner(role,mode,rolePreview)');
  expect(component).toContain('await assign(kind,recordId,selected||undefined)');
  expect(component).toContain('setNotice(\'Assignment confirmed in cloud.\')');
  expect(component).toContain('role="alert"');
  expect(component).toContain('Change</button>');
  expect(component).toContain('Save assignment');
  expect(component).toContain("from('organization_members')");
  expect(component).toContain(".eq('organization_id',orgId)");
  expect(component).not.toContain('MobileSheetHandle');
  const css=read('src/components/crm-owner-assignment.css');
  expect(css).toContain('min-height:44px');
  expect(css).toContain('max-width:100%');
 });
});
