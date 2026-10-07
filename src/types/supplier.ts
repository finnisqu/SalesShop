export interface SupplierProfile {
  id: string;
  name: string;
  active: boolean;
  pricingCadenceMonths?: number;
  nextPricingReviewDate?: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierProfilePatch {
  name?: string;
  active?: boolean;
  pricingCadenceMonths?: number;
  nextPricingReviewDate?: string;
  notes?: string;
}
