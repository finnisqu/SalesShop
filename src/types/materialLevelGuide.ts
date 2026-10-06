export type MaterialLevelPricingMode = 'fixed' | 'multiplier';
export type NonStockPricingMode = 'multiplier' | 'margin';

export interface MaterialLevelRule {
  id: string;
  label: string;
  maxMaterialCost?: number;
  pricingMode: MaterialLevelPricingMode;
  customerRate?: number;
  multiplier?: number;
  active: boolean;
}

export interface MaterialLevelGuideVersion {
  id: string;
  recordedAt: string;
  note?: string;
  rules: MaterialLevelRule[];
  nonStockPricingMode?: NonStockPricingMode;
  nonStockMultiplier?: number;
  nonStockMarginPct?: number;
}

export interface MaterialLevelGuideDocument {
  schemaVersion: 2;
  id: string;
  name: string;
  note?: string;
  rules: MaterialLevelRule[];
  nonStockPricingMode: NonStockPricingMode;
  nonStockMultiplier?: number;
  nonStockMarginPct?: number;
  history: MaterialLevelGuideVersion[];
  updatedAt: string;
}

export interface ResolvedMaterialLevel {
  rule: MaterialLevelRule;
  customerRate?: number;
  basis: string;
}

export interface ResolvedNonStockPrice {
  customerRate?: number;
  basis: string;
}

function activeRules(rules: MaterialLevelRule[]) {
  return rules
    .filter((rule) => rule.active)
    .sort((a, b) => {
      if (a.maxMaterialCost === undefined) return 1;
      if (b.maxMaterialCost === undefined) return -1;
      return a.maxMaterialCost - b.maxMaterialCost;
    });
}

export function materialLevelCostBand(rules: MaterialLevelRule[], rule: MaterialLevelRule) {
  const ordered = activeRules(rules);
  const index = ordered.findIndex((candidate) => candidate.id === rule.id);
  const previous = index > 0 ? ordered[index - 1] : undefined;
  const lower = previous?.maxMaterialCost;
  const upper = rule.maxMaterialCost;
  if (upper === undefined) return lower === undefined ? 'Any material cost' : `Over $${lower.toFixed(2)}/SF material cost`;
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
    : ordered.find((candidate) => candidate.maxMaterialCost === undefined || materialCost <= candidate.maxMaterialCost));
  if (!rule) return undefined;

  const customerRate = rule.pricingMode === 'fixed'
    ? rule.customerRate
    : materialCost === undefined || rule.multiplier === undefined
      ? undefined
      : materialCost * rule.multiplier;

  return {
    rule,
    customerRate,
    basis: rule.pricingMode === 'multiplier'
      ? `${rule.multiplier ?? 0}× material cost`
      : materialLevelCostBand(rules, rule),
  };
}

export function resolveNonStockMaterialPrice(
  guide: Pick<MaterialLevelGuideDocument, 'nonStockPricingMode' | 'nonStockMultiplier' | 'nonStockMarginPct'>,
  materialCost?: number,
): ResolvedNonStockPrice {
  if (materialCost === undefined) return { basis: 'Needs material cost' };
  if (guide.nonStockPricingMode === 'margin') {
    const margin = guide.nonStockMarginPct;
    if (margin === undefined || margin < 0 || margin >= 100) return { basis: 'Set target margin' };
    return {
      customerRate: materialCost / (1 - margin / 100),
      basis: `${margin}% gross margin target`,
    };
  }

  const multiplier = guide.nonStockMultiplier;
  return {
    customerRate: multiplier === undefined ? undefined : materialCost * multiplier,
    basis: multiplier === undefined ? 'Set multiplier' : `${multiplier}× material cost`,
  };
}
