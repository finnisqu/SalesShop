import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const code=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('UI cleanup batch #372',()=>{
 it('keeps a context-only working draft shortcut in desktop and mobile navigation',()=>{
  const app=code('App.tsx'),mobile=code('components/MobileAppChrome.tsx');
  expect(app).toContain('ss-working-quote-tab');
  expect(app).toContain("q.status==='Draft'||q.status==='Ready'");
  expect(app).toContain('useNavigationStore.getState().openQuote(workingQuote.id)');
  expect(mobile).toContain('ss-mobile-working-quote');
  expect(mobile).toContain('Working quote');
  expect(mobile).toContain('openQuote(workingQuote.id)');
  expect(app).toContain('!q.archivedAt');
 });
 it('uses a clickable Draft status menu and reuses guarded permanent delete confirmation',()=>{
  const editor=code('components/QuotesMobileBeta.tsx');
  const menu=code('components/QuoteDraftStatusMenu372.tsx');
  expect(editor).toContain('<QuoteDraftStatusMenu372');
  expect(editor).toContain('canPermanentlyDeleteQuote(quote,quotes)');
  expect(editor).toContain('onDelete={requestDocumentDelete}');
  expect(editor).toContain("setLibraryAction({id:quote.id,kind:'delete'})");
  expect(editor).toContain('Delete unsent draft?');
  expect(editor).toContain('if(canPermanentlyDeleteQuote(chosen,useQuoteStore.getState().quotes))');
  expect(menu).toContain('Delete this Quote draft…');
  expect(menu).toContain('useDismissibleDetails(ref)');
 });
 it('shrinks quick-preview actions without horizontal scrolling or redundant external quote capture',()=>{
  const preview=code('components/RecordPreviewDrawer.tsx');
  const css=code('quick-view-action-row.css');
  expect(preview).not.toContain('data-mobile-label="Bid sent"');
  expect(preview).toContain('data-mobile-label="Full page"');
  expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
  expect(css).toContain('overflow-x:visible!important');
 });
 it('groups Company, Deal, Person resources and Connections into compact tabbed panels',()=>{
  const tab=code('components/RecordTabbedGroup372.tsx');
  expect(tab).toContain('role="tablist"');
  expect(tab).toContain('aria-selected={selected.id===item.id}');
  for(const path of ['CompanyRecordPage','DealRecordPage','PersonRecordPage']){
   const source=code('components/'+path+'.tsx');
   expect(source).toContain('<RecordTabbedGroup372 title="Connections"');
   expect(source).toContain('historyCount={');
   expect(source).toContain('<RecordRecentsPanel');
  }
  const company=code('components/CompanyRecordPage.tsx');
  expect(company).toContain('title={company.name} personalTarget="company" initialTab="about"');
  expect(company).toContain("label:'Forecast'");
  expect(company).toContain("label:'Files'");
  expect(company).toContain("label:'Notebook'");
  const deal=code('components/DealRecordPage.tsx');
  expect(deal).toContain('title={deal.name} personalTarget="deal" initialTab="about"');
  expect(deal).toContain("label:'People'");
  expect(deal).toContain("label:'Tasks'");
  expect(code('components/RecordRecentsPanel.tsx')).toContain('History <span>');
 });
 it('fixes the Deal People sliver, Tools active tabs and calendar popover borders',()=>{
  expect(code('deal-person-relationships.css')).toContain('grid-template-columns:minmax(0,1fr) auto');
  expect(code('components/tools-workspace.css')).toContain('[aria-selected="true"]');
  expect(code('components/sales-calendar.css'))
   .toContain('.sales-calendar-popover:not(.is-inline) .sales-calendar-day');
 });
 it('defaults new tasks to local Today, retaining specific supplied or recovered due dates',()=>{
  const host=code('components/TaskModalHost.tsx');
  const editor=code('components/TasksWorkspace.tsx');
  expect(host).toContain('dueDate:request.dueDate');
  expect(editor).toContain("draft.dueDate??recovered?.dueDate??localDay()");
  expect(editor).toContain("recovered?.dueDate??draft.dueDate??''");
 });
});
