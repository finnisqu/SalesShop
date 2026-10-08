import { useId, type ReactNode } from 'react';

interface MobileCatalogReferenceListProps {
  label: string;
  emptyMessage: string;
  empty: boolean;
  children: ReactNode;
  className?: string;
}

/** A single mobile list pattern shared by Materials, Rates, and Sinks. */
export function MobileCatalogReferenceList({
  label,
  empty,
  emptyMessage,
  children,
  className = '',
}: MobileCatalogReferenceListProps) {
  return (
    <div className={`mobile-catalog-reference-list ${className}`} role="list" aria-label={label}>
      {empty ? <div className="mobile-catalog-reference-empty" role="status">{emptyMessage}</div> : children}
    </div>
  );
}

interface MobileCatalogReferenceCardProps {
  title: string;
  subtitle: ReactNode;
  price: string;
  priceMeta?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  details?: ReactNode;
  highlighted?: boolean;
  className?: string;
  priceAriaLabel?: string;
}

/**
 * Mobile reference information hierarchy:
 * name + category on the left, important price on the right, secondary data on expansion.
 * Button and panel always stay together so tapping anywhere in the summary works.
 */
export function MobileCatalogReferenceCard({
  title,
  subtitle,
  price,
  priceMeta,
  expanded,
  onToggle,
  details,
  highlighted = false,
  className = '',
  priceAriaLabel,
}: MobileCatalogReferenceCardProps) {
  const detailsId = useId();
  return (
    <article
      role="listitem"
      className={`mobile-catalog-reference-card ${expanded ? 'is-expanded' : ''} ${highlighted ? 'is-highlighted' : ''} ${className}`}
    >
      <button
        type="button"
        className="mobile-catalog-reference-trigger"
        aria-expanded={expanded}
        aria-controls={expanded && details != null ? detailsId : undefined}
        onClick={onToggle}
      >
        <span className="mobile-catalog-reference-name">
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        <span className="mobile-catalog-reference-price">
          <strong aria-label={priceAriaLabel}>{price}</strong>
          {priceMeta && <span className="mobile-catalog-reference-price-meta">{priceMeta}</span>}
        </span>
        <span className="mobile-catalog-reference-chevron" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
      </button>
      {expanded && details != null && (
        <div id={detailsId} className="mobile-catalog-reference-details">{details}</div>
      )}
    </article>
  );
}
