/**
 * Shared phone viewport query for portrait or short, touch-device landscape.
 * At landscape widths above 700px, a phone is still a phone and should keep
 * the compact toolbar, Catalog cards, filters and scrolling.
 *
 * Keep CSS @media counterparts synchronized via mobileViewport.test.ts.
 */
export const PHONE_LAYOUT_QUERY =
  '(max-width: 700px), (orientation: landscape) and (max-height: 520px) and (pointer: coarse)';

export function isPhoneLayoutViewport(width: number, height: number, coarsePointer: boolean): boolean {
  return width <= 700 || (width > height && height <= 520 && coarsePointer);
}
