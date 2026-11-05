import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {PreviewPanelHeading,PreviewPanelClose,PreviewPanelActions} from '../components/PreviewPanelChrome';
const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Desktop preview and record-editor consistency',()=>{
 it('offers reusable, accessible panel identity, close, and action slots',()=>{
  const html=renderToStaticMarkup(<section>
   <header><PreviewPanelHeading eyebrow="DEAL · QUICK VIEW" title="Example deal"
     detail="Multifamily · Bid Sent"/>
    <PreviewPanelClose onClose={()=>{}} label="Close deal preview"/></header>
   <PreviewPanelActions className="record-preview-actions">
    <button type="button">New task</button><button type="button">Open record</button>
   </PreviewPanelActions>
  </section>);
  expect(html).toContain('ss-preview-heading');
  expect(html).toContain('ss-preview-eyebrow');
  expect(html).toContain('DEAL · QUICK VIEW');
  expect(html).toContain('Multifamily · Bid Sent');
  expect(html).toContain('data-dialog-initial-focus');
  expect(html).toContain('aria-label="Close deal preview"');
  expect(html).toContain('ss-preview-actions record-preview-actions');
  expect(html).toContain('New task');
 });
 it('uses the same header/close/actions in CRM, Task, and Quote Area previews',()=>{
  const crm=src('components/RecordPreviewDrawer.tsx');
  const tasks=src('components/TasksWorkspace.tsx');
  const quote=src('components/QuoteAreaQuickPanel.tsx');
  for(const page of [crm,tasks,quote]){
   expect(page).toContain('PreviewPanelHeading');
   expect(page).toContain('PreviewPanelClose');
   expect(page).toContain('PreviewPanelActions');
   expect(page).toContain('aria-modal="true"');
  }
  expect(crm).toContain('className="record-preview-actions"');
  expect(crm).toContain('requestTaskModal(');
  expect(crm).toContain('openActivityComposer(');
  expect(quote).toContain('className="qmb-quick-area-footer"');
  expect(quote).toContain('onFull(initialTab');
  expect(quote).toContain('onTab(key)');
  expect(tasks).toContain('className="tasks-preview-card"');
  expect(tasks).toContain('PreviewPanelActions>');
  expect(tasks).toContain('previewRef=useDismissibleLayer<HTMLElement>(Boolean(viewing)');
 });
 it('keeps deal, task, activity and full record page save workflows intact',()=>{
  const board=src('components/Board.tsx');
  const tasks=src('components/TasksWorkspace.tsx');
  const activity=src('components/QuickActivityLauncher.tsx');
  const record=src('components/RecordPageLayout.tsx');
  for(const page of [board,tasks,activity]){
   expect(page).toContain('ss-record-editor-actions');
   expect(page).toContain('PreviewPanelClose');
  }
  expect(board).toContain('await assignProject(project.id');
  expect(board).toContain('updateProject(project.id, patch)');
  expect(tasks).toContain('editorRef=useDismissibleLayer<HTMLFormElement>(true,close)');
  expect(tasks).toContain('onSave({title:title.trim()');
  expect(activity).toContain('activityRef=useDismissibleLayer<HTMLFormElement>(open&&permitted');
  expect(activity).toContain('if(!saving)close()');
  expect(activity).toContain('clearSavedDraft(draftKey)');
  expect(activity).toContain('record(');
  expect(record).toContain('connections-record-actions ss-record-page-actions');
  for(const entity of ['CompanyRecordPage','PersonRecordPage','DealRecordPage']){
   expect(src('components/'+entity+'.tsx')).toContain('connections-record-form-actions ss-record-editor-actions');
  }
 });
 it('centralizes only desktop sizing, leaving mobile panels as before',()=>{
  const css=src('desktop-preview-record-consistency.css');
  const main=src('main.tsx');
  expect(css).toContain('@media(min-width:821px)');
  expect(css).not.toContain('@media(max-width:');
  for(const selector of ['.ss-preview-heading','.ss-preview-close','.ss-preview-actions',
    '.ss-record-editor-actions','.ss-record-page-actions',
    '.record-preview-panel','.qmb-quick-area-panel','.tasks-preview-card']){
   expect(css).toContain(selector);
  }
  expect(css).toContain('scrollbar-gutter:stable');
  expect(css).toContain('--ss-preview-control-height:38px');
  expect(main.indexOf("import './desktop-preview-record-consistency.css'"))
   .toBeGreaterThan(main.indexOf("import './shared-desktop-interactions.css'"));
 });
});
