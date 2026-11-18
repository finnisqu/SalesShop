import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {
 CRM_SETUP_TEMPLATES,CRM_SETUP_TEMPLATE_IDS,createCrmGuidedPreset,
 validateCrmGuidedSetup,readCrmGuidedSetup,crmGuidedSetupStorageKey,
 previewCrmGuidedSetup,updateCrmSetupPanel,updateCrmSetupStage,
 moveCrmSetupStage,saveCrmGuidedSetup,
 type CrmSetupStorage,
} from './crmGuidedSetup380';
import {
 blankCrmFieldBlueprint,createCrmCustomField,
 setCrmFieldVisibility,toggleCrmCustomField,
 type CrmFieldBlueprint,
} from './crmFieldBlueprint352b';
import {blankCrmModulePlans,crmModulePlansStorageKey} from './crmConfiguration352e2';
import {CrmGuidedSetup380} from '../components/CrmGuidedSetup380';

function source(path:string):string{
 return readFileSync(new URL('../'+path,import.meta.url),'utf8');
}
function fakeStorage(seed:Record<string,string>={},failsOn?:string):CrmSetupStorage&{snapshot:()=>Record<string,string>}{
 const data=new Map(Object.entries(seed));
 return {
  getItem:key=>data.get(key)??null,
  setItem:(key,value)=>{
   if(key===failsOn)throw new Error('Storage blocked');
   data.set(key,value);
  },
  removeItem:key=>{data.delete(key);},
  snapshot:()=>Object.fromEntries(data),
 };
}
const blank=()=>blankCrmFieldBlueprint();
const modules=()=>blankCrmModulePlans();

