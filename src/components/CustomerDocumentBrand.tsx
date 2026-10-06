import { useCompanySettingsStore } from '../store/companySettingsStore';

export interface CustomerDocumentBrandData {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  contactName?: string;
  contactPhone?: string;
}

function phoneHref(value?: string) {
  const normalized = value?.trim().replace(/[^\d+]/g, '') ?? '';
  return normalized ? `tel:${normalized}` : undefined;
}

function websiteHref(value?: string) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function mapHref(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? `https://maps.apple.com/?q=${encodeURIComponent(trimmed)}` : undefined;
}

export function DocumentBrand({ brand }: { brand: CustomerDocumentBrandData }) {
  const address = brand.address?.trim();
  const phone = brand.phone?.trim();
  const email = brand.email?.trim();
  const website = brand.website?.trim();
  const contactName = brand.contactName?.trim();
  const contactPhone = brand.contactPhone?.trim();

  return (
    <div className="customer-document-brand">
      {brand.logoUrl && <img src={brand.logoUrl} alt={`${brand.name || 'Company'} logo`} />}
      <div>
        <strong>{brand.name || 'YOUR COMPANY'}</strong>
        <address className="customer-document-brand-details">
          {address && <a href={mapHref(address)} className="brand-detail brand-address" aria-label={`Open ${address} in Maps`}>{address}</a>}
          {phone && <a href={phoneHref(phone)} className="brand-detail brand-phone" aria-label={`Call ${phone}`}>{phone}</a>}
          {email && <a href={`mailto:${email}`} className="brand-detail brand-email" aria-label={`Email ${email}`}>{email}</a>}
          {website && <a href={websiteHref(website)} className="brand-detail brand-website" target="_blank" rel="noreferrer" aria-label={`Open ${website}`}>{website}</a>}
        </address>
        {(contactName || contactPhone) && (
          <small className="customer-document-brand-contact">
            {contactName && <span>{contactName}</span>}
            {contactName && contactPhone && <span aria-hidden="true"> · </span>}
            {contactPhone && <a href={phoneHref(contactPhone)} aria-label={`Call ${contactPhone}`}>{contactPhone}</a>}
          </small>
        )}
      </div>
    </div>
  );
}

export function CustomerDocumentBrand() {
  const settings = useCompanySettingsStore((state) => state.settings);
  return <DocumentBrand brand={{
    name: settings.organizationName,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
    logoUrl: settings.logoUrl,
    contactName: settings.quoteContactName,
    contactPhone: settings.quoteContactPhone,
  }} />;
}
