import { Field } from '../design-system/components';
import type { CompanySettingsData } from '../types/settings';

interface CompanyIdentityFieldsProps {
  settings: CompanySettingsData;
  update: (patch: Partial<CompanySettingsData>) => void;
}

/** Foundation pilot: shared, accessible field layout over existing autosave. */
export function SettingsIdentityFields({ settings, update }: CompanyIdentityFieldsProps) {
  return <>
    <Field id="settings-company-name" label="Company name" className="wide">
      {(control) => <input {...control} value={settings.organizationName} onChange={(event) => update({ organizationName: event.target.value })} autoComplete="organization" />}
    </Field>
    <Field id="settings-company-address" label="Business address" className="wide">
      {(control) => <textarea {...control} rows={2} value={settings.address} onChange={(event) => update({ address: event.target.value })} autoComplete="street-address" />}
    </Field>
    <Field id="settings-company-phone" label="Phone">
      {(control) => <input {...control} type="tel" value={settings.phone} onChange={(event) => update({ phone: event.target.value })} autoComplete="tel" />}
    </Field>
    <Field id="settings-company-email" label="Email">
      {(control) => <input {...control} type="email" value={settings.email} onChange={(event) => update({ email: event.target.value })} autoComplete="email" />}
    </Field>
    <Field id="settings-company-website" label="Website" className="wide">
      {(control) => <input {...control} type="url" value={settings.website} onChange={(event) => update({ website: event.target.value })} placeholder="https://…" />}
    </Field>
  </>;
}

interface ProfileFieldsProps {
  name: string;
  email: string;
  busy: boolean;
  onNameChange: (name: string) => void;
}

export function SettingsProfileFields({ name, email, busy, onNameChange }: ProfileFieldsProps) {
  return <>
    <Field id="settings-profile-display-name" label="Display name" className="wide">
      {(control) => <input {...control} value={name} onChange={(event) => onNameChange(event.target.value)} disabled={busy} placeholder="How your team knows you" autoComplete="name" />}
    </Field>
    <Field id="settings-profile-signin-email" label="Sign-in email" help="Managed by your sign-in account." className="wide">
      {(control) => <input {...control} type="email" value={email} readOnly aria-readonly="true" />}
    </Field>
  </>;
}
