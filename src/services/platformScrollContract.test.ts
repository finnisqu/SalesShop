import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Document scrolling is disabled for tenant SalesShop. Platform Studio must
 * provide its own mobile-safe scroll viewport and must not unlock tenant UI. */
describe('Platform Studio mobile scroll contract', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
  const global = read('src/index.css');
  const css = read('src/developer-console.css');

  it('keeps the global tenant scroll lock in place', () => {
    expect(global).toMatch(/body\s*\{\s*overflow:\s*hidden\s*;/);
  });

  it('has an explicitly sized internal vertical scroll container for body-locked pages', () => {
    const viewport = css.match(/\.developer-console\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(viewport).toMatch(/height:\s*100dvh\s*;/);
    expect(viewport).toMatch(/overflow-y:\s*auto\s*;/);
    expect(viewport).toMatch(/overflow-x:\s*hidden\s*;/);
    expect(viewport).toMatch(/-webkit-overflow-scrolling:\s*touch\s*;/);
  });

  it('lets mobile content expand while the navigation remains reachable', () => {
    expect(css).toMatch(/@media\(max-width:840px\)/);
    expect(css).toMatch(/grid-template-rows:\s*auto auto\s*;/);
    expect(css).toMatch(/\.developer-console-sidebar\s*\{\s*position:\s*sticky\s*;/);
    expect(css).toMatch(/padding-bottom:\s*max\(24px, env\(safe-area-inset-bottom\)\)/);
  });
});
