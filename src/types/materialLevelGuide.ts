export interface MaterialLevelRule {
  id: string;
  label: string;
  maxMaterialCost: number;
  customerRate: number;
  active: boolean;
}

export interface MaterialLevelGuideVersion {
  id: string;
  recordedAt: string;
  note?: string;
  rules: MaterialLevelRule[];
  slabPricingThresholdCostPerSf: number;
  slabPricingMultiplier: number;
}

export interface MaterialLevelGuideDocument {
  schemaVersion: 3;
  id: string;
  name: string;
  note?: string;
  rules: MaterialLevelRule[];
  slabPricingThresholdCostPerSf: number;
  slabPricingMultiplier: number;
  history: MaterialLevelGuideVersion[];
  updatedAt: string;
}

export interface ResolvedMaterialLevel {
  rule: MaterialLevelRule;
  customerRate: number;
  basis: string;
}

export type MaterialPricingRecommendation =
  | {
      mode: 'level';
      level: ResolvedMaterialLevel;
      basis: string;
    }
  | {
      mode: 'slab-review';
      thresholdCostPerSf: number;
      multiplier: number;
      basis: string;
    }
  | {
      mode: 'needs-cost';
      basis: string;
    };

export interface ResolvedSlabPrice {
  eligible: boolean;
  thresholdCostPerSf: number;
  multiplier: number;
  sourceCostPerSf?: number;
  slabCost?: number;
  slabCount?: number;
  customerPricePerSlab?: number;
  customerTotal?: number;
  basis: string;
}

function activeRules(rules: MaterialLevelRule[]) {
  return rules
    .filter((rule) => rule.active)
    .sort((a, b) => a.maxMaterialCost - b.maxMaterialCost);
}

export function materialLevelCostBand(rules: MaterialLevelRule[], rule: MaterialLevelRule) {
  const ordered = activeRules(rules);
  const index = ordered.findIndex((candidate) => candidate.id === rule.id);
  const previous = index > 0 ? ordered[index - 1] : undefined;
  const lower = previous?.maxMaterialCost;
  const upper = rule.maxMaterialCost;
  if (lower === undefined) return `$0–$${upper.toFixed(2)}/SF material cost`;
  return `Over $${lower.toFixed(2)}–$${upper.toFixed(2)}/SF material cost`;
}

export function resolveMaterialLevel(
  rules: MaterialLevelRule[],
  materialCost?: number,
  forcedRuleId?: string,
): ResolvedMaterialLevel | undefined {
  const ordered = activeRules(rules);
  const forced = forcedRuleId ? ordered.find((rule) => rule.id === forcedRuleId) : undefined;
  const rule = forced ?? (materialCost === undefined
    ? undefined
    : ordered.find((candidate) => materialCost <= candidate.maxMaterialCost));
  if (!rule) return undefined;

  return {
    rule,
    customerRate: rule.customerRate,
    basis: forced
      ? `Assigned ${rule.label} · ${materialLevelCostBand(rules, rule)}`
      : `Suggested from ${materialLevelCostBand(rules, rule)}`,
  };
}

export function resolveMaterialPricingRecommendation(
  guide: Pick<MaterialLevelGuideDocument, 'rules' | 'slabPricingThresholdCostPerSf' | 'slabPricingMultiplier'>,
  materialCost?: number,
  forcedRuleId?: string,
): MaterialPricingRecommendation {
  const forced = forcedRuleId ? resolveMaterialLevel(guide.rules, materialCost, forcedRuleId) : undefined;
  if (forced) {
    return {
      mode: 'level',
      level: forced,
      basis: forced.basis,
    };
  }

  if (materialCost === undefined) {
    return { mode: 'needs-cost', basis: 'Needs effective material cost before SalesShop can suggest a Level.' };
  }

  const level = resolveMaterialLevel(guide.rules, materialCost);
  if (level) {
    return {
      mode: 'level',
      level,
      basis: level.basis,
    };
  }

  return {
    mode: 'slab-review',
    thresholdCostPerSf: guide.slabPricingThresholdCostPerSf,
    multiplier: guide.slabPricingMultiplier,
    basis: `Above the standard Level guide (>$${guide.slabPricingThresholdCostPerSf.toFixed(2)}/SF). Review slab-based pricing.`,
  };
}

export function resolveSlabPrice(
  guide: Pick<MaterialLevelGuideDocument, 'slabPricingThresholdCostPerSf' | 'slabPricingMultiplier'>,
  sourceCostPerSf?: number,
  slabCost?: number,
  slabCount?: number,
): ResolvedSlabPrice {
  const eligible = sourceCostPerSf !== undefined && sourceCostPerSf > guide.slabPricingThresholdCostPerSf;
  if (!eligible) {
    return {
      eligible: false,
      thresholdCostPerSf: guide.slabPricingThresholdCostPerSf,
      multiplier: guide.slabPricingMultiplier,
      sourceCostPerSf,
      slabCost,
      slabCount,
      basis: sourceCostPerSf === undefined
        ? 'Needs effective material cost.'
        : `Use the standard Level guide through $${guide.slabPricingThresholdCostPerSf.toFixed(2)}/SF material cost.`,
    };
  }

  if (slabCost === undefined || !Number.isFinite(slabCost) || slabCost <= 0) {
    return {
      eligible: true,
      thresholdCostPerSf: guide.slabPricingThresholdCostPerSf,
      multiplier: guide.slabPricingMultiplier,
      sourceCostPerSf,
      slabCount,
      basis: `Eligible for slab review, but SalesShop needs an actual full-slab purchase cost.`,
    };
  }

  const customerPricePerSlab = Math.round((slabCost * guide.slabPricingMultiplier + Number.EPSILON) * 100) / 100;
  const count = slabCount !== undefined && Number.isFinite(slabCount) && slabCount > 0 ? slabCount : undefined;
  return {
    eligible: true,
    thresholdCostPerSf: guide.slabPricingThresholdCostPerSf,
    multiplier: guide.slabPricingMultiplier,
    sourceCostPerSf,
    slabCost,
    slabCount: count,
    customerPricePerSlab,
    customerTotal: count === undefined ? undefined : Math.round((customerPricePerSlab * count + Number.EPSILON) * 100) / 100,
    basis: `${guide.slabPricingMultiplier}× actual slab purchase cost`,
  };
}
