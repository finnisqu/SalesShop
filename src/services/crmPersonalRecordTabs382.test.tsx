import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {createCrmGuidedPreset,validateCrmGuidedSetup} from './crmGuidedSetup380';
import {personalRecordTabPresentation} from './crmPersonalRecordTabs382';
import {RecordTabbedGroup372} from '../components/RecordTabbedGroup372';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const tabs=[
 {id:'about',label:'About'},{id:'forecast',label:'Forecast'},
 {id:'files',label:'Files'},{id:'email',label:'Email'},
 {id:'notebook',label:'Notebook'},
];

describe('#382 personal record sections: ordering and recovery',()=>{
 it('does not alter any tab without an explicitly saved CRM Setup',()=>{
  const output=personalRecordTabPresentation(tabs,'company',null);
  expect(output.shown.map(tab=>tab.id)).toEqual(tabs.map(tab=>tab.id));
  expect(output.hidden).toEqual([]);
  expect(output.shown).not.toBe(tabs);
 });
 it('reorders About, Files and Notebook but preserves unconfigured tab slots',()=>{
  const setup=createCrmGuidedPreset('general_sales');
  const reordered=setup.panels.company;
  const moved=reordered.splice(reordered.findIndex(panel=>panel.id==='notebook'),1)[0];
  reordered.unshift(moved);
  const result=personalRecordTabPresentation(tabs,'company',setup);
  expect(result.shown.map(tab=>tab.id)).toEqual([
   'notebook','forecast','about','email','files',
  ]);
  expect(result.hidden).toHaveLength(0);
  expect(tabs.map(t=>t.id)).toEqual(['about','forecast','files','email','notebook']);
 });
 it('only moves optional, hidden Files and Notebook into the recoverable menu',()=>{
  const setup=createCrmGuidedPreset('construction_trades');
  setup.panels.deal.find(p=>p.id==='files')!.visible=false;
  setup.panels.deal.find(p=>p.id==='notebook')!.visible=false;
  const result=personalRecordTabPresentation(tabs,'deal',setup);
  expect(result.shown.map(p=>p.id)).toEqual(['about','forecast','email']);
  expect(result.hidden.map(p=>p.id)).toEqual(['files','notebook']);
  expect(result.hidden.map(p=>p.label)).toEqual(['Files','Notebook']);
  expect(result.shown.length+result.hidden.length).toBe(tabs.length);
 });
 it('remains independent for Company, Person and Deal panel preferences',()=>{
  const setup=createCrmGuidedPreset('real_estate');
  setup.panels.person.find(p=>p.id==='notebook')!.visible=false;
  setup.panels.deal.find(p=>p.id==='files')!.visible=false;
  const company=personalRecordTabPresentation(tabs,'company',setup);
  const person=personalRecordTabPresentation(tabs,'person',setup);
  const deal=personalRecordTabPresentation(tabs,'deal',setup);
  expect(company.hidden).toEqual([]);
  expect(person.hidden.map(p=>p.id)).toEqual(['notebook']);
  expect(deal.hidden.map(p=>p.id)).toEqual(['files']);
 });
 it('never hides About even if a damaged runtime object marks Details hidden',()=>{
  const setup=createCrmGuidedPreset('general_sales');
  setup.panels.company.find(p=>p.id==='details')!.visible=false;
  const result=personalRecordTabPresentation(tabs,'company',setup);
  expect(result.shown.map(p=>p.id)).toContain('about');
 });
 it('preserves unknown tabs and actions rather than trying to interpret them as setup',()=>{
  const setup=createCrmGuidedPreset('general_sales');
  setup.panels.company.find(p=>p.id==='files')!.visible=false;
  const items=[...tabs,{id:'tasks',label:'Tasks'},{id:'custom-panel',label:'Custom'}];
  const result=personalRecordTabPresentation(items,'company',setup);
  expect(result.shown.map(p=>p.id)).toContain('tasks');
  expect(result.shown.map(p=>p.id)).toContain('custom-panel');
  expect(result.hidden.map(p=>p.id)).toEqual(['files']);
 });
 it('persists preferences through the existing validated personal setup profile',()=>{
  const setup=createCrmGuidedPreset('professional_services');
  setup.panels.company.find(p=>p.id==='notebook')!.visible=false;
  expect(validateCrmGuidedSetup(setup)).toEqual([]);
  const json=JSON.stringify(setup);
  const restored=JSON.parse(json);
  const result=personalRecordTabPresentation(tabs,'company',restored);
  expect(result.hidden.map(p=>p.id)).toEqual(['notebook']);
 });
 it('uses the shared record-tab chrome with a More sections affordance',()=>{
  const src=source('components/RecordTabbedGroup372.tsx');
  expect(src).toContain('personalTarget?:CrmFieldTarget');
  expect(src).toContain('personalRecordTabPresentation(items,personalTarget,profile)');
  expect(src).toContain('readPersonalCrmLayoutDefaults(');
  expect(src).toContain('presentation.hidden.map(item=>');
  expect(src).toContain('More record sections');
  expect(src).toContain('setCurrent(item.id)');
  const html=renderToStaticMarkup(<RecordTabbedGroup372 title="Sample"
   items={[{id:'about',label:'About',content:<p>Keep editable content</p>}]}/>);
  expect(html).toContain('Keep editable content');
  expect(html).toContain('role="tablist"');
 });
 it('uses this behavior on all three left record areas, never the center',()=>{
  for(const [kind,target] of [
   ['Company','company'],['Person','person'],['Deal','deal'],
  ] as const){
   const src=source('components/'+kind+'RecordPage.tsx');
   expect(src).toContain('personalTarget="'+target+'" initialTab="about"');
   expect(src).toContain('<RecordRecentsPanel');
   expect(src).toContain('title="Connections" showTitle items={[');
  }
 });
 it('does not mutate stored records, share layout edits, or remove access to Recents',()=>{
  const helper=source('services/crmPersonalRecordTabs382.ts');
  const group=source('components/RecordTabbedGroup372.tsx');
  const layout=source('components/RecordPageLayout.tsx');
  for(const token of ['supabase.from(', 'updateProject(', 'updateCompany(', 'updateContact('])
   expect(helper).not.toContain(token);
  expect(group).toContain('selectedHidden?[...presentation.shown,selected]');
  expect(layout).toContain('aria-label="Related records"');
 });
});
