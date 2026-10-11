import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

export interface WorkspaceToolbarProps extends HTMLAttributes<HTMLElement> {
  mode?: 'legacy' | 'managed';
  start?: ReactNode;
  center?: ReactNode;
  end?: ReactNode;
}

/**
 * Legacy: keeps existing header children and direct-parent CSS selectors.
 * Managed: one measured toolbar with three overflow-safe slots.
 */
export const WorkspaceToolbar = forwardRef<HTMLElement, WorkspaceToolbarProps>(function WorkspaceToolbar({
  mode = 'legacy', className, start, center, end, children, ...rest
}, ref) {
  return <header
    {...rest}
    ref={ref}
    data-ss-toolbar="v1"
    data-ss-mode={mode}
    className={[className, mode === 'managed' ? 'ss-workspace-toolbar' : null].filter(Boolean).join(' ')}
  >
    {mode === 'managed' ? <>
      <div className="ss-workspace-toolbar__slot" data-ss-slot="start">{start}</div>
      <div className="ss-workspace-toolbar__slot" data-ss-slot="center">{center ?? children}</div>
      <div className="ss-workspace-toolbar__slot" data-ss-slot="end">{end}</div>
    </> : children}
  </header>;
});
