import { useRef, type ReactNode } from 'react';

/** Shared record sections. Company and Person pages use identical chrome and tokens. */
export function RecordCard({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return <section className="connections-record-panel">
    <header><h2>{title}</h2>{extra}</header>
    <div className="connections-record-panel-body">{children}</div>
  </section>;
}

export function RecordProperty({ label, children }: { label: string; children: ReactNode }) {
  return <div className="connections-record-property"><span>{label}</span><strong>{children}</strong></div>;
}


/** Reusable entity record shell: one scroll surface, three responsive information regions. */
export function RecordPageLayout({
  entityType, recordTypeLabel, collectionLabel, title, subtitle, badge, actions, onBack, left, center, right,
}: {
  entityType: 'company' | 'person' | 'project';
  recordTypeLabel?: string;
  collectionLabel?: string;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  onBack: () => void;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  const detailsRef = useRef<HTMLElement>(null);
  const recordsRef = useRef<HTMLDivElement>(null);
  const relatedRef = useRef<HTMLElement>(null);
  const jumpTo = (area: 'details' | 'records' | 'related') => {
    const element = area === 'details' ? detailsRef.current : area === 'records' ? recordsRef.current : relatedRef.current;
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return <section className="connections-record-page" data-record-type={entityType} aria-label={(recordTypeLabel ?? (entityType === 'project' ? 'Deal' : entityType)) + ' record'}>
    <nav className="connections-record-breadcrumb" aria-label="Breadcrumb">
      <button type="button" onClick={onBack}>← Connections</button>
      <span aria-hidden="true">/</span>
      <span>{collectionLabel ?? (entityType === 'company' ? 'Companies' : entityType === 'person' ? 'People' : 'Deals')}</span>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{title}</span>
    </nav>
    <header className="connections-record-header">
      <div className="connections-record-heading">
        <span className="connections-record-type">{recordTypeLabel ?? (entityType === 'project' ? 'Deal' : entityType)}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {badge && <div className="connections-record-badges">{badge}</div>}
      </div>
      {actions && <div className="connections-record-actions">{actions}</div>}
    </header>
    <nav className="connections-record-jump-nav" aria-label="Jump to record section">
      <button type="button" onClick={() => jumpTo('details')}>Details</button>
      <button type="button" onClick={() => jumpTo('records')}>Records</button>
      <button type="button" onClick={() => jumpTo('related')}>Related</button>
    </nav>
    <div className="connections-record-columns">
      <aside ref={detailsRef} className="connections-record-properties" aria-label="Record details">{left}</aside>
      <div ref={recordsRef} className="connections-record-center" role="region" aria-label="Linked records">{center}</div>
      <aside ref={relatedRef} className="connections-record-related" aria-label="Related records">{right}</aside>
    </div>
  </section>;
}
