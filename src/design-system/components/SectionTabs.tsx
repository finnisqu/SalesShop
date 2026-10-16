export interface SectionTab<ID extends string = string> {
  id: ID;
  label: string;
  description?: string;
}

export interface SectionTabsProps<ID extends string = string> {
  items: ReadonlyArray<SectionTab<ID>>;
  selected: ID;
  onSelect: (id: ID) => void;
  'aria-label': string;
  className?: string;
}

/** Shared, navigational section selector; preserves real buttons and aria-current. */
export function SectionTabs<ID extends string>({
  items, selected, onSelect, className, 'aria-label': ariaLabel,
}: SectionTabsProps<ID>) {
  return <nav className={['ss-section-tabs', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
    {items.map((item) => <button type="button" key={item.id}
      className={['ss-section-tab', item.id === selected ? 'active' : ''].filter(Boolean).join(' ')}
      aria-current={item.id === selected ? 'page' : undefined}
      onClick={() => onSelect(item.id)}>
      <strong>{item.label}</strong>
      {item.description && <small>{item.description}</small>}
    </button>)}
  </nav>;
}
