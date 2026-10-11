import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  navigation: {
    view: 'catalog',
    catalogSection: 'materials',
    setView: () => {},
    setCatalogSection: () => {},
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

  it('gives restricted Quotes routes an explicit CSS navigation fallback', () => {
    const css = readFileSync(new URL('../mobile-app-shell.css', import.meta.url), 'utf8');
    expect(css).toContain('.sales-app.view-quotes:is(.sales-app-viewer, .owner-perspective-active) > .mobile-app-commandbar');
    expect(css).toContain('.sales-app.sales-app-viewer > .mobile-app-commandbar');
  });
});
