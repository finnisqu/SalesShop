import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, Field, PageHeader } from './components';
import { PHONE_LAYOUT_QUERY, isPhoneLayoutViewport } from '../lib/mobileViewport';

const load=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const board=load('../components/Board.tsx');
const accounts=load('../components/AccountsBoard.tsx');
const quotes=load('../components/Quotes.tsx');
const notebook=load('../App.tsx');
const boardCss=load('./board-adapter.css');
const quotesCss=load('./quotes-adapter.css');
const notebookCss=load('./notebook-chrome-adapter.css');
const main=load('../main.tsx');

describe('UI Foundation Batch 7 — Board / Quotes / Notebook',()=>{
  it('renders common Board heading, button toggle and accessible quick project field',()=>{
    const header=renderToStaticMarkup(<PageHeader
      eyebrow="Sales pipeline" title="Projects"
      actions={<Button variant="quiet" aria-pressed={true}>Projects</Button>}
    />);
    expect(header).toContain('ss-page-header__title');
    expect(header).toContain('aria-pressed="true"');
    const field=renderToStaticMarkup(<Field label="Quick project" id="new-project-name">
      {(control)=><input {...control} value="Example" readOnly />}
    </Field>);
    expect(field).toContain('for="new-project-name"');
    expect(field).toContain('id="new-project-name"');
    expect(board).toContain('<PageHeader className="board-header-panel board-foundation-header"');
    expect(board).toContain('<Field id="new-project-name" label="Quick project"');
    expect(board).toContain('<Button type="submit" variant="secondary" disabled={!newName.trim()}>Add</Button>');
    expect(board).toContain('onSubmit={quickAdd}');
    expect(boardCss).toContain('.board-quick-add > .board-foundation-quick-field');
    expect(boardCss).toContain('grid-template-columns:minmax(0,1fr)');
  });

  it('reuses the same Board header on Accounts without losing CRM and stage interactions',()=>{
    expect(accounts).toContain('className="board-header-panel accounts-header-panel board-foundation-header"');
    expect(accounts).toContain('onClick={onShowProjects}');
    expect(accounts).toContain('onClick={() => setCleanupOpen(true)}');
    expect(accounts).toContain('<MobileBoardStagePicker');
    expect(accounts).toContain('<BoardScrollControls');
    expect(board).toContain('onDrop={(event) => dropOnStage(event, stage)}');
    expect(board).toContain('rememberMobileColumnScroll');
    expect(boardCss).toContain('overflow-x:auto;');
    expect(boardCss).toContain('overflow-y:hidden;');
    expect(boardCss).toContain('.board-card-stack');
    expect(boardCss).toContain('overflow-y:auto;');
  });

  it('aligns Quotes phone-landscape initial state and its CSS layout contract',()=>{
    expect(isPhoneLayoutViewport(844,390,true)).toBe(true);
    expect(isPhoneLayoutViewport(1024,768,true)).toBe(false);
    expect(quotes).toContain('window.matchMedia(PHONE_LAYOUT_QUERY).matches');
    expect(quotes).not.toContain("window.matchMedia('(max-width: 700px)').matches");
    expect(quotes).toContain('<QuoteEditor quote={quote} mode={mode}');
    expect(quotes).toContain('onOpenMobileNavigator={() => setMobileNavigatorOpen(true)}');
    expect(quotes).toContain("onClick={() => setMobileNavigatorOpen(false)}");
    const quoteMobileCss=load('../quote-mobile-pass.css');
    expect(quoteMobileCss).toContain(`@media ${PHONE_LAYOUT_QUERY} {`);
    expect(quoteMobileCss).not.toContain('@media (max-width: 700px) {');
    expect(quotesCss).toContain(`@media ${PHONE_LAYOUT_QUERY} {`);
  });

  it('keeps quote customer document and send/approval logic outside themed chrome',()=>{
    expect(quotes).toContain('<CustomerPreview quote={quote} />');
    expect(quotes).toContain('commerciallyEditable');
    expect(quotes).toContain('canIssueQuote');
    expect(quotes).toContain('recordSent(quote.id)');
    expect(quotes).toContain('quoteCanCreateRevision');
    expect(quotesCss).toContain('.sales-app.view-quotes .quote-list-item.active');
    expect(quotesCss).toContain('.quote-mobile-menu-scroll');
    expect(quotesCss).toContain('.quote-mobile-menu-footer');
    expect(quotesCss).not.toMatch(/\n\s*[^*\n]*\.customer-quote-paper\s*\{/);
    expect(quotesCss).not.toMatch(/\n\s*[^*\n]*\.customer-quote-letterhead\s*\{/);
    expect(quotesCss).not.toMatch(/\n\s*[^*\n]*\.paper-sheet\s*\{/);
  });

  it('themes Notebook sidebar and toolbar but preserves physical paper and text/ink engines',()=>{
    expect(notebook).toContain('className="notebook-workspace"');
    expect(notebook).toContain('<Sidebar />');
    expect(notebook).toContain('<Toolbar entry={entry} editor={notebookEditor} />');
    expect(notebook).toContain('className={`paper-sheet paper-${entry.paperStyle}');
    expect(notebook).toContain('<TextEditor key={`text-${entry.id}`}');
    expect(notebook).toContain('<DrawingCanvas key={`ink-${entry.id}`}');
    expect(notebook).toContain('<NotebookObjectLayer key={`objects-${entry.id}`}');
    expect(notebookCss).toContain('.sales-app.view-notebook .notebook-sidebar');
    expect(notebookCss).toContain('.sales-app.view-notebook .paper-toolbar');
    expect(notebookCss).toContain('.sales-app.view-notebook .page-tab.active');
    expect(notebookCss).toContain('background:#fff9df;');
    expect(notebookCss).not.toMatch(/\n\s*[^*\n]*\.paper-sheet\s*\{/);
    expect(notebookCss).not.toMatch(/\n\s*[^*\n]*\.paper-writing-surface\s*\{/);
    expect(notebookCss).toContain(`@media ${PHONE_LAYOUT_QUERY} {`);
  });

  it('uses paired foreground/background colors and loads adapters in sequence',()=>{
    const csses=[boardCss,quotesCss,notebookCss];
    for(const c of csses){
      expect(c).toContain('var(--ss-theme-ink');
      expect(c).toContain('var(--ss-theme-muted');
      expect(c).toContain('var(--ss-theme-card');
      expect(c).toContain('var(--ss-theme-border');
      expect(c).toContain('outline:3px solid var(--ss-focus)');
      expect(c).not.toContain('calc(100dvh - 50px)');
    }
    const imports=[
      "import './design-system/catalog-qc.css';",
      "import './design-system/board-adapter.css';",
      "import './design-system/quotes-adapter.css';",
      "import './design-system/notebook-chrome-adapter.css';",
    ].map(s=>main.indexOf(s));
    expect(imports.every(n=>n>=0)).toBe(true);
    expect(imports).toEqual([...imports].sort((a,b)=>a-b));
  });
});
