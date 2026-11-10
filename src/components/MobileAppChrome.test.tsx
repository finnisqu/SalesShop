import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  navigation: {
    view: 'catalog',
    catalogSection: 'materials',
    setView: () => {},
    setCatalogSection: () => {},
    goBack: () => {},
    history: [] as Array<{view:string}>,
  },
  notebook: {
    entries: [] as Array<{ id: string; title: string; hidden: boolean; favorite: boolean; updatedAt: string }>,
    activeEntryId: null as string | null,
    selectEntry: () => {},
    createEntry: () => {},
  },
  auth: { mode: 'cloud', teamRole: 'viewer', teamDepartment: 'general' },
  perspective: {
    activePerspective: null as string | null,
    startPerspective: () => {},
    exitPerspective: () => {},
  },
}));

vi.mock('../store/navigationStore', () => ({
  useNavigationStore: (selector: (state: typeof fixture.navigation) => unknown) => selector(fixture.navigation),
}));
vi.mock('../store/notebookStore', () => ({
  useNotebookStore: (selector: (state: typeof fixture.notebook) => unknown) => selector(fixture.notebook),
}));
vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: typeof fixture.auth) => unknown) => selector(fixture.auth),
}));
vi.mock('../store/rolePerspectiveStore', () => ({
  useRolePerspectiveStore: (selector: (state: typeof fixture.perspective) => unknown) => selector(fixture.perspective),
}));
vi.mock('../lib/useDismissibleLayer', () => ({ useDismissibleLayer: () => ({ current: null }) }));
vi.mock('./AuthGate', () => ({ AuthStatus: () => null }));
vi.mock('./GlobalSearch', () => ({ GlobalSearch: () => <button type="button">Search</button> }));
vi.mock('./QuickCreate', () => ({ QuickCreate: () => <button type="button">Create</button> }));

import { MobileAppChrome } from './MobileAppChrome';

describe('mobile shared navigation for restricted roles', () => {
  it('always renders the shared hamburger when Viewer browses Catalog', () => {
    fixture.navigation.view = 'catalog';
    fixture.auth.teamRole = 'viewer';
    fixture.perspective.activePerspective = null;
    const html = renderToStaticMarkup(<MobileAppChrome />);
    expect(html).toContain('class="mobile-app-commandbar"');
    expect(html).toContain('aria-label="Open SalesShop navigation"');
    expect(html).toContain('Catalog · Materials');
    expect(html).not.toContain('Search</button>');
  });

  it('renders hamburger when a Viewer browses Quotes (which has no editor toolbar)', () => {
    fixture.navigation.view = 'quotes';
    fixture.auth.teamRole = 'viewer';
    fixture.perspective.activePerspective = null;
    const html = renderToStaticMarkup(<MobileAppChrome />);
    expect(html).toContain('class="mobile-app-commandbar"');
    expect(html).toContain('aria-label="Open SalesShop navigation"');
    expect(html).toContain('<strong>Quotes</strong>');
  });

  it('keeps hamburger outside disabled role-preview workspaces', () => {
    fixture.navigation.view = 'catalog';
    fixture.auth.teamRole = 'owner';
    fixture.perspective.activePerspective = 'viewer';
    const html = renderToStaticMarkup(<MobileAppChrome />);
    expect(html).toContain('class="mobile-app-commandbar"');
    expect(html).toContain('aria-label="Open SalesShop navigation"');
    // Mobile role switcher is in the drawer, never a fifth header control.
    expect(html).not.toContain('Preview SalesShop as a team role');
  });

  it('offers Back to the previous SalesShop tab when navigation history exists', () => {
    fixture.navigation.view='board';
    fixture.navigation.history=[{view:'quotes'}];
    fixture.auth.teamRole='viewer';
    const html=renderToStaticMarkup(<MobileAppChrome/>);
    expect(html).toContain('aria-label="Back to previous SalesShop tab"');
    expect(html).toContain('class="mobile-app-back-button"');
    fixture.navigation.history=[];
  });

  it('shows full current page labels in the shared shell', () => {
    fixture.auth.teamRole = 'viewer';
    fixture.perspective.activePerspective = null;
    fixture.navigation.history = [];
    for (const [view, label] of [
      ['home', 'Home'], ['tasks', 'Tasks'], ['quotes', 'Quotes'],
    ] as const) {
      fixture.navigation.view = view;
      const html = renderToStaticMarkup(<MobileAppChrome />);
      expect(html).toContain('<strong>' + label + '</strong>');
    }
  });

  it('keeps the mobile commandbar flexible whether Back exists or not', () => {
    const css = readFileSync(new URL('../mobile-app-shell.css', import.meta.url), 'utf8');
    const standard = css.split('.sales-app:not(.view-quotes) > .mobile-app-commandbar {')[1]?.split('}')[0];
    const restricted = css.split('.sales-app.view-quotes:is(.sales-app-viewer, .owner-perspective-active) > .mobile-app-commandbar {')[1]?.split('}')[0];
    expect(standard).toContain('display: flex');
    expect(restricted).toContain('display: flex');
    expect(standard).not.toContain('grid-template-columns');
  });

  it('keeps an accessible Quote label in the editing toolbar', () => {
    const source = readFileSync(new URL('./MobileAppChrome.tsx', import.meta.url), 'utf8');
    expect(source).toContain('className="mobile-quote-toolbar-spacer mobile-app-current"');
    expect(source).toContain('<strong>Quote</strong>');
  });

  it('gives restricted Quotes routes an explicit CSS navigation fallback', () => {
    const css = readFileSync(new URL('../mobile-app-shell.css', import.meta.url), 'utf8');
    expect(css).toContain('.sales-app.view-quotes:is(.sales-app-viewer, .owner-perspective-active) > .mobile-app-commandbar');
    expect(css).toContain('.sales-app.sales-app-viewer > .mobile-app-commandbar');
  });
  it('keeps hamburger navigation to seven primary pages without duplicated page-specific controls',()=>{
    const source=readFileSync(new URL('./MobileAppChrome.tsx',import.meta.url),'utf8');
    expect(source).toContain('APP_DESTINATIONS.map(item=>');
    expect(source).toContain('<MobileDestinationIcon view={item.view}/>');
    expect(source).not.toContain('mobile-board-context-section');
    expect(source).not.toContain('mobile-notebook-page-list');
    expect(source).not.toContain('Notebook pages</strong>');
    expect(source).not.toContain('Board view</strong>');
  });

});
