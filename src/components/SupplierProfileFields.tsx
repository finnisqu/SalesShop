import { Field } from '../design-system/components';
import type { SupplierProfile } from '../types/supplier';

interface SupplierProfileFieldsProps {
  profile: SupplierProfile;
  onChange: (profile: SupplierProfile) => void;
}

/** One accessible form for supplier identity, pricing review, and notes.
 * The calling workspace still owns the save/cancel and cloud operations. */
export function SupplierProfileFields({ profile, onChange }: SupplierProfileFieldsProps) {
  const patch = (partial: Partial<SupplierProfile>) => onChange({ ...profile, ...partial });
  return <>
    <Field id="supplier-profile-name" label="Name">
      {(control) => <input {...control} value={profile.name}
        onChange={(event) => patch({ name: event.target.value })} autoComplete="organization" />}
    </Field>
    <Field id="supplier-profile-phone" label="Main phone">
      {(control) => <input {...control} type="tel" value={profile.phone ?? ''}
        onChange={(event) => patch({ phone: event.target.value })} autoComplete="tel" />}
    </Field>
    <Field id="supplier-profile-website" label="Website" className="wide">
      {(control) => <input {...control} type="text" value={profile.website ?? ''}
        onChange={(event) => patch({ website: event.target.value })} placeholder="supplier.com" />}
    </Field>
    <Field id="supplier-profile-cadence" label="Pricing cadence">
      {(control) => <select {...control} value={profile.pricingCadenceMonths ?? 12}
        onChange={(event) => patch({ pricingCadenceMonths: Number(event.target.value) })}>
        <option value={3}>Every 3 months</option><option value={6}>Every 6 months</option>
        <option value={12}>Annual</option><option value={18}>Every 18 months</option><option value={24}>Every 24 months</option>
      </select>}
    </Field>
    <Field id="supplier-profile-review" label="Next pricing review">
      {(control) => <input {...control} type="date" value={profile.nextPricingReviewDate ?? ''}
        onChange={(event) => patch({ nextPricingReviewDate: event.target.value || undefined })} />}
    </Field>
    <Field id="supplier-profile-status" label="Status">
      {(control) => <select {...control} value={profile.active ? 'active' : 'inactive'}
        onChange={(event) => patch({ active: event.target.value === 'active' })}>
        <option value="active">Active</option><option value="inactive">Inactive</option>
      </select>}
    </Field>
    <Field id="supplier-profile-notes" label="Relationship notes" className="wide">
      {(control) => <textarea {...control} value={profile.notes}
        onChange={(event) => patch({ notes: event.target.value })} />}
    </Field>
  </>;
}
