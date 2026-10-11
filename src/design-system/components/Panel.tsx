import type { HTMLAttributes, ReactNode } from 'react';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  heading?: ReactNode;
  footer?: ReactNode;
  scrollBody?: boolean;
  children: ReactNode;
}

/** Scroll only the body in a bounded panel, never the panel's header/footer. */
export function Panel({
  heading, footer, scrollBody = false, className, children, ...rest
}: PanelProps) {
  return <section {...rest} className={['ss-panel', className].filter(Boolean).join(' ')} data-ss-scroll={scrollBody ? 'true' : 'false'}>
    {heading && <header className="ss-panel__header">{heading}</header>}
    <div className="ss-panel__body">{children}</div>
    {footer && <footer className="ss-panel__footer">{footer}</footer>}
  </section>;
}
