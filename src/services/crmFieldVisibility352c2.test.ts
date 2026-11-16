import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 CRM_FIELD_VISIBILITIES,DEFAULT_CRM_FIELD_VISIBILITY,
 normalizeCrmFieldVisibility,widensCrmFieldVisibility,
 canReadCrmFieldVisibility,blankCrmFieldBlueprint,
 createCrmCustomField,readCrmFieldBlueprint,setCrmFieldVisibility,
 type CrmFieldVisibility,
} from './crmFieldBlueprint352b';
import {planSharedCrmFieldPublication,type SharedCrmDefinitionRow}
 from './crmSharedFieldContract352c';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const blueprint=(visibility:CrmFieldVisibility='crm_editors')=>
 createCrmCustomField(blankCrmFieldBlueprint(),{
  label:'Territory',target:'company',type:'text',visibility,
 },'field-territory');
const published=(visibility:CrmFieldVisibility):SharedCrmDefinitionRow=>({
 organization_id:'org-A',id:'field-territory',record_type:'company',
 field_key:'territory',label:'Territory',field_type:'text',visibility,
 description:null,options:[],active:true,revision:3,
});

describe('Batch 352c-visibility — fail-closed custom field access design',()=>{
 it('has explicit, ordered, industry-neutral visibility choices',()=>{
  expect(CRM_FIELD_VISIBILITIES.map(v=>v.id)).toEqual([
   'organization','crm_editors','admins',
  ]);
  expect(DEFAULT_CRM_FIELD_VISIBILITY).toBe('crm_editors');
 });
 it('migrates older device-only blueprints to editors-only, not public',()=>{
  expect(normalizeCrmFieldVisibility(undefined)).toBe('crm_editors');
  expect(normalizeCrmFieldVisibility(null)).toBe('crm_editors');
  const old={
   version:1,fields:[{id:'field-territory',key:'territory',label:'Territory',
    target:'company',type:'text',active:true}],
  };
  expect(readCrmFieldBlueprint(JSON.stringify(old)).fields[0].visibility).toBe('crm_editors');
 });
 it('normalizes unknown or tampered visibility to admins-only',()=>{
  for(const value of ['public','anyone','member','owner',true,5,{},'ALL']){
   expect(normalizeCrmFieldVisibility(value)).toBe('admins');
  }
  const bad={version:1,fields:[{...blueprint().fields[0],visibility:'PUBLIC'}]};
  expect(readCrmFieldBlueprint(JSON.stringify(bad)).fields[0].visibility).toBe('admins');
 });
 it('denies unsigned users, regardless of field label or presented editing permissions',()=>{
  for(const vis of CRM_FIELD_VISIBILITIES){
   expect(canReadCrmFieldVisibility(vis.id,null,true)).toBe(false);
   expect(canReadCrmFieldVisibility(vis.id,null,false)).toBe(false);
  }
 });
 it('lets viewers read only organization-wide fields',()=>{
  expect(canReadCrmFieldVisibility('organization','viewer',false)).toBe(true);
  expect(canReadCrmFieldVisibility('crm_editors','viewer',true)).toBe(false);
  expect(canReadCrmFieldVisibility('admins','viewer',true)).toBe(false);
 });
 it('requires area editing permission for ordinary members to read editor-only fields',()=>{
  expect(canReadCrmFieldVisibility('organization','member',false)).toBe(true);
  expect(canReadCrmFieldVisibility('crm_editors','member',false)).toBe(false);
  expect(canReadCrmFieldVisibility('crm_editors','member',true)).toBe(true);
  expect(canReadCrmFieldVisibility('admins','member',true)).toBe(false);
 });
 it('allows owners/admins, subject to independent server-side membership checks',()=>{
  for(const role of ['owner','admin'] as const){
   for(const visibility of CRM_FIELD_VISIBILITIES)
    expect(canReadCrmFieldVisibility(visibility.id,role,false)).toBe(true);
  }
 });
 it('safely changes only the chosen field without discarding IDs or other definitions',()=>{
  const first=blueprint();
  const second=createCrmCustomField(first,{
   label:'Project Category',target:'deal',type:'text',
  },'other');
  const next=setCrmFieldVisibility(second,'field-territory','admins');
  expect(next.fields[0]).toMatchObject({
   id:'field-territory',key:'territory',visibility:'admins',
  });
  expect(next.fields[1]).toBe(second.fields[1]);
  expect(second.fields[0].visibility).toBe('crm_editors');
  expect(()=>setCrmFieldVisibility(second,'other','public' as CrmFieldVisibility))
   .toThrow('valid field visibility');
 });
 it('tracks organization-wide exposure expansions, not merely field edits',()=>{
  expect(widensCrmFieldVisibility('admins','crm_editors')).toBe(true);
  expect(widensCrmFieldVisibility('admins','organization')).toBe(true);
  expect(widensCrmFieldVisibility('crm_editors','organization')).toBe(true);
  expect(widensCrmFieldVisibility('organization','admins')).toBe(false);
  expect(widensCrmFieldVisibility('crm_editors','admins')).toBe(false);
  expect(widensCrmFieldVisibility('admins','admins')).toBe(false);
 });
 it('flags broader visibility for special review before cloud publication',()=>{
  const draft=blueprint('organization');
  const plan=planSharedCrmFieldPublication('org-A',draft,[published('admins')]);
  expect(plan.visibilityExpansionsRequiringReview).toEqual(['field-territory']);
  expect(plan.updates).toMatchObject([{
   id:'field-territory',visibility:'organization',revision:4,
  }]);
  expect(plan.creates).toEqual([]);
 });
 it('allows narrowing to appear in an update without falsely flagging expansion',()=>{
  const plan=planSharedCrmFieldPublication('org-A',blueprint('admins'),
   [published('organization')]);
  expect(plan.visibilityExpansionsRequiringReview).toEqual([]);
  expect(plan.updates[0].visibility).toBe('admins');
  const unchanged=planSharedCrmFieldPublication('org-A',blueprint('admins'),
   [published('admins')]);
  expect(unchanged.visibilityExpansionsRequiringReview).toEqual([]);
  expect(unchanged.unchanged).toHaveLength(1);
 });
 it('exposes only a draft setting in Settings, not false client-side security',()=>{
  const page=src('components/CrmFieldBlueprintSettings.tsx');
  const css=src('crm-blueprint-settings.css');
  const contract=src('services/crmSharedFieldContract352c.ts');
  expect(page).toContain('setCrmFieldVisibility(current,');
  expect(page).toContain('Who can see it once published?');
  expect(page).toContain('actual privacy requires database enforcement before publishing.');
  expect(page).toContain('fieldset disabled={!editable}');
  expect(page).toContain('do not appear on live records yet');
  expect(css).toContain('.crm-blueprint-visibility');
  expect(contract).not.toContain('supabase.from(');
 });
 it('requires definition and value RLS, per-field privacy and negative SQL tests',()=>{
  const spec=src('../docs/platform/76-custom-field-visibility-security-352c2.md');
  expect(spec).toContain('NO PRODUCTION MIGRATION APPLIED');
  expect(spec).toContain('crm_field_definitions');
  expect(spec).toContain('crm_field_values');
  expect(spec).toContain('private.is_org_member');
  expect(spec).toContain('private.can_edit_org_area');
  expect(spec).toContain('private.is_org_admin');
  expect(spec).toContain('definition');
  expect(spec).toContain('Negative security tests');
 });
});
