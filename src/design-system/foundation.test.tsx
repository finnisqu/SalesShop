import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, Field, PageHeader, Panel, StatusText } from './components';
import { SalesShopShell, WorkspaceToolbar, WorkspaceViewport } from './shell';

describe('SalesShop UI Foundation v1 primitives', () => {
  it('renders a semantic button that cannot submit forms by accident', () => {
    const html = renderToStaticMarkup(<Button variant="primary" onClick={() => {}}>Create quote</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain('class="ss-button"');
    expect(html).toContain('data-ss-variant="primary"');
  });

  it('disables loading buttons and communicates the busy state', () => {
    const html = renderToStaticMarkup(<Button loading loadingLabel="Saving changes">Save</Button>);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Saving changes');
  });

  it('provides correctly associated help and error identifiers', () => {
    const html = renderToStaticMarkup(<Field id="customer-email" label="Email" help="Required for invitations" error="Invalid address" required>
      {(props) => <input type="email" {...props} />}
    </Field>);
    expect(html).toContain('for="customer-email"');
    expect(html).toContain('id="customer-email"');
    expect(html).toContain('aria-describedby="customer-email-help customer-email-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('required=""');
    expect(html).toContain('role="alert"');
  });

  it('allows a page header, panel and status to compose without touching legacy classes', () => {
    const html = renderToStaticMarkup(<PageHeader eyebrow="Sales" title="Quotes" description="Current work" actions={<Button>New quote</Button>} />);
    expect(html).toContain('ss-page-header__title');
    expect(html).toContain('Current work');
    expect(html).toContain('New quote');
    const panel = renderToStaticMarkup(<Panel heading="Pending" footer="One draft" scrollBody>
      <StatusText state="empty">Nothing here yet</StatusText>
    </Panel>);
    expect(panel).toContain('data-ss-scroll="true"');
    expect(panel).toContain('ss-panel__footer');
    expect(panel).toContain('data-ss-state="empty"');
  });

  it('preserves the DOM hierarchy used by the existing mobile/role CSS', () => {
    const html = renderToStaticMarkup(<SalesShopShell mode="legacy" className="sales-app view-catalog">
      <div className="role-perspective-banner">Role preview</div>
      <WorkspaceToolbar mode="legacy" className="mobile-app-commandbar">
        <button>☰</button><strong>Catalog</strong>
      </WorkspaceToolbar>
      <WorkspaceViewport mode="legacy" className="role-perspective-content" inert>
        <main className="catalog-workspace">Catalog contents</main>
      </WorkspaceViewport>
    </SalesShopShell>);
    expect(html).toContain('class="sales-app view-catalog"');
    expect(html).toContain('class="mobile-app-commandbar"');
    expect(html).toContain('class="role-perspective-content"');
    expect(html).toContain('inert=""');
    expect(html).not.toContain('ss-workspace-viewport');
    expect(html).not.toContain('ss-workspace-toolbar');
  });

  it('provides bounded managed mode with explicit start/center/end toolbar slots', () => {
    const html = renderToStaticMarkup(<SalesShopShell mode="managed">
      <WorkspaceToolbar mode="managed" start={<button>Menu</button>} center="Quotes" end={<button>Actions</button>} />
      <WorkspaceViewport mode="managed" scroll><p>Rows</p></WorkspaceViewport>
    </SalesShopShell>);
    expect(html).toContain('ss-sales-shell');
    expect(html).toContain('ss-workspace-toolbar__slot');
    expect(html).toContain('data-ss-slot="start"');
    expect(html).toContain('data-ss-slot="center"');
    expect(html).toContain('data-ss-slot="end"');
    expect(html).toContain('ss-workspace-scroll');
  });

  it('limits the new CSS to token declarations and opted-in class selectors', () => {
    const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    const primitives = readFileSync(new URL('./primitives.css', import.meta.url), 'utf8');
    expect(tokens).toContain('--ss-nav-height: 50px');
    expect(tokens).toContain('--ss-control-height: 40px');
    expect(primitives).toContain('.ss-workspace-viewport');
    expect(primitives).not.toMatch(/(?:^|\n)\s*\.sales-app(?:\s|\{|\.|\:)/);
    expect(primitives).not.toMatch(/(?:^|\n)\s*\.mobile-app-commandbar(?:\s|\{|\.|\:)/);
  });
});
