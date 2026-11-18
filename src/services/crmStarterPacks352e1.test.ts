import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 blankCrmFieldBlueprint,createCrmCustomField,
 toggleCrmCustomField,setCrmFieldVisibility,CRM_MAX_FIELDS_PER_TARGET,
 type CrmFieldBlueprint,
} from './crmFieldBlueprint352b';
import {
 CRM_STARTER_FIELD_PACKS,crmStarterFieldId,previewCrmStarterPack,applyCrmStarterPack,
} from './crmStarterPacks352e1';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const blank=()=>blankCrmFieldBlueprint();

describe('Batch 352e1 — optional, non-destructive CRM starter field packs',()=>{
 it('keeps a new CRM blueprint empty; starter fields are opt-in',()=>{
  expect(blank()).toEqual({version:1,fields:[]});
  expect(CRM_STARTER_FIELD_PACKS.map(pack=>pack.id))
   .toEqual(['general_sales','construction_trades','real_estate','professional_services']);
 });
 it('has valid industry-neutral and optional business templates for all three record types',()=>{
  for(const pack of CRM_STARTER_FIELD_PACKS){
   expect(new Set(pack.fields.map(field=>field.target)))
    .toEqual(new Set(['company','person','deal']));
   expect(pack.fields.every(field=>field.visibility===undefined)).toBe(true);
   expect(applyCrmStarterPack(blank(),pack.id).fields).toHaveLength(pack.fields.length);
  }
 });
 it('previews exactly what will be added without modifying source data',()=>{
  const base=blank();
  const plan=previewCrmStarterPack(base,'general_sales');
  expect(plan.additions).toBe(4);
  expect(plan.present).toBe(0);
  expect(plan.incompatible).toBe(0);
  expect(plan.blockedReason).toBeNull();
  expect(plan.fields.map(row=>row.status)).toEqual(['add','add','add','add']);
  expect(base.fields).toHaveLength(0);
 });
 it('uses stable IDs across imports and defaults to CRM-editor visibility',()=>{
  const pack=CRM_STARTER_FIELD_PACKS[0];
  const next=applyCrmStarterPack(blank(),pack.id);
  for(let i=0;i<pack.fields.length;i++){
   expect(next.fields[i].id).toBe(crmStarterFieldId(pack.id,pack.fields[i]));
   expect(next.fields[i].visibility).toBe('crm_editors');
   expect(next.fields[i].active).toBe(true);
  }
 });
 it('is idempotent, even when re-applied after a page reload',()=>{
  const once=applyCrmStarterPack(blank(),'construction_trades');
  const reloaded:CrmFieldBlueprint=JSON.parse(JSON.stringify(once));
  const twice=applyCrmStarterPack(reloaded,'construction_trades');
  expect(twice).toBe(reloaded);
  expect(twice.fields).toHaveLength(4);
  expect(previewCrmStarterPack(twice,'construction_trades').present).toBe(4);
 });
 it('preserves manually created fields with the same key',()=>{
  const manual=createCrmCustomField(blank(),{
   target:'deal',label:'Lead Source',type:'choice',options:['Phone','Walk-in'],
   visibility:'admins',
  },'manually-added');
  const plan=previewCrmStarterPack(manual,'general_sales');
  expect(plan.present).toBe(1);
  expect(plan.additions).toBe(3);
  const next=applyCrmStarterPack(manual,'general_sales');
  expect(next.fields.filter(field=>field.target==='deal'&&field.key==='lead_source'))
   .toEqual(manual.fields);
  expect(manual.fields).toHaveLength(1);
 });
 it('does not overwrite conflicting types under the same target/key',()=>{
  const custom=createCrmCustomField(blank(),{
   target:'deal',label:'Lead Source',type:'text',
  },'manual-text');
  const plan=previewCrmStarterPack(custom,'general_sales');
  expect(plan.incompatible).toBe(1);
  expect(plan.additions).toBe(3);
  const next=applyCrmStarterPack(custom,'general_sales');
  expect(next.fields.find(field=>field.id==='manual-text')?.type).toBe('text');
  expect(next.fields).toHaveLength(4);
 });
 it('does not unpause fields or widen visibility on reapplication',()=>{
  const applied=applyCrmStarterPack(blank(),'general_sales');
  const id=applied.fields[0].id;
  const customized=setCrmFieldVisibility(toggleCrmCustomField(applied,id,false),
   id,'admins');
  const twice=applyCrmStarterPack(customized,'general_sales');
  expect(twice).toBe(customized);
  expect(twice.fields[0]).toMatchObject({active:false,visibility:'admins'});
 });
 it('allows overlapping packs and never duplicates existing definitions',()=>{
  const first=applyCrmStarterPack(blank(),'general_sales');
  const combined=applyCrmStarterPack(first,'professional_services');
  expect(combined.fields).toHaveLength(8);
  expect(applyCrmStarterPack(combined,'general_sales')).toBe(combined);
 });
 it('rejects over-capacity imports atomically; no partial fields are saved',()=>{
  let full=blank();
  for(let i=0;i<CRM_MAX_FIELDS_PER_TARGET;i++){
   full=createCrmCustomField(full,{
    label:'Custom Company '+i,target:'company',type:'text',
   },'manual-'+i);
  }
  const original=JSON.stringify(full);
  const plan=previewCrmStarterPack(full,'general_sales');
  expect(plan.blockedReason).toContain('Limit reached');
  expect(()=>applyCrmStarterPack(full,'general_sales')).toThrow('Limit reached');
  expect(JSON.stringify(full)).toBe(original);
 });
 it('does not silently replace reserved identifiers or unrelated CRM objects',()=>{
  const code=source('services/crmStarterPacks352e1.ts');
  const component=source('components/CrmFieldBlueprintSettings.tsx');
  expect(code).not.toContain('supabase.from(');
  expect(code).not.toContain('localStorage.');
  expect(component).toContain('previewCrmStarterPack(blueprint,starterPackId)');
  expect(component).toContain('applyCrmStarterPack(blueprint,starterPackId)');
  expect(component).toContain('disabled={!editable||Boolean(starterPlan.blockedReason)||!starterPlan.additions}');
  expect(component).toContain('Design draft · This device only');
  expect(component).toContain('not shared with your team, do not appear on live records yet');
  expect(component).not.toContain('supabase.from(');
 });
 it('supports role-gated template actions and accessible mobile controls',()=>{
  const component=source('components/CrmFieldBlueprintSettings.tsx');
  const css=source('crm-blueprint-settings.css');
  expect(component).toContain('Optional starter field packs');
  expect(component).toContain('aria-label="Choose a starter field pack"');
  expect(component).toContain('aria-label="Starter pack field preview"');
  expect(css).toContain('.crm-starter-pack-fields');
  expect(css).toContain('.crm-starter-pack-select');
  expect(css).toContain('min-height:44px');
 });
});
