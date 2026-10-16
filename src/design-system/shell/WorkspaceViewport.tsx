import { forwardRef, type HTMLAttributes } from 'react';

export interface WorkspaceViewportProps extends HTMLAttributes<HTMLDivElement> {
  mode?: 'legacy' | 'managed';
  /** Managed mode makes this the flex/scroll boundary; legacy mode keeps old display:contents semantics. */
  scroll?: boolean;
}

/** In legacy mode this replaces the existing role-perspective-content div 1:1. */
export const WorkspaceViewport = forwardRef<HTMLDivElement, WorkspaceViewportProps>(function WorkspaceViewport({
  mode = 'legacy', scroll = false, className, children, ...rest
}, ref) {
  return <div
    {...rest}
    ref={ref}
    data-ss-viewport="v1"
    data-ss-mode={mode}
    data-ss-scroll={mode === 'managed' && scroll ? 'true' : undefined}
    className={[
      className,
      mode === 'managed' ? 'ss-workspace-viewport' : null,
      mode === 'managed' && scroll ? 'ss-workspace-scroll' : null,
    ].filter(Boolean).join(' ')}
  >{children}</div>;
});