describe('#380 guided plug-and-play CRM setup',()=>{
 it('offers blank, general, construction, real estate, professional services, with no automatic installation',()=>{
  expect(CRM_SETUP_TEMPLATE_IDS).toEqual([
   'blank','general_sales','construction_trades','real_estate','professional_services',
  ]);
  expect(CRM_SETUP_TEMPLATES).toHaveLength(5);
  const setup=createCrmGuidedPreset('blank');
  expect(setup.terminology).toEqual({company:'Company',person:'Person',deal:'Deal'});
  const plan=previewCrmGuidedSetup(blank(),modules(),setup);
  expect(plan.fieldsToAdd).toBe(0);
  expect(plan.nextBlueprint).toEqual(blank());
 });
 it('makes industry-specific stages and terms optional and keeps source templates immutable',()=>{
  const first=createCrmGuidedPreset('construction_trades');
  expect(first.terminology.deal).toBe('Project');
  expect(first.stages).toContain('Bid Submitted');
  first.stages[0]='Changed';
  expect(createCrmGuidedPreset('construction_trades').stages[0]).toBe('Lead');
  expect(createCrmGuidedPreset('real_estate').pipelineName).toBe('Property pipeline');
  expect(()=>createCrmGuidedPreset('unknown' as never)).toThrow();
 });
 it('previews additive starter fields for all templates without live record changes',()=>{
  for(const id of CRM_SETUP_TEMPLATE_IDS){
   const setup=createCrmGuidedPreset(id);
   const plan=previewCrmGuidedSetup(blank(),modules(),setup);
   expect(plan.fieldsToAdd).toBe(id==='blank'?0:4);
   expect(plan.nextBlueprint.fields).toHaveLength(id==='blank'?0:4);
   expect(plan.nextModules).toEqual(modules());
  }
 });
 it('preserves existing custom-field IDs, pauses, visibility and choice options',()=>{
  const before=createCrmCustomField(blank(),{
   target:'deal',label:'Lead Source',type:'choice',
   options:['Warm intro','Partner'],visibility:'admins',
  },'my-manual-field');
  const modified=toggleCrmCustomField(setCrmFieldVisibility(before,
   'my-manual-field','admins'),'my-manual-field',false);
  const plan=previewCrmGuidedSetup(modified,modules(),
   createCrmGuidedPreset('general_sales'));
  expect(plan.existingFields).toBe(1);
  expect(plan.fieldsToAdd).toBe(3);
  expect(plan.nextBlueprint.fields.find(f=>f.id==='my-manual-field'))
   .toEqual(modified.fields[0]);
  expect(modified.fields).toHaveLength(1);
 });
 it('skips conflicting types instead of silently changing them',()=>{
  const before=createCrmCustomField(blank(),{
   target:'deal',label:'Lead Source',type:'text',
  },'my-lead-source');
  const plan=previewCrmGuidedSetup(before,modules(),createCrmGuidedPreset('general_sales'));
  expect(plan.conflictingFields).toBe(1);
  expect(plan.fieldsToAdd).toBe(3);
  expect(plan.nextBlueprint.fields.find(f=>f.id==='my-lead-source')?.type).toBe('text');
 });
 it('cannot circumvent custom field capacity; rejects whole plan before save',()=>{
  let filled:CrmFieldBlueprint=blank();
  for(let i=0;i<30;i++)filled=createCrmCustomField(filled,{
   target:'company',label:'Manual '+i,type:'text',
  },'custom-'+i);
  const original=JSON.stringify(filled);
  expect(()=>previewCrmGuidedSetup(filled,modules(),createCrmGuidedPreset('general_sales')))
   .toThrow('Limit reached');
  expect(JSON.stringify(filled)).toBe(original);
 });
 it('validates untrusted stage data, reserved panels, terminology and module shapes',()=>{
  const valid=createCrmGuidedPreset('general_sales');
  expect(validateCrmGuidedSetup(valid)).toEqual([]);
  expect(validateCrmGuidedSetup({...valid,stages:['Lead','lead']})).not.toEqual([]);
  expect(validateCrmGuidedSetup({...valid,stages:['Too few']})).not.toEqual([]);
  expect(validateCrmGuidedSetup({...valid,stages:[]})).not.toEqual([]);
  expect(validateCrmGuidedSetup({...valid,pipelineName:'<script>'})).not.toEqual([]);
  expect(validateCrmGuidedSetup({...valid,terminology:{...valid.terminology,deal:'D'}}))
   .not.toEqual([]);
  expect(validateCrmGuidedSetup({...valid,panels:{...valid.panels,
   company:valid.panels.company.filter(p=>p.id!=='details')}})).not.toEqual([]);
  expect(validateCrmGuidedSetup({...valid,modules:{...modules(),unexpected:true}}))
   .not.toEqual([]);
  expect(readCrmGuidedSetup('{"version":1,"template":"general_sales","records":[] }'))
   .toBeNull();
  expect(readCrmGuidedSetup('garbage')).toBeNull();
 });
 it('lets users reorder stages and panels while keeping core sections visible',()=>{
  const original=createCrmGuidedPreset('general_sales');
  const next=moveCrmSetupStage(original,0,1);
  expect(next.stages[1]).toBe('New');
  expect(original.stages[0]).toBe('New');
  const renamed=updateCrmSetupStage(next,1,'Introduced');
  expect(renamed.stages[1]).toBe('Introduced');
  expect(updateCrmSetupStage(next,-1,'Invalid')).toBe(next);
  expect(updateCrmSetupPanel(original,'person','details','toggle')).toBe(original);
  const hidden=updateCrmSetupPanel(original,'person','files','toggle');
  expect(hidden.panels.person.find(p=>p.id==='files')?.visible).toBe(false);
  expect(original.panels.person.find(p=>p.id==='files')?.visible).toBe(true);
  const moved=updateCrmSetupPanel(hidden,'person','recents','up');
  expect(moved.panels.person.at(-2)?.id).toBe('recents');
  expect(validateCrmGuidedSetup(moved)).toEqual([]);
 });
 it('never turns off previously planned modules, even if the new draft leaves them unchecked',()=>{
  const current={...modules(),renewal_follow_up:true};
  const setup=createCrmGuidedPreset('professional_services');
  setup.modules.lead_intake=true;
  const plan=previewCrmGuidedSetup(blank(),current,setup);
  expect(plan.modulePlansToAdd).toBe(1);
  expect(plan.nextModules).toEqual({...current,lead_intake:true});
  expect(current.lead_intake).toBe(false);
 });
 it('saves all three user/tenant-scoped keys, and rejects partial browser failures',()=>{
  const scope='salesshop-crm-field-blueprints-v1:["cloud","org-a","user-a"]';
  const plan=previewCrmGuidedSetup(blank(),modules(),createCrmGuidedPreset('general_sales'));
  const storage=fakeStorage();
  saveCrmGuidedSetup(storage,scope,plan);
  expect(JSON.parse(storage.getItem(scope)??'null')).toEqual(plan.nextBlueprint);
  expect(JSON.parse(storage.getItem(crmModulePlansStorageKey(scope))??'null'))
   .toEqual(plan.nextModules);
  expect(readCrmGuidedSetup(storage.getItem(crmGuidedSetupStorageKey(scope))))
   .toEqual(plan.savedProfile);
  expect(storage.getItem('salesshop-crm-field-blueprints-v1:["cloud","org-b","user-b"]'))
   .toBeNull();
  const before={a:'keep'};
  const interrupted=fakeStorage({
   a:'keep',
   [scope]:'original',
   [crmModulePlansStorageKey(scope)]:'old modules',
  },crmGuidedSetupStorageKey(scope));
  const snapshot=interrupted.snapshot();
  expect(()=>saveCrmGuidedSetup(interrupted,scope,plan)).toThrow('Could not save');
  expect(interrupted.snapshot()).toEqual(snapshot);
  expect(before.a).toBe('keep');
 });
 it('renders a real guided flow with disabled Save in viewer mode',()=>{
  const html=renderToStaticMarkup(
   <CrmGuidedSetup380 editable={false} scope="tenant:a"
    saved={null} blueprint={blank()} modules={modules()} onApply={()=>{}}/>);
  expect(html).toContain('Guided CRM Setup');
  expect(html).toContain('Blank CRM');
  expect(html).toContain('Real estate');
  expect(html).toContain('Only owners or admins can save');
  expect(html).toContain('aria-label="CRM setup steps"');
  expect(html).toContain('Design mode only');
 });
 it('keeps local drafts distinct from live CRM tables and requires reviewed application',()=>{
  const ui=source('components/CrmFieldBlueprintSettings.tsx');
  const wizard=source('components/CrmGuidedSetup380.tsx');
  const code=source('services/crmGuidedSetup380.ts');
  expect(ui).toContain('<CrmGuidedSetup380 key={scope}');
  expect(ui).toContain('saveCrmGuidedSetup(localStorage,scope,plan);');
  expect(wizard).toContain('onApply(plan)');
  expect(wizard).toContain('disabled={!editable||!preview');
  expect(wizard).toContain('Live team-wide stages, terminology, record layouts');
  expect(code).not.toContain('supabase.from(');
  expect(code).not.toContain('updateProject(');
  expect(code).not.toContain('updateCompany(');
  expect(code).not.toContain('setView(');
 });
});
