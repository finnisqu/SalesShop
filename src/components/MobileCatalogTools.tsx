import { useEffect, useRef, type ReactNode } from 'react';

type MobileCatalogToolsSheetProps = {
  title: string;
  section: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function MobileCatalogToolsSheet({
  title,
  section,
  description,
  onClose,
  children,
  footer,
}: MobileCatalogToolsSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div className="mobile-catalog-tools-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside ref={sheetRef} className="mobile-catalog-tools-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="mobile-catalog-tools-header">
          <div><span>Catalog · {section}</span><strong>{title}</strong><small>{description}</small></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={`Close ${title}`}>×</button>
        </header>
        {children}
        {footer && <footer className="mobile-catalog-tools-footer">{footer}</footer>}
      </aside>
    </div>
  );
}

export type MobileCatalogFilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

export function MobileCatalogActiveFilters({
  items,
  onClear,
}: {
  items: MobileCatalogFilterChip[];
  onClear?: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mobile-catalog-active-filters" aria-label="Active search and filters">
      {items.map((item) => (
        <button key={item.key} type="button" onClick={item.onRemove} aria-label={`Remove filter ${item.label}`}>
          <span>{item.label}</span><b aria-hidden="true">×</b>
        </button>
      ))}
      {onClear && items.length > 1 && <button type="button" className="mobile-catalog-clear-filters" onClick={onClear}>Clear all</button>}
    </div>
  );
}
