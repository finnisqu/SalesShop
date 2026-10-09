import { useId, type ReactNode } from 'react';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
}

export interface FieldProps {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  id?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** A render prop prevents a disconnected label/id when inputs are wrapped. */
export function Field({ label, help, error, required = false, id, className, children }: FieldProps) {
  const fallbackId = useId();
  const controlId = id ?? `ss-field-${fallbackId}`;
  const descriptionId = help ? `${controlId}-help` : null;
  const errorId = error ? `${controlId}-error` : null;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  return <div className={['ss-field', className].filter(Boolean).join(' ')}>
    <label className="ss-field__label" htmlFor={controlId}>
      {label}{required && <span className="ss-field__required" aria-hidden="true"> *</span>}
    </label>
    {children({
      id: controlId,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : undefined,
      required: required || undefined,
    })}
    {help && <p className="ss-field__help" id={descriptionId ?? undefined}>{help}</p>}
    {error && <p className="ss-field__error" id={errorId ?? undefined} role="alert">{error}</p>}
  </div>;
}
