import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {WorkspaceChromeIcon} from './WorkspaceChromeIcon';
import {recordNameKey} from '../services/recordNameKey';
const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Unified CRM relationship field and pin polish',()=>{
 it('treats harmless spacing and case differences as the same record name',()=>{
  expect(recordNameKey('  ACME   BUILDERS ')).toBe('acme builders');
  expect(recordNameKey('Acme Builders')).toBe('acme builders');
  expect(recordNameKey('A\nB\tC')).toBe('a b c');
  expect(recordNameKey('')).toBe('');
  const picker=source('src/components/UnifiedRecordPicker.tsx');
  const quickCreate=source('src/components/ActivityRelatedQuickCreate.tsx');
  expect(picker).toContain('recordNameKey(item.name)===needle');
  expect(quickCreate).toContain('recordNameKey(c.name)===recordNameKey(clean)');
  expect(quickCreate).toContain('recordNameKey(p.name)===recordNameKey(clean)');
  expect(quickCreate).toContain('recordNameKey(d.name)===recordNameKey(clean)');
 });
 it('uses consistent normalized duplicate checks in external quotes and relationship creators',()=>{
  const external=source('src/components/ExternalQuoteBackfillDialog.tsx');
  const related=source('src/components/RecordRelatedActions.tsx');
  expect(external).toContain('recordNameKey(d.name)===recordNameKey(clean)');
  expect(related).toContain('recordNameKey(d.name)===recordNameKey(clean)');
  expect(related).toContain('recordNameKey(c.name)===recordNameKey(cleaned)');
  expect(related).toContain('===recordNameKey(name)');
 });
 it('stages a Person Company selection or creation until saving, and discards it on cancel',()=>{
  const person=source('src/components/PersonRecordPage.tsx');
  expect(person).toContain('<UnifiedRecordPicker kind="Company"');
  expect(person).toContain("setNewCompanyName(name.trim())");
  expect(person).toContain("const createdId=resolveCompany(clean,'customer')");
  expect(person).toContain('companyId,');
  expect(person).toContain("setNewCompanyName('');setEditing(false);");
  expect(person).not.toContain('<label>Company<select');
 });
 it('searches and creates external-quote Deals with one shared picker',()=>{
  const external=source('src/components/ExternalQuoteBackfillDialog.tsx');
  expect(external).toContain('<UnifiedRecordPicker kind="Deal"');
  expect(external).toContain('onCreate={createFromPicker}');
  expect(external).toContain('onLink={id=>{setSelectedId(id)');
  expect(external).toContain('setSelectedId(id);');
  expect(external).toContain('<ExternalQuoteSentForm key={selected.id}');
  expect(external).not.toContain('newDealOpen');
 });
 it('supports in-place Company create/link during Person and Deal creation in Activity',()=>{
  const activity=source('src/components/ActivityRelatedQuickCreate.tsx');
  const picker=source('src/components/UnifiedRecordPicker.tsx');
  const styles=source('src/activity-related-create.css');
  expect(activity).toContain('<UnifiedRecordPicker kind="Company"');
  expect(activity).toContain('onCreate={createCompanyWhileLogging}');
  expect(activity).toContain('onLink={id=>{setCompanyId(id);setCreatedCompanyId(null);}}');
  expect(activity).toContain("setCreatedCompanyId(id)");
  expect(activity).toContain("companyId:companyId||undefined");
  expect(activity).toContain("if(companyId)relinkDealCompany(id,companyId)");
  expect(activity).toContain("!event.target.closest('.ss-unified-record-picker')");
  expect(activity).not.toContain('<select disabled={disabled} value={companyId}');
  expect(styles).toContain('.activity-related-company-picker .ss-unified-picker-panel');
  expect(picker).toContain('const exactMatch=items.find');
  expect(picker).toContain('e.preventDefault();e.stopPropagation()');
  expect(picker).toContain('if(one){void run(()=>onLink(one.id));return;}');
  expect(picker).toContain('if(!matches.length&&onCreate&&needle)');
 });
 it('dismisses nested record pickers safely and guards duplicate cloud creates',()=>{
  const picker=source('src/components/UnifiedRecordPicker.tsx');
  const css=source('src/record-unified-picker.css');
  const parent=source('src/lib/useDismissibleLayer.ts');
  expect(picker).toContain('useDismissiblePopover(rootRef,open');
  expect(picker).toContain("'.ss-unified-picker-trigger'");
  expect(picker).toContain('const pendingRef=useRef(false)');
  expect(picker).toContain('if(pendingRef.current||disabled)return');
  expect(picker).toContain('pendingRef.current=true');
  expect(picker).toContain('finally{pendingRef.current=false;setSaving(false);}');
  expect(picker).toContain('if(saving||!needle)return');
  expect(picker).toContain('disabled={disabled||saving}');
  expect(picker).toContain('const stillInside=Boolean(rootRef.current?.contains(document.activeElement))');
  expect(parent).toContain("layerRef.current?.querySelector('.ss-unified-picker-panel')");
  expect(css).toContain('max-height:min(25dvh,180px)');
  expect(css).toContain('overscroll-behavior:contain');
  expect(picker).toContain('aria-busy={saving}');
  expect(picker).toContain("saving?'Saving…'");
  expect(picker).toContain('matching.length>matches.length');
  expect(picker).toContain('Showing {matches.length} of {matching.length}');
  expect(picker).toContain('if(stillInside)window.requestAnimationFrame');
  expect(picker).toContain('if(focused!==document.body&&!rootRef.current?.contains(focused))return;');
  expect(css).toContain('.ss-unified-picker-limit');
 });
 it('renders a symmetric, readable shared pin used by the worktables and Materials',()=>{
  const icon=renderToStaticMarkup(<WorkspaceChromeIcon name="pin"/>);
  expect(icon).toContain('M9 3h6v6l3 4v2H6v-2l3-4V3Z');
  expect(icon).toContain('M12 15v6');
  expect(icon).not.toContain('m16 3 5 5-4 1-4 5');
  expect(source('src/components/ConnectionsTable.tsx')).toContain('<WorkspaceChromeIcon name="pin"/>');
  expect(source('src/components/MaterialsWorkspace.tsx')).toContain('<WorkspaceChromeIcon name="pin"/>');
 });
});