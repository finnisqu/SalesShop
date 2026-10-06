import type { PricingMaterialType } from './quote';

export type StockMaterialUnit = 'sf' | 'slab' | 'each';

export interface StockMaterial {
  id: string;
  name: string;
  materialType: PricingMaterialType;
  internalCost?: number;
  unit: StockMaterialUnit;
  notes?: string;
  active: boolean;
}

export interface CompanySettingsData {
  organizationName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  quoteContactName: string;
  quoteContactPhone: string;
  stockMaterials: StockMaterial[];
}

export const EMPTY_COMPANY_SETTINGS: CompanySettingsData = {
  organizationName: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: '',
  quoteContactName: '',
  quoteContactPhone: '',
  stockMaterials: [],
};
