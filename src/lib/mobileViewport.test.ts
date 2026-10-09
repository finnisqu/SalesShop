import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isPhoneLayoutViewport, PHONE_LAYOUT_QUERY } from './mobileViewport';

const media = '(max-width: 700px), (orientation: landscape) and (max-height: 520px) and (pointer: coarse)';

describe('Mobile phone layout in portrait and landscape', () => {
  it('stays mobile for portrait and rotated phones without affecting tablets and desktops', () => {
    expect(PHONE_LAYOUT_QUERY).toBe(media);
    expect(isPhoneLayoutViewport(390, 844, true)).toBe(true);
    expect(isPhoneLayoutViewport(844, 390, true)).toBe(true);
    expect(isPhoneLayoutViewport(956, 440, true)).toBe(true);
    expect(isPhoneLayoutViewport(1024, 768, true)).toBe(false);
    expect(isPhoneLayoutViewport(1440, 900, false)).toBe(false);
    expect(isPhoneLayoutViewport(900, 400, false)).toBe(false);
  });

  it('uses one CSS media contract for shell, Catalog, mobile cards, Sinks and Materials', () => {
    for (const name of [
      '../mobile.css',
      '../mobile-app-shell.css',
      '../mobile-catalog-reference.css',
      '../mobile-materials-sort.css',
      '../sinks-workspace.css',
      '../design-system/catalog-adapter.css',
      '../design-system/materials-adapter.css',
      '../design-system/sinks-adapter.css',
    ]) {
      const css = readFileSync(new URL(name, import.meta.url), 'utf8');
      expect(css, `Landscape query absent in ${name}`).toContain(`@media ${media}`);
    }
  });

  it('keeps JS catalog card layout aligned with the CSS phone rules', () => {
    for (const name of ['../components/MaterialsWorkspace.tsx', '../components/SinksWorkspace.tsx']) {
      const component = readFileSync(new URL(name, import.meta.url), 'utf8');
      expect(component).toContain('matchMedia(PHONE_LAYOUT_QUERY)');
      expect(component).not.toContain("matchMedia('(max-width: 700px)')");
    }
  });

  it('preserves global hamburger and hides two desktop Catalog header rows', () => {
    const shell = readFileSync(new URL('../mobile-app-shell.css', import.meta.url), 'utf8');
    const catalog = readFileSync(new URL('../design-system/catalog-adapter.css', import.meta.url), 'utf8');
    expect(shell).toContain('.sales-app:not(.view-quotes) > .app-header');
    expect(shell).toContain('> .mobile-app-commandbar');
    expect(catalog).toContain('.catalog-header.catalog-foundation-heading');
    expect(catalog).toContain('.catalog-section-nav.catalog-foundation-tabs');
    expect(catalog).toContain('display:none');
  });
});
