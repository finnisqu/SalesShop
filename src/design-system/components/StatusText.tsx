import type { ReactNode } from 'react';

export function StatusText({
  state, children, className,
}: {
  state: 'empty' | 'loading' | 'error' | 'success';
  children: ReactNode;
  className?: string;
}) {
  return <div
    className={['ss-status', className].filter(Boolean).join(' ')}
    data-ss-state={state}
    role={state === 'error' ? 'alert' : 'status'}
    aria-live={state === 'error' ? 'assertive' : 'polite'}
  >{children}</div>;
}
