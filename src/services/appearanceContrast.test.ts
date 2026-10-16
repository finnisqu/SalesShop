import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Use the actual CSS values deployed to the app, rather than a second palette
// table that could silently drift out of sync with it.
const css = readFileSync(new URL('../appearance-themes.css', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../appearance-contrast.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

function luminance(hex: string): number {
  const raw = hex.slice(1);
  const clean = raw.length === 3 ? [...raw].map((digit) => digit + digit).join('') : raw;
  const rgb = [0, 2, 4].map((at) => Number.parseInt(clean.slice(at, at + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const themeBlocks = [...css.matchAll(/:root\[data-sales-theme="([^"]+)"\]\s*\{([^}]+)\}/g)]
  .map((match) => {
    const colors = Object.fromEntries([...match[2].matchAll(/--ss-theme-([\w-]+):\s*(#[0-9a-f]+)/g)]
      .map((color) => [color[1], color[2]]));
    return { name: match[1], colors };
  });

describe('SalesShop theme contrast contract', () => {
  it('maintains AA readable main and muted text on all four theme surfaces', () => {
    expect(themeBlocks).toHaveLength(10);
    for (const theme of themeBlocks) {
      for (const surface of ['canvas', 'base', 'card', 'tint']) {
        expect(contrast(theme.colors.ink, theme.colors[surface]),
          `${theme.name} ink on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(theme.colors.muted, theme.colors[surface]),
          `${theme.name} muted ink on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('loads the compatibility bridge after all older workspace styles', () => {
    expect(main.trimEnd()).toContain("import './appearance-contrast.css';");
    const contrastImport = main.indexOf("import './appearance-contrast.css'");
    expect(contrastImport).toBeGreaterThan(main.indexOf("import './mobile-app-shell.css'"));
    expect(contrastImport).toBeGreaterThan(main.indexOf("import './settings-workspace.css'"));
    expect(contrastImport).toBeGreaterThan(main.indexOf("import './connections-workspace.css'"));
  });

  it('maps legacy dark UI foreground to theme ink and muted ink', () => {
    expect(bridge).toContain('--ss-on-surface: var(--ss-theme-ink)');
    expect(bridge).toContain('--ss-on-muted: var(--ss-theme-muted)');
    for (const className of [
      '.board-view', '.accounts-view', '.quotes-view', '.catalog-workspace',
      '.connections-workspace', '.company-settings-view', '.viewer-workspace',
      '.mobile-app-drawer', '.quote-line-editor', '.mobile-catalog-reference-card',
      '.supplier-navigator', '.sinks-workspace', '.rates-workspace',
    ]) {
      expect(bridge, `Missing dark contrast coverage for ${className}`).toContain(className);
    }
  });

  it('never forces light ink onto arbitrary nested light or pastel controls', () => {
    // Old global tag-selector caused white-on-cream in both mobile drawers.
    expect(bridge).not.toContain('p,span,small,strong,em,b,i,label,legend');
    expect(bridge).toContain('.quote-area-actions button,.quote-add-row button');
    expect(bridge).toContain('color:#2b352e');
  });

  it('pairs dark surfaces and text in the regular and Quotes mobile drawers', () => {
    for (const className of [
      '.mobile-app-drawer-owner-tools', '.role-perspective-picker',
      '.quote-mobile-navigator', '.quote-mobile-document-list>button',
      '.quote-mobile-app-nav button', '.quote-mobile-current-document strong',
      '.quote-area-header', '.quote-notes-grid label', '.quote-notes-grid textarea',
    ]) {
      expect(bridge, `Missing color pairing for ${className}`).toContain(className);
    }
    expect(bridge).toContain('background:var(--ss-theme-card)');
    expect(bridge).toContain('color:var(--ss-theme-ink)');
  });

  it('pairs dark Connections reporting surfaces with legible labels and text', () => {
    for (const selector of [
      '.connections-tabs>button', '.connections-tabs>button.active',
      '.connections-scope-strip', '.connections-scope-strip strong',
      '.connections-scope-buttons button.active',
      '.connections-scope-note', '.dashboard-kpi small',
      '.dashboard-attention-copy small', '.dashboard-attention-row',
      '.dashboard-panel>header>span',
    ]) {
      expect(bridge, `Connections contrast rule missing: ${selector}`).toContain(selector);
    }
  });

  it('keeps Catalog reference cards, prices, sort control, and headings readable', () => {
    for (const selector of [
      '.mobile-catalog-reference-name>strong',
      '.mobile-catalog-reference-price>strong',
      '.mobile-catalog-reference-price-meta',
      '.mobile-catalog-reference-chevron',
      '.materials-reference-card>header',
      '.materials-comparison-board>header',
      '.rates-sort-control select option',
    ]) {
      expect(bridge, `Catalog contrast rule missing: ${selector}`).toContain(selector);
    }
    expect(bridge).toContain('color-scheme:dark');
    expect(bridge).toContain('.sales-app.view-catalog');
    expect(bridge).toContain('.sales-app.view-dashboard');
  });

  it('preserves physical notebook and customer document paper', () => {
    expect(bridge).toContain('.paper-sheet, .customer-quote-paper');
    expect(bridge).toContain('color-scheme:light');
    expect(bridge).not.toMatch(/:root\\[data-sales-theme="dark"\\]\\s+(?:body|#root)\\b/);
    expect(bridge).toContain('.sales-app');
  });
});
