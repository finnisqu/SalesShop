import type { ReactNode } from 'react';
import { useDismissibleLayer } from '../lib/useDismissibleLayer';

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
  const sheetRef = useDismissibleLayer<HTMLElement>(true, onClose);

  return (
    <div className="mobile-catalog-tools-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside ref={sheetRef} className="mobile-catalog-tools-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="mobile-catalog-tools-header">
          <div><span>Catalog · {section}</span><strong>{title}</strong><small>{description}</small></div>
          <button data-dialog-initial-focus type="button" onClick={onClose} aria-label={`Close ${title}`}>×</button>
        </header>
        {children}
        {footer && <footer className="mobile-catalog-tools-footer">{footer}</footer>}
      </aside>
    </div>
  );
}

export function MobileCatalogFilterSheet({
  section,
  onClose,
  children,
}: {
  section: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <MobileCatalogToolsSheet
      title="Filter results"
      section={section}
      description="Refine the list, then close this sheet whenever you're ready."
      onClose={onClose}
      footer={
        <button type="button" className="mobile-catalog-filter-done" onClick={onClose}>
          Done · View results
        </button>
      }
    >
      <section className="mobile-catalog-filter-fields">{children}</section>
    </MobileCatalogToolsSheet>
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
