import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SectionTabs, Field, PageHeader, StatusText } from './components';

const page = readFileSync(new URL('../components/Connections.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./connections-adapter.css', import.meta.url), 'utf8');
const recordsCss = readFileSync(new URL('../connections-record-pages.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

describe('Connections foundation — privacy-first navigation', () => {
  it('uses shared section navigation for Companies, People and Deals only', () => {
    const items = [
      { id:'companies',label:'Companies',description:'Accounts & partners' },
      { id:'people',label:'People',description:'Contacts' },
      { id:'deals',label:'Deals',description:'Opportunities & jobs' },
    ] as const;
    const html = renderToStaticMarkup(<SectionTabs aria-label="Connections sections"
      items={items} selected="companies" onSelect={() => {}} className="connections-tabs" />);
    expect(html).toContain('class="ss-section-tabs connections-tabs"');
    expect(html).toContain('aria-label="Connections sections"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Accounts &amp; partners');
    expect((html.match(/aria-current="page"/g) ?? [])).toHaveLength(1);
    expect((html.match(/type="button"/g) ?? [])).toHaveLength(items.length);
  });

  it('composes the readable header and accessible directory fields without reporting panels', () => {
    const header = renderToStaticMarkup(<PageHeader className="connections-heading"
      eyebrow="SalesShop" title="Connections" description="Relationships" />);
    expect(header).toContain('ss-page-header__title');
    expect(header).toContain('connections-heading');
    expect(header).toContain('Relationships');
    const field = renderToStaticMarkup(<Field id="connections-directory-search" label="Search companies">
      {(props) => <input {...props} type="search" value="stone" readOnly />}
    </Field>);
    expect(field).toContain('for="connections-directory-search"');
    expect(field).toContain('id="connections-directory-search"');
    expect(field).toContain('type="search"');
    expect(renderToStaticMarkup(<StatusText state="empty">No people match</StatusText>)).toContain('role="status"');
  });

  it('keeps CRM creation, search, filters, quote links and an optional history utility', () => {
    for (const code of [
      "'companies'", "'people'", "'deals'", '<SectionTabs', '<PageHeader', '<Field', '<StatusText',
      'resolveCompany(name, newCompanyKind)', 'createContact({', 'openPerson(person.id)', 'openPerson(id)',
      'openCompany(company.id)', 'openProject(project.id)',
      'quotesForCompany(company, projects, quotes)', 'quotesForProject(project, quotes)',
      'setCompanyFilter', 'setQuery', 'connections-section-more', "chooseTab('activity')",
    ]) expect(page, `Missing Connections capability: ${code}`).toContain(code);
    expect(page).not.toContain("id: 'overview'");
    expect(page).not.toContain("id: 'activity'");
    expect(page).not.toContain('<Dashboard />');
    expect(page).not.toContain('connections-workspace-summary');
  });

  it('preserves design tokens and legacy dashboard styles without rendering that dashboard', () => {
    expect(css).toContain('.sales-app.view-dashboard');
    for (const part of ['.connections-tabs.ss-section-tabs',
      '.connections-record','.dashboard-kpi','.dashboard-panel',
      '.connections-directory-toolbar .ss-field','.connections-overview']) {
      expect(css, `Missing preserved design contract for ${part}`).toContain(part);
    }
    expect(css).toContain('--ss-connections-ink');
    expect(css).toContain('--ss-connections-card');
    expect(css).toContain('overflow-y:auto');
    expect(css).not.toContain('calc(100dvh - 50px)');
    expect(css).not.toContain('!important');
    expect(entry.indexOf("import './design-system/connections-adapter.css'"))
      .toBeGreaterThan(entry.indexOf("import './appearance-contrast.css'"));
    expect(recordsCss).toContain('connections-section-row');
    expect(recordsCss).toContain('connections-more-menu');
    expect(recordsCss).toContain('connections-record-history');
  });

  it('retains mobile directory scrolling, accessible tools and settings navigation', () => {
    expect(css).toContain('overflow-x:auto');
    expect(css).toContain('scroll-snap-type:x proximity');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('font-size:16px');
    expect(css).toContain('height:auto');
    expect(css).toContain('.connections-footer');
    expect(page).toContain("setView('settings')");
  });
});
