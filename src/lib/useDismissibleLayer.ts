import { useEffect, useRef, type RefObject } from 'react';

/**
 * Returns the target for Tab wrapping inside a dialog.
 * An activeIndex of -1 means the keyboard focus escaped the overlay.
 */
export function modalTabWrapTarget(activeIndex: number, length: number, backwards: boolean): 'first' | 'last' | null {
  if (!length) return null;
  if (backwards && (activeIndex <= 0)) return 'last';
  if (!backwards && (activeIndex === -1 || activeIndex === length - 1)) return 'first';
  return null;
}

/**
 * Keyboard and focus lifecycle for a temporary dialog/drawer.
 * Works for desktop and touch overlays; does not block background scroll on its own.
 */
export function useDismissibleLayer<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T | null> {
  const layerRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Capture the trigger during render, before a dialog child can autofocus.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  if (!open) returnFocusRef.current = null;
  else if (!returnFocusRef.current && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    returnFocusRef.current = document.activeElement;
  }

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = returnFocusRef.current;
    const frame = requestAnimationFrame(() => {
      const layer = layerRef.current;
      const first = layer?.querySelector<HTMLElement>('[data-dialog-initial-focus]') ?? layer?.querySelector<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]',
      );
      first?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Only the dialog that currently owns keyboard focus should close.
        // In particular a nested portal/dialog must not dismiss its parent.
        const layer=layerRef.current;
        if(!layer||!layer.contains(event.target as Node))return;
        // A nested record picker owns Escape only while focus is inside
        // that picker and its search panel is open. An unrelated focused
        // control must still be able to close the parent dialog.
        const nestedPicker=event.target instanceof Element
          ?event.target.closest('.ss-unified-record-picker'):null;
        if(nestedPicker?.querySelector('.ss-unified-picker-panel'))return;
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const layer = layerRef.current;
      if (!layer) return;
      const targets = Array.from(layer.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
      )).filter((node) => node.getClientRects().length > 0);
      if (!targets.length) {
        event.preventDefault();
        return;
      }
      const activeIndex = targets.indexOf(document.activeElement as HTMLElement);
      const wrap = modalTabWrapTarget(activeIndex, targets.length, event.shiftKey);
      if (wrap) {
        event.preventDefault();
        (wrap === 'first' ? targets[0] : targets[targets.length - 1]).focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      // A newly opened editor may already have claimed focus. Avoid taking
      // it back merely because this older drawer has unmounted.
      const focused=document.activeElement;
      if (previouslyFocused?.isConnected &&
          (focused===document.body||layerRef.current?.contains(focused))) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);
  return layerRef;
}
