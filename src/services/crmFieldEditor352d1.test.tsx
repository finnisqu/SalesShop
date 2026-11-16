import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {readFileSync} from 'node:fs';
import {
 activeCrmFieldsForRecord,parseCrmFieldInput,formatCrmFieldInput,
 applyCrmFieldInput,validateCrmFieldForm,
} from './crmFieldEditor352d1';
import {CrmCustomFieldEditor} from '../components/CrmCustomFieldEditor';
import type {CrmCustomField,CrmFieldTarget,CrmFieldType} from './crmFieldBlueprint352b';

const source=(path:string)=>
 readFileSync(new URL('../'+path,import.meta.url),'utf8');
const field=(type:CrmFieldType,target:CrmFieldTarget='company',
 active=true):CrmCustomField=>({
 id:target+'_'+type,key:'custom_'+type,label:'Sample '+type,
 target,type,active,visibility:'crm_editors',
 ...(type==='choice'?{options:['Bronze','Gold']}:{}),
});
const allTypes:CrmFieldType[]=['text','number','date','choice','boolean'];

describe('Batch 352d1 — reusable custom-field editor and safe sample-record preview',()=>{
 it('shows only active fields for the selected record type',()=>{
  const fields=[field('text'),field('number','person'),field('date','company',false),
   field('boolean','deal')];
  expect(activeCrmFieldsForRecord(fields,'company')).toEqual([fields[0]]);
  expect(activeCrmFieldsForRecord(fields,'person')).toEqual([fields[1]]);
  expect(activeCrmFieldsForRecord(fields,'deal')).toEqual([fields[3]]);
 });
 it('normalizes text while treating whitespace-only and blank as clear',()=>{
  const f=field('text');
  expect(parseCrmFieldInput(f,'  Referral  ')).toEqual({valid:true,value:'Referral'});
  expect(parseCrmFieldInput(f,'   ')).toEqual({valid:true,value:null});
  expect(parseCrmFieldInput(f,'')).toEqual({valid:true,value:null});
  expect(parseCrmFieldInput(f,'x'.repeat(501)).valid).toBe(false);
 });
 it('converts finite signed decimal numbers and rejects malformed input',()=>{
  const f=field('number');
  expect(parseCrmFieldInput(f,'-4.25')).toEqual({valid:true,value:-4.25});
  expect(parseCrmFieldInput(f,'.75')).toEqual({valid:true,value:0.75});
  expect(parseCrmFieldInput(f,'2e3')).toEqual({valid:true,value:2000});
  for(const raw of ['--2','1,000','2.3.4','NaN','Infinity','1e999']){
   expect(parseCrmFieldInput(f,raw).valid).toBe(false);
  }
 });
 it('accepts real ISO dates and rejects impossible calendar dates',()=>{
  const f=field('date');
  expect(parseCrmFieldInput(f,'2028-02-29')).toEqual({valid:true,value:'2028-02-29'});
  expect(parseCrmFieldInput(f,'2026-02-29').valid).toBe(false);
  expect(parseCrmFieldInput(f,'2026-11-32').valid).toBe(false);
  expect(parseCrmFieldInput(f,'11/16/2026').valid).toBe(false);
 });
 it('restricts choice fields to exactly their declared options',()=>{
  const f=field('choice');
  expect(parseCrmFieldInput(f,'Gold')).toEqual({valid:true,value:'Gold'});
  expect(parseCrmFieldInput(f,'gold').valid).toBe(false);
  expect(parseCrmFieldInput(f,'Platinum').valid).toBe(false);
 });
 it('supports true, false and an unset state without conflating No with missing',()=>{
  const f=field('boolean');
  expect(parseCrmFieldInput(f,'true')).toEqual({valid:true,value:true});
  expect(parseCrmFieldInput(f,'false')).toEqual({valid:true,value:false});
  expect(parseCrmFieldInput(f,'')).toEqual({valid:true,value:null});
  expect(parseCrmFieldInput(f,'yes').valid).toBe(false);
  expect(formatCrmFieldInput(false)).toBe('false');
  expect(formatCrmFieldInput(null)).toBe('');
 });
 it('updates only the selected field ID and leaves unrelated values unchanged',()=>{
  const original={other:'unchanged',company_text:'Before'};
  const next=applyCrmFieldInput(original,field('text'),'After');
  expect(next).toEqual({
   valid:true,value:'After',
   values:{other:'unchanged',company_text:'After'},
  });
  expect(original.company_text).toBe('Before');
 });
 it('clearing a value removes its key rather than writing a null typed row',()=>{
  const original={company_text:'Before',company_boolean:false};
  const updated=applyCrmFieldInput(original,field('text'),'  ');
  expect(updated).toEqual({
   valid:true,value:null,values:{company_boolean:false},
  });
 });
 it('does not emit an invalid number or paused field as a valid change',()=>{
  expect(applyCrmFieldInput({company_number:5},field('number'),'bad')).toMatchObject({
   valid:false,error:'Enter a valid number for Sample number.',
  });
  expect(applyCrmFieldInput({},field('text','company',false),'Hello')).toEqual({
   valid:false,error:'This field is paused.',
  });
 });
 it('ignores values belonging to another target or now-paused field',()=>{
  const fields=[field('text'),field('choice'),field('number','person'),
   field('date','company',false)];
  const checked=validateCrmFieldForm(fields,'company',{
   company_text:'Hello',company_choice:'Bronze',person_number:10,
   company_date:'2026-11-16',orphan:'untrusted',
  });
  expect(checked).toEqual({valid:true,values:{
   company_text:'Hello',company_choice:'Bronze',
  }});
 });
 it('rejects data that no longer matches the current definition',()=>{
  const f=field('choice');
  const checked=validateCrmFieldForm([f],'company',{
   company_choice:'Archived option',
  });
  expect(checked.valid).toBe(false);
  if(!checked.valid)expect(checked.errors).toHaveProperty('company_choice');
 });
 it('renders all five accessible typed controls without a nested form or save button',()=>{
  const fields=allTypes.map(type=>field(type));
  const markup=renderToStaticMarkup(createElement(CrmCustomFieldEditor,{
   fields,target:'company',values:{company_boolean:false},
   onChange:()=>{},
  }));
  for(const type of allTypes)expect(markup).toContain('Sample '+type);
  expect(markup).toContain('type="date"');
  expect(markup.toLowerCase()).toContain('inputmode="decimal"');
  expect(markup).toContain('<option value="false"');
  expect(markup).toContain('Bronze');
  expect(markup).not.toContain('<form');
 });
 it('shows no input for a target with no active optional fields',()=>{
  const markup=renderToStaticMarkup(createElement(CrmCustomFieldEditor,{
   fields:[field('text','person')],target:'company',values:{},onChange:()=>{},
  }));
  expect(markup).toContain('No active custom fields are defined');
  expect(markup).not.toContain('<input');
 });
 it('integrates preview into Settings but stores only definitions, never sample values',()=>{
  const settings=source('components/CrmFieldBlueprintSettings.tsx');
  const editor=source('components/CrmCustomFieldEditor.tsx');
  expect(settings).toContain("scope+':sample-record'");
  expect(settings).toContain('<CrmCustomFieldEditor');
  expect(settings).toContain('key={scope+\':\'+target+\':\'+sampleRevision}');
  expect(settings).toContain('setSampleValues(current=>({...current,[target]:next}))');
  expect(settings).toContain('Closing or reloading SalesShop discards the sample.');
  expect(settings).toContain('Clear sample values');
  expect(editor).not.toContain('supabase.from(');
  expect(editor).not.toContain('localStorage');
  expect(editor).toContain('onValidityChange?.(nextErrors)');
 });
 it('keeps the demo read-only for non-admins, with scoped mobile theme styles',()=>{
  const settings=source('components/CrmFieldBlueprintSettings.tsx');
  const css=source('crm-blueprint-settings.css');
  expect(settings).toContain('disabled={!editable}');
  expect(settings).toContain("const recordName=target==='company'?'Company':target==='person'?'Person':'Deal';");
  expect(css).toContain('.crm-custom-field-editor');
  expect(css).toContain('.crm-blueprint-preview-record');
  expect(css).toContain('@media(max-width:760px)');
  expect(css).toContain('min-height:44px;');
 });
});
