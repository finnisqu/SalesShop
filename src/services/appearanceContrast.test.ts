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

  it('preserves the intentionally light notebook and customer documents', () => {
    expect(bridge).toContain('.paper-sheet *');
    expect(bridge).toContain('.customer-quote-paper *');
    expect(bridge).toContain('color-scheme:light');
    expect(bridge).not.toMatch(/:root\[data-sales-theme="dark"\]\s+(?:body|#root)\b/);
    expect(bridge).toContain('.sales-app');
  });
});
