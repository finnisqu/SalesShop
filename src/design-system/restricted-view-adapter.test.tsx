import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, Field, PageHeader } from './components';
import { PHONE_LAYOUT_QUERY, isPhoneLayoutViewport } from '../lib/mobileViewport';
import { OWNER_PERSPECTIVES, resolveOwnerPerspective } from '../services/rolePerspective';

const load=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const viewer=load('../components/ViewerWorkspace.tsx');
const app=load('../App.tsx');
const roleControls=load('../components/RolePerspectiveControls.tsx');
const chrome=load('../components/MobileAppChrome.tsx');
const styles=load('./restricted-view-adapter.css');
const main=load('../main.tsx');

describe('UI Foundation Batch 8 — role-aware shared shell',()=>{
  it('renders the shared Viewer header, labeled search, and disclosure buttons',()=>{
    const header=renderToStaticMarkup(<PageHeader title="Quotes"
      eyebrow="Workspace access · Viewer"
      description="Read-only access" actions={<span>View only</span>} />);
    expect(header).toContain('ss-page-header__title');
    expect(header).toContain('Read-only access');
    const field=renderToStaticMarkup(<Field id="viewer-workspace-search" label="Find in quotes">
      {(control)=><input {...control} type="search" value="Quartz" readOnly />}
    </Field>);
    expect(field).toContain('for="viewer-workspace-search"');
    expect(field).toContain('id="viewer-workspace-search"');
    const disclosure=renderToStaticMarkup(<Button variant="secondary" aria-expanded={true}>Hide details</Button>);
    expect(disclosure).toContain('aria-expanded="true"');
    expect(disclosure).toContain('type="button"');
    expect(viewer).toContain('<PageHeader className="viewer-workspace-header viewer-foundation-header"');
    expect(viewer).toContain('<Field id="viewer-workspace-search"');
    expect(viewer).toContain('aria-expanded={selectedProjectId === project.id}');
    expect(viewer).toContain('aria-expanded={selectedQuoteId === quote.id}');
  });

  it('preserves read-only behavior across the four restricted workspace routes',()=>{
    for(const snippet of [
      "section === 'board'","section === 'quotes'","section === 'catalog'",
      "section === 'dashboard'","setSelectedProjectId(","setSelectedQuoteId(",
      "setCatalogSection('suppliers')","quoteLineTotal(line)",
      "useCompanySettingsStore","useCrmStore","useQuoteStore"
    ])expect(viewer,`Read-only feature missing: ${snippet}`).toContain(snippet);
    expect(viewer).not.toContain('updateQuote(');
    expect(viewer).not.toContain('updateProject(');
    expect(viewer).not.toContain('updateCompany(');
    expect(viewer).not.toContain('saveMaterial(');
  });

  it('never mistakes simulated permissions for authenticated backend access',()=>{
    expect(OWNER_PERSPECTIVES.map(p=>p.label)).toEqual([
      'Admin','General Member','Salesperson','Estimator','Purchasing','Project Manager','Viewer',
    ]);
    expect(resolveOwnerPerspective('viewer','owner','cloud')?.role).toBe('viewer');
    expect(resolveOwnerPerspective('estimator','owner','cloud')?.department).toBe('estimator');
    expect(resolveOwnerPerspective('viewer','admin','cloud')).toBeNull();
    expect(app).toContain('inert={inRolePreview && !readOnlyArea && view !== \'settings\'}');
    expect(app).toContain('<RolePerspectiveBanner />');
    expect(app.indexOf('<RolePerspectiveBanner />')).toBeLessThan(app.indexOf('<WorkspaceViewport'));
    expect(roleControls).toContain('Exit role preview and return to Owner');
    expect(roleControls).toContain('does not test server permissions');
    expect(roleControls).toContain('onClick={exit}');
  });

  it('preserves hamburger navigation in Owner preview and real Viewer paths',()=>{
    expect(chrome).toContain("if (view === 'quotes' && !quoteReadOnly && !preview && !(quoteLibraryMode === 'team'");
    expect(chrome).toContain("teamRole === 'owner' || teamRole === 'admin'");
    expect(chrome).toContain('useQuoteLibraryStore');
    expect(chrome).toContain('aria-label="Open SalesShop navigation"');
    expect(chrome).toContain('mobile-app-drawer-backdrop');
    expect(chrome).toContain('mobile-catalog-section-list');
    expect(chrome).toContain('onClick={() => { setCatalogSection(item.id); setCatalogExpanded(false); setOpen(false); }}');
    const mobile=load('../mobile-app-shell.css');
    expect(mobile).toContain('.sales-app.view-quotes:is(.sales-app-viewer, .owner-perspective-active) > .mobile-app-commandbar');
  });

  it('provides all-palette Viewer surfaces, readable status cues and a scrolling route',()=>{
    for(const target of [
      '.viewer-workspace','.viewer-foundation-header','.viewer-role-pill',
      '.viewer-foundation-search','.viewer-record','.viewer-metrics>div',
      '.viewer-details','.viewer-line','.viewer-purchasing-jump .ss-button',
      '.role-perspective-settings-card','.role-perspective-capability',
    ])expect(styles,`Theme rule missing: ${target}`).toContain(target);
    expect(styles).toContain('--ss-restricted-ink');
    expect(styles).toContain('--ss-restricted-card');
    expect(styles).toContain('--ss-restricted-muted');
    expect(styles).toContain('overflow-y:auto;');
    expect(styles).toContain('outline:3px solid var(--ss-focus)');
  });

  it('keeps the preview escape visible and a mobile search usable after rotating',()=>{
    expect(isPhoneLayoutViewport(844,390,true)).toBe(true);
    expect(isPhoneLayoutViewport(1024,768,true)).toBe(false);
    expect(styles).toContain(`@media ${PHONE_LAYOUT_QUERY} {`);
    expect(styles).toContain('(orientation: landscape) and (max-height: 520px) and (pointer: coarse)');
    expect(styles).toContain('.role-perspective-escape');
    expect(styles).toContain('min-height:40px');
    expect(styles).toContain('flex-wrap:nowrap;');
    expect(styles).toContain('font-size:16px;');
    expect(styles).toContain('.viewer-foundation-header .ss-page-header__description');
    expect(styles).toContain('display:none;');
  });

  it('loads Viewer/preview adapter after existing workspace adapters',()=>{
    const imports=[
      "import './design-system/catalog-qc.css';",
      "import './design-system/board-adapter.css';",
      "import './design-system/quotes-adapter.css';",
      "import './design-system/notebook-chrome-adapter.css';",
      "import './design-system/restricted-view-adapter.css';",
    ].map(imp=>main.indexOf(imp));
    expect(imports.every(n=>n>=0)).toBe(true);
    expect(imports).toEqual([...imports].sort((a,b)=>a-b));
    // Notebook ink and customer documents are intentionally not themed by this adapter.
    expect(styles).not.toMatch(/\n\s*[^*\n]*\.paper-sheet\s*\{/);
    expect(styles).not.toMatch(/\n\s*[^*\n]*\.customer-quote-paper\s*\{/);
  });
});
