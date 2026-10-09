import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SectionTabs, Field, PageHeader, Panel, Button, StatusText } from './components';

const page = readFileSync(new URL('../components/Connections.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./connections-adapter.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

describe('UI Foundation Batch 4 — Connections', () => {
  it('renders shared section navigation with a clear current page and all sections', () => {
    const items = [
      { id:'overview',label:'Overview',description:'Sales dashboard' },
      { id:'companies',label:'Companies',description:'Accounts & partners' },
      { id:'people',label:'People',description:'Contacts' },
    ] as const;
    const html = renderToStaticMarkup(<SectionTabs aria-label="Connections sections"
      items={items} selected="companies" onSelect={() => {}} className="connections-tabs" />);
    expect(html).toContain('class="ss-section-tabs connections-tabs"');
    expect(html).toContain('aria-label="Connections sections"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Companies');
    expect(html).toContain('Accounts &amp; partners');
    expect((html.match(/aria-current="page"/g) ?? [])).toHaveLength(1);
    expect((html.match(/type="button"/g) ?? [])).toHaveLength(items.length);
  });

  it('composes the header, reporting panel and accessible directory fields', () => {
    const header = renderToStaticMarkup(<PageHeader className="connections-heading"
      eyebrow="SalesShop" title="Connections" description="Customer relationships"
      actions={<strong>12 companies</strong>} />);
    expect(header).toContain('ss-page-header__title');
    expect(header).toContain('connections-heading');
    expect(header).toContain('Customer relationships');
    const panel = renderToStaticMarkup(<Panel className="connections-scope-strip"
      heading={<strong>Reporting view</strong>}>
      <Button variant="quiet">Workspace</Button>
    </Panel>);
    expect(panel).toContain('ss-panel__header');
    expect(panel).toContain('ss-panel__body');
    expect(panel).toContain('Reporting view');
    expect(panel).toContain('type="button"');
    const field = renderToStaticMarkup(<Field id="connections-directory-search" label="Search companies">
      {(props) => <input {...props} type="search" value="stone" readOnly />}
    </Field>);
    expect(field).toContain('for="connections-directory-search"');
    expect(field).toContain('id="connections-directory-search"');
    expect(field).toContain('type="search"');
    expect(renderToStaticMarkup(<StatusText state="empty">No people match</StatusText>))
      .toContain('role="status"');
  });

  it('preserves all six CRM sections, company filters, quote links and actual record actions', () => {
    for (const text of [
      'overview', 'companies', 'people', 'projects', 'quotes', 'activity',
      '<SectionTabs', '<PageHeader', '<Panel', '<Field', '<StatusText',
      'resolveCompany(name, newCompanyKind)', 'createContact({', 'updateContact(editingPersonId',
      'openCompany(company.id)', 'openProject(project.id)', 'openQuote(quote.id)',
      'setCompanyFilter', 'setQuery', '<Dashboard />',
    ]) {
      expect(page, `Missing Connections feature or component: ${text}`).toContain(text);
    }
  });

  it('uses only route-scoped palette tokens and no fixed viewport subtraction', () => {
    expect(css).toContain('.sales-app.view-dashboard');
    for (const part of ['.connections-tabs.ss-section-tabs','.connections-foundation-scope.ss-panel',
      '.connections-record','.dashboard-kpi','.dashboard-panel',
      '.connections-directory-toolbar .ss-field','.connections-overview']) {
      expect(css, `Missing shared design contract for ${part}`).toContain(part);
    }
    expect(css).toContain('--ss-connections-ink');
    expect(css).toContain('--ss-connections-card');
    expect(css).toContain('overflow-y:auto');
    expect(css).not.toContain('calc(100dvh - 50px)');
    expect(css).not.toContain('!important');
    expect(entry.indexOf("import './design-system/connections-adapter.css'"))
      .toBeGreaterThan(entry.indexOf("import './appearance-contrast.css'"));
  });

  it('keeps mobile tabs scrollable and empty states/navigation touch accessible', () => {
    expect(css).toContain('overflow-x:auto');
    expect(css).toContain('scroll-snap-type:x proximity');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('font-size:16px');
    expect(css).toContain('height:auto');
    expect(css).toContain('.connections-footer');
    expect(page).toContain("setView('settings')");
  });
});
