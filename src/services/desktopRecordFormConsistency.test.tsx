import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {RecordEditField,RecordFormFeedback,nonnegativeFieldError,recordEmailError,
 RECORD_CHANGE_APPLIED_MESSAGE} from '../components/RecordFormFeedback';
const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Shared desktop editor form states',()=>{
 it('renders associated controls with accessible inline validation',()=>{
  const html=renderToStaticMarkup(<RecordEditField label="Deal name" required error="Enter a deal name."
    help="Required for the deal.">{control=><input {...control} value="" readOnly/>}</RecordEditField>);
  expect(html).toContain('class="ss-field ss-record-edit-field"');
  expect(html).toContain('aria-describedby=');
  expect(html).toContain('aria-invalid="true"');
  expect(html).toContain('required=""');
  expect(html).toContain('role="alert"');
  expect(html).toContain('Enter a deal name.');
  expect(html).toContain('Required for the deal.');
 });
 it('uses one honest, accessible feedback component for error, saving and applied',()=>{
  for(const [kind,role] of [['error','alert'],['saving','status'],['applied','status']] as const){
   const html=renderToStaticMarkup(<RecordFormFeedback notice={{kind,message:'Example feedback'}}/>);
   expect(html).toContain('role="'+role+'"');
   expect(html).toContain('ss-record-form-feedback--'+kind);
   expect(html).toContain('Example feedback');
  }
  expect(renderToStaticMarkup(<RecordFormFeedback notice={null}/>)).toBe('');
  expect(RECORD_CHANGE_APPLIED_MESSAGE).toContain('Cloud sync, if enabled, may still be pending.');
  expect(RECORD_CHANGE_APPLIED_MESSAGE).not.toContain('cloud saved');
 });
 it('validates numeric and email values with explicit messages rather than silent returns',()=>{
  expect(nonnegativeFieldError('','Annual units')).toBe('');
  expect(nonnegativeFieldError('-2','Annual units')).toContain('zero or greater');
  expect(nonnegativeFieldError('NaN','Annual units')).toContain('zero or greater');
  expect(nonnegativeFieldError('101','Expected share',100)).toContain('cannot exceed 100');
  expect(nonnegativeFieldError('25.4','Expected share',100)).toBe('');
  expect(recordEmailError('')).toBe('');
  expect(recordEmailError('seller@example.com')).toBe('');
  expect(recordEmailError('bad-address')).toBe('Enter a valid email address.');
 });
 it('uses the same field, error and applied feedback in all three CRM record editors',()=>{
  const company=src('components/CompanyRecordPage.tsx');
  const person=src('components/PersonRecordPage.tsx');
  const deal=src('components/DealRecordPage.tsx');
  for(const page of [company,person,deal]){
   expect(page).toContain('<RecordEditField');
   expect(page).toContain('<RecordFormFeedback notice={notice}/>');
   expect(page).toContain("setNotice({kind:'applied',message:RECORD_CHANGE_APPLIED_MESSAGE})");
   expect(page).toContain("onSubmit={");
   expect(page).toContain('noValidate');
   expect(page).toContain('ss-record-editor-actions');
  }
  expect(company).toContain('nonnegativeFieldError(draft.expectedSharePct');
  expect(company).toContain('Number.isInteger(Number(draft.annualUnits))');
  expect(company).toContain('recordEmailError(contactEmail)');
  expect(person).toContain('recordEmailError(draft.email)');
  expect(deal).toContain("setSaving(true);setSaveError('')");
  expect(deal).toContain("message:'Applying deal changes…'");
  expect(deal).toContain('await assignDeal(deal.id');
  expect(deal).toContain('updateDeal(deal.id');
 });
 it('retains draft recovery and adds consistent status to Task and Activity editors and bulk changes',()=>{
  const tasks=src('components/TasksWorkspace.tsx');
  const activity=src('components/QuickActivityLauncher.tsx');
  const bulk=src('components/ConnectionsBulkEditDialog.tsx');
  const taskBulk=src('components/TaskBulkEditDialog.tsx');
  expect(tasks).toContain('RecordEditField label="Task title"');
  expect(tasks).toContain('setTaskNotice({kind:\'applied\',message:RECORD_CHANGE_APPLIED_MESSAGE})');
  expect(tasks).toContain('clearSavedDraft(scopeKey);clearSavedDraft(activeKey)');
  expect(tasks).toContain('if(!created)throw new Error');
  expect(tasks).toContain('catch(reason){setFormError');
  expect(activity).toContain('RecordFormFeedback notice={error?');
  expect(activity).toContain('clearSavedDraft(draftKey)');
  expect(activity).toContain("message:'Logging activity…'");
  for(const page of [bulk,taskBulk]){
   expect(page).toContain('RecordFormFeedback notice={error?');
   expect(page).toContain('setSaving(false)');
  }
 });
 it('shares desktop control sizing without touching quote takeoff grid or phone widths',()=>{
  const css=src('desktop-record-form-consistency.css');
  const main=src('main.tsx');
  expect(css).toContain('@media(min-width:821px)');
  expect(css).toContain('--ss-record-field-height:40px');
  expect(css).toContain('.ss-record-edit-field');
  expect(css).toContain('.ss-record-form-feedback--error');
  expect(css).not.toContain('.qwt-');
  expect(main.indexOf("import './desktop-record-form-consistency.css'"))
   .toBeGreaterThan(main.indexOf("import './desktop-preview-record-consistency.css'"));
 });
});
