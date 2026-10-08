import { describe, expect, it } from 'vitest';
import { anchorOffsetDelta } from './scrollAnchor';

describe('restoring an anchor inside Catalog scrolling', () => {
  it('keeps the sign needed to compensate a tray that grows above an item', () => {
    expect(anchorOffsetDelta(210, 258)).toBe(48);
    expect(anchorOffsetDelta(210, 180)).toBe(-30);
  });
  it('does not cause scroll jumps for subpixel movements or invalid measurements', () => {
    expect(anchorOffsetDelta(100, 100.3)).toBe(0);
    expect(anchorOffsetDelta(NaN, 110)).toBe(0);
  });
});
