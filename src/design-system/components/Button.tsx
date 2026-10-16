import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'regular' | 'compact';
  loading?: boolean;
  loadingLabel?: string;
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'secondary',
  size = 'regular',
  loading = false,
  loadingLabel = 'Working…',
  iconOnly = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}, ref) {
  return <button
    {...rest}
    ref={ref}
    type={type}
    className={['ss-button', className].filter(Boolean).join(' ')}
    data-ss-variant={variant}
    data-ss-size={size}
    data-ss-icon-only={iconOnly ? 'true' : undefined}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
  >
    {loading && <span className="ss-button__spinner" aria-hidden="true" />}
    {children}
    {loading && <span className="ss-sr-only">{loadingLabel}</span>}
  </button>;
});
