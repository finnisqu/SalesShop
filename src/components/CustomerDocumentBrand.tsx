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

export function DocumentBrand({ brand }: { brand: CustomerDocumentBrandData }) {
  const details = [brand.address, brand.phone, brand.email, brand.website].filter(Boolean);
  const contact = [brand.contactName, brand.contactPhone].filter(Boolean).join(' · ');
  return (
    <div className="customer-document-brand">
      {brand.logoUrl && <img src={brand.logoUrl} alt={`${brand.name || 'Company'} logo`} />}
      <div>
        <strong>{brand.name || 'YOUR COMPANY'}</strong>
        {details.map((detail) => <span key={detail}>{detail}</span>)}
        {contact && <small>{contact}</small>}
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
