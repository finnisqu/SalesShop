import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
describe('Notebook mobile toolbar + shared preview chrome',()=>{
 it('puts formatting and Pencil/Finger input inside an accessible mobile Aa menu',()=>{
  const toolbar=read('src/components/Toolbar.tsx');
  const css=read('src/notebook-responsive-polish.css');
  expect(toolbar).toContain("'drawing' | 'page' | 'format' | null");
  expect(toolbar).toContain('notebook-toolbar-format-button');
  expect(toolbar).toContain('aria-expanded={openMenu===\'format\'}');
  expect(toolbar).toContain('notebook-mobile-format-popover');
  for(const action of ['toggleBold','toggleItalic','toggleHeading','toggleBulletList',
   'toggleOrderedList','toggleBlockquote']){
   expect(toolbar).toContain(action);
  }
  expect(toolbar).toContain("setInputMode('pencil')");
  expect(toolbar).toContain("setInputMode('finger')");
  expect(css).toContain('.paper-toolbar>.rich-text-tools');
  expect(css).toContain('.paper-toolbar>.notebook-input-toggle');
  expect(css).toContain('max-height:min(65dvh,375px)');
 });
 it('makes similar Task and Activity quick views share header/close/footer primitives',()=>{
  const task=read('src/components/TaskModalHost.tsx');
  const activity=read('src/components/CalendarActivityPreview.tsx');
  for(const source of [task,activity]){
   expect(source).toContain('PreviewPanelHeading');
   expect(source).toContain('PreviewPanelClose');
   expect(source).toContain('PreviewPanelActions');
   expect(source).toContain('ss-unified-preview-header');
   expect(source).toContain('ss-mobile-sheet-actions');
   expect(source).toContain('MobileSheetHandle');
  }
  expect(task).toContain('isProtectedBidTask(task)');
  expect(activity).toContain('TaskAssociationsField');
  expect(activity).toContain('disabled={saving}');
 });
 it('keeps actionable focus and safe area while retaining worktable record preview layout',()=>{
  const css=read('src/mobile-preview-sheet-parity.css');
  const record=read('src/components/RecordPreviewDrawer.tsx');
  expect(css).toContain('.ss-unified-preview-header .ss-preview-close:focus-visible');
  expect(css).toContain('env(safe-area-inset-bottom)');
  expect(record).toContain('PreviewPanelClose');
  expect(record).toContain('PreviewPanelActions');
 });
 it('shows only the date for untitled Notebook pages in both navigation menus',()=>{
  const app=read('src/App.tsx');
  expect(app).toContain('label:notebookPageNavigationLabel(candidate)');
  expect(app).toContain('mobileTabs={notebookPageOptions}');
  expect(app).toContain('notebookPageOptions.map(page=>');
  const helper=read('src/services/notebookPageNavigationLabel.ts');
  expect(helper).toContain("month:'short',day:'numeric',year:'numeric'");
  expect(helper).not.toContain("hour:'numeric'");
 });
 it('uses consistent main-toolbar button heights on phone and desktop',()=>{
  const css=read('src/notebook-responsive-polish.css');
  expect(css).toContain('--ss-notebook-toolbar-control-height:34px');
  expect(css).toContain('--ss-notebook-toolbar-control-height:43px');
  expect(css).toContain('min-height:var(--ss-notebook-toolbar-control-height)!important');
  expect(css).toContain('max-height:var(--ss-notebook-toolbar-control-height)!important');
  expect(css).toContain('> :is(.notebook-history-tools,.rich-text-tools,.notebook-input-toggle,.notebook-toolbar-menu,.tool-group)');
 });
});
