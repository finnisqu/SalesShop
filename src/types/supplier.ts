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


export const SUPPLIER_ACTIVITY_TYPES = [
  'meeting',
  'call',
  'email',
  'pricing-discussion',
  'term-change',
  'general-note',
  'issue',
] as const;
export type SupplierActivityType = (typeof SUPPLIER_ACTIVITY_TYPES)[number];

export interface SupplierActivity {
  id: string;
  supplierId: string;
  activityType: SupplierActivityType;
  occurredAt: string;
  summary: string;
  details: string;
  contactName?: string;
  createdAt?: string;
}

export type SupplierCommitmentKind =
  | 'price-reduction-sf'
  | 'percent-discount'
  | 'rebate'
  | 'freight'
  | 'custom';

export type SupplierCommitmentStatus =
  | 'proposed'
  | 'negotiating'
  | 'confirmed'
  | 'achieved'
  | 'expired'
  | 'cancelled';

export interface SupplierCommitment {
  id: string;
  supplierId: string;
  title: string;
  kind: SupplierCommitmentKind;
  amount?: number;
  unit?: string;
  conditionText: string;
  targetValue?: number;
  targetUnit?: string;
  deadline?: string;
  status: SupplierCommitmentStatus;
  notes: string;
  sourceActivityId?: string;
  createdAt?: string;
  updatedAt?: string;
}
