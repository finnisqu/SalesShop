import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRecordInlineEditGuard} from './recordInlineEditGuard';
import {RecordInlineEditScope} from '../components/RecordInlineEditScope';
import {RecordInlineProperty} from '../components/RecordInlineProperty';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 341 — coordinated Record edits and inspector permission parity',()=>{
 it('locks the record to one unsaved field and rejects other field claims',()=>{
  const lock=createRecordInlineEditGuard();
  expect(lock.activeId).toBeNull();
  expect(lock.claim('company-name')).toBe(true);
  expect(lock.activeId).toBe('company-name');
  expect(lock.claim('company-email')).toBe(false);
  expect(lock.activeId).toBe('company-name');
  expect(lock.claim('company-name')).toBe(true);
  expect(lock.release('company-email')).toBe(false);
  expect(lock.activeId).toBe('company-name');
  expect(lock.release('company-name')).toBe(true);
  expect(lock.activeId).toBeNull();
  expect(lock.claim('company-email')).toBe(true);
 });
 it('does not transfer a lock to another record or accept an empty editor ID',()=>{
  const first=createRecordInlineEditGuard(),second=createRecordInlineEditGuard();
  expect(first.claim('')).toBe(false);
  expect(first.claim('first-record')).toBe(true);
  expect(second.activeId).toBeNull();
  expect(second.claim('second-record')).toBe(true);
  expect(first.release('first-record')).toBe(true);
  expect(second.activeId).toBe('second-record');
 });
 it('preserves compact property markup and semantic edit triggers inside the shared scope',()=>{
  const html=renderToStaticMarkup(<RecordInlineEditScope>
   <RecordInlineProperty label="Name" value="Sample Account" onSave={()=>{}}/>
   <RecordInlineProperty label="Email" value="team@example.com" onSave={()=>{}}/>
  </RecordInlineEditScope>);
  expect(html).toContain('Sample Account');
  expect(html).toContain('team@example.com');
  expect(html).toContain('aria-label="Edit Name"');
  expect(html).toContain('aria-label="Edit Email"');
  expect((html.match(/class="ss-record-pencil"/g)??[])).toHaveLength(2);
  expect(html).not.toContain('ss-record-inline-editor');
 });
 it('claims on opening, releases on Save/Cancel/unmount and never silently drops a draft',()=>{
  const scope=source('components/RecordInlineEditScope.tsx');
  const input=source('components/RecordInlineProperty.tsx');
  expect(scope).toContain('holder.current.claim(id)');
  expect(scope).toContain('holder.current.release(id)');
  expect(input).toContain("const anotherFieldEditing=activeId!==null&&activeId!==id");
  expect(input).toContain('disabled={anotherFieldEditing}');
  expect(input).toContain('if(claim&&!claim(id))return;');
  expect(input).toContain("release?.(id)");
  expect(input).toContain('useEffect(()=>()=>release?.(id),[id,release])');
  expect(input).toContain('restoreFocus.current=true;setEditing(false);release?.(id)');
  expect(input).toContain("if(event.key==='Escape'&&!event.defaultPrevented&&!saving)");
 });
 it('resets editor coordination using stable CRM IDs, not mutable record titles',()=>{
  const layout=source('components/RecordPageLayout.tsx');
  expect(layout).toContain("key={entityType+':'+(recordKey??title)}");
  for(const [filename,id] of [
   ['CompanyRecordPage.tsx','company.id'],
   ['PersonRecordPage.tsx','person.id'],
   ['DealRecordPage.tsx','deal.id'],
  ]){
   const contents=source('components/'+filename);
   expect(contents).toContain('recordKey={'+id+'}');
  }
  expect(layout).toContain('<RecordInlineEditScope');
  expect(layout).toContain('</RecordInlineEditScope>');
 });
 it('blocks editing after permissions change, including Deal and Board quick views',()=>{
  const input=source('components/RecordInlineProperty.tsx');
  const deal=source('components/DealRecordPage.tsx');
  const preview=source('components/RecordPreviewDrawer.tsx');
  const actions=source('components/RecordActionsMenu.tsx');
  expect(input).toContain('if(disabled&&editing&&!saving)');
  expect(input).toContain('event.preventDefault();if(saving||disabled)return;');
  expect(deal).toContain('{canEditCrm&&<button type="button" onClick={() => {');
  expect(preview).toContain("{canLog&&onEditBoard&&((record.kind==='deal')||(record.kind==='company'))&&");
  expect(actions).toContain('aria-disabled={disabled}');
  expect(actions).toContain('if(disabled)event.preventDefault()');
 });
 it('never removes the last Person identifier via independent inline email editing',()=>{
  const person=source('components/PersonRecordPage.tsx');
  expect(person).toContain("(!value.trim()&&!person.name.trim()?'Enter a name or email.':undefined)");
  expect(person).toContain("recordEmailError(value)");
  expect(person).toContain("!value.trim()&&!person.email?'Enter a name or email.'");
 });
});
