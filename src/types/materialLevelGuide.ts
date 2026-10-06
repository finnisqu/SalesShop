export type MaterialLevelPricingMode = 'fixed' | 'multiplier';

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
}

export interface MaterialLevelGuideDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  note?: string;
  rules: MaterialLevelRule[];
  history: MaterialLevelGuideVersion[];
  updatedAt: string;
}

export interface ResolvedMaterialLevel {
  rule: MaterialLevelRule;
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
