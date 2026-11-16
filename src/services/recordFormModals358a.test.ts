import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
describe('Centered create/edit modals #358a',()=>{
 it('Files creation and editing share a centered, focus-managed portal',()=>{
  const s=read('components/FileLinksManager.tsx');
  expect(s).toContain('createPortal(<div className="ss-record-form-backdrop"');
  expect(s).toContain('useDismissibleLayer<HTMLElement>(showForm,closeForm)');
  expect(s).toContain('useModalScrollLock(showForm)');
  expect(s).toContain('onSubmit={submit}');
  expect(s).toContain('aria-modal="true"');
  expect(s).toContain('Save link');
 });
 it('Our Org +Person uses same modal without changing role/roster save logic',()=>{
  const s=read('components/OurOrganizationDirectory.tsx');
  expect(s).toContain('createPortal(<div className="ss-record-form-backdrop"');
  expect(s).toContain('useDismissibleLayer<HTMLElement>(showEditor&&editable,closeEditor)');
  expect(s).toContain('ensureOurOrgCompany(');
  expect(s).toContain('onSubmit={save}');
  expect(s).not.toContain('scrollIntoView(');
 });
 it('both use a responsive full-screen backdrop and fixed-width themed dialog',()=>{
  const s=read('components/record-form-modal.css');
  expect(s).toContain('position:fixed;inset:0');
  expect(s).toContain('place-items:center');
  expect(s).toContain('max-height:calc(100dvh - 24px)');
 });
});