/** Compensate an item shifting when its comparison tray grows or shrinks.
 * Catalog scrolls inside its own host on mobile, not the global browser window.
 */
export function anchorOffsetDelta(beforeTop: number, afterTop: number): number {
  const delta = afterTop - beforeTop;
  return Number.isFinite(delta) && Math.abs(delta) >= 0.5 ? delta : 0;
}

export function restoreScrollAnchor(anchor: HTMLElement, beforeTop: number): void {
  if (!anchor.isConnected) return;
  const shift = anchorOffsetDelta(beforeTop, anchor.getBoundingClientRect().top);
  if (!shift) return;
  const host = anchor.closest<HTMLElement>('.catalog-section-host');
  if (host && host.scrollHeight > host.clientHeight) {
    host.scrollTop += shift;
  } else if (typeof window !== 'undefined') {
    window.scrollBy({ top: shift, left: 0, behavior: 'auto' });
  }
}
