import { describe, expect, it } from 'vitest';
import { resolveMobileDrawerChoice } from './mobileDrawerNavigation';

describe('mobile drawer Catalog navigation', () => {
  it('expands Catalog without redirecting into the previous nested section', () => {
    expect(resolveMobileDrawerChoice('catalog', false)).toEqual({
      kind: 'toggle-catalog', expanded: true,
    });
  });

  it('can collapse Catalog without requiring a section selection', () => {
    expect(resolveMobileDrawerChoice('catalog', true)).toEqual({
      kind: 'toggle-catalog', expanded: false,
    });
  });

  it('keeps immediate navigation for top-level destinations', () => {
    expect(resolveMobileDrawerChoice('board', false)).toEqual({
      kind: 'navigate', view: 'board',
    });
    expect(resolveMobileDrawerChoice('settings', true)).toEqual({
      kind: 'navigate', view: 'settings',
    });
  });
});
