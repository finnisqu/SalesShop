import { describe, expect, it } from 'vitest';
import { anchorOffsetDelta, restoreScrollAnchor } from './scrollAnchor';

describe('restoring an anchor inside Catalog scrolling', () => {
  it('keeps the sign needed to compensate a tray that grows above an item', () => {
    expect(anchorOffsetDelta(210, 258)).toBe(48);
    expect(anchorOffsetDelta(210, 180)).toBe(-30);
  });
  it('moves the Catalog content scroller instead of the fixed page', () => {
    const host = { scrollTop: 12, scrollHeight: 1400, clientHeight: 420 };
    const anchor = {
      isConnected: true,
      getBoundingClientRect: () => ({ top: 180 }),
      closest: (selector: string) => selector === '.catalog-section-host' ? host : null,
    } as unknown as HTMLElement;
    restoreScrollAnchor(anchor, 140);
    expect(host.scrollTop).toBe(52);
  });

  it('skips detached anchors rather than making an unexpected scroll', () => {
    const host = { scrollTop: 12, scrollHeight: 1400, clientHeight: 420 };
    const anchor = {
      isConnected: false,
      getBoundingClientRect: () => ({ top: 180 }),
      closest: () => host,
    } as unknown as HTMLElement;
    restoreScrollAnchor(anchor, 140);
    expect(host.scrollTop).toBe(12);
  });

  it('does not cause scroll jumps for subpixel movements or invalid measurements', () => {
    expect(anchorOffsetDelta(100, 100.3)).toBe(0);
    expect(anchorOffsetDelta(NaN, 110)).toBe(0);
  });
});
