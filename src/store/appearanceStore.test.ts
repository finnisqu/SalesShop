import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, normalizeAppearance } from './appearanceStore';

describe('Settings appearance preferences', () => {
  it('uses the familiar SalesShop appearance by default', () => {
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance({})).toEqual(DEFAULT_APPEARANCE);
  });
  it('recognizes explicitly selected accessible settings', () => {
    expect(normalizeAppearance({
      textSize: 'large',
      motion: 'reduced',
      highContrast: true,
      largerControls: true,
    })).toEqual({
      textSize: 'large',
      motion: 'reduced',
      highContrast: true,
      largerControls: true,
    });
  });
  it('ignores unexpected stored settings instead of breaking rendering', () => {
    expect(normalizeAppearance({ textSize: 'extra-large', motion: 'spin', highContrast: 'yes', largerControls: 3 }))
      .toEqual(DEFAULT_APPEARANCE);
  });
});
