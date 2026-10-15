import type { ReactNode } from 'react';

/** Reusable entity record shell: one scroll surface, three responsive information regions. */
export function RecordPageLayout({
  entityType, title, subtitle, badge, actions, onBack, left, center, right,
}: {
  entityType: 'company' | 'person' | 'project';
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  onBack: () => void;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return <section className="connections-record-page" data-record-type={entityType} aria-label={entityType + ' record'}>
    <nav className="connections-record-breadcrumb" aria-label="Breadcrumb">
      <button type="button" onClick={onBack}>← Connections</button>
      <span aria-hidden="true">/</span>
      <button type="button" onClick={onBack}>{entityType === 'company' ? 'Companies' : entityType === 'person' ? 'People' : 'Projects'}</button>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{title}</span>
    </nav>
    <header className="connections-record-header">
      <div className="connections-record-heading">
        <span className="connections-record-type">{entityType}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {badge && <div className="connections-record-badges">{badge}</div>}
      </div>
      {actions && <div className="connections-record-actions">{actions}</div>}
    </header>
    <div className="connections-record-columns">
      <aside className="connections-record-properties" aria-label="Record properties">{left}</aside>
      <div className="connections-record-center">{center}</div>
      <aside className="connections-record-related" aria-label="Related records">{right}</aside>
    </div>
  </section>;
}
