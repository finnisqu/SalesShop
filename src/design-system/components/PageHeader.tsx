import type { ReactNode } from 'react';

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  hideDescriptionOnMobile?: boolean;
  className?: string;
}

/** Reusable page heading; domain-specific tools belong in the actions slot. */
export function PageHeader({
  eyebrow, title, description, actions, compact = false,
  hideDescriptionOnMobile = false, className,
}: PageHeaderProps) {
  return <header className={['ss-page-header', className].filter(Boolean).join(' ')} data-ss-density={compact ? 'compact' : 'regular'}>
    <div className="ss-page-header__intro">
      {eyebrow && <span className="ss-page-header__eyebrow">{eyebrow}</span>}
      <h1 className="ss-page-header__title">{title}</h1>
      {description && <p className="ss-page-header__description" data-ss-hide-on-mobile={hideDescriptionOnMobile ? 'true' : undefined}>{description}</p>}
    </div>
    {actions && <div className="ss-page-header__actions">{actions}</div>}
  </header>;
}
