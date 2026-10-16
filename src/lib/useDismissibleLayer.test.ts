import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { modalTabWrapTarget, useDismissibleLayer } from './useDismissibleLayer';

describe('mobile overlay keyboard lifecycle', () => {
  it('wraps forwards and backwards at the dialog boundaries', () => {
    expect(modalTabWrapTarget(2, 3, false)).toBe('first');
    expect(modalTabWrapTarget(0, 3, true)).toBe('last');
    expect(modalTabWrapTarget(1, 3, false)).toBeNull();
    expect(modalTabWrapTarget(1, 3, true)).toBeNull();
  });

  it('recovers when keyboard focus moves outside the dialog', () => {
    expect(modalTabWrapTarget(-1, 3, false)).toBe('first');
    expect(modalTabWrapTarget(-1, 3, true)).toBe('last');
    expect(modalTabWrapTarget(-1, 0, true)).toBeNull();
  });

  it('is safe during server-side rendering when the overlay is closed or open', () => {
    function Example({ open }: { open: boolean }) {
      const ref = useDismissibleLayer<HTMLDivElement>(open, () => {});
      return createElement('div', { ref, role: 'dialog', 'aria-modal': true }, 'Menu content');
    }
    expect(renderToStaticMarkup(createElement(Example, { open: true }))).toContain('Menu content');
    expect(renderToStaticMarkup(createElement(Example, { open: false }))).toContain('role="dialog"');
  });
});
