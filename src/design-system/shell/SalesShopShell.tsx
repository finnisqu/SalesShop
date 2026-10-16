import { forwardRef, type HTMLAttributes } from 'react';

export interface SalesShopShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Legacy mode preserves the current root markup and existing CSS owners. */
  mode?: 'legacy' | 'managed';
}

/** Navigation/banner/chrome stay direct children; no extra DOM wrapper. */
export const SalesShopShell = forwardRef<HTMLDivElement, SalesShopShellProps>(function SalesShopShell({
  mode = 'legacy', className, children, ...rest
}, ref) {
  return <div
    {...rest}
    ref={ref}
    className={[className, mode === 'managed' ? 'ss-sales-shell' : null].filter(Boolean).join(' ')}
    data-ss-shell="v1"
    data-ss-mode={mode}
  >{children}</div>;
});
