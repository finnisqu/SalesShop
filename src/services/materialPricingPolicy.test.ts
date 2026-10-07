import { describe, expect, it } from 'vitest';
import {
  resolveMaterialLevel,
  resolveMaterialPricingRecommendation,
  resolveSlabPrice,
  type MaterialLevelGuideDocument,
  type MaterialLevelRule,
} from '../types/materialLevelGuide';
import {
  materialPurchaseSlabCost,
  materialVariantAreaSf,
  type MaterialPurchaseOption,
  type MaterialVariant,
} from '../types/settings';

const rules: MaterialLevelRule[] = [
  { id: 'l1', label: 'Level 1', maxMaterialCost: 9, customerRate: 34, active: true },
  { id: 'l2', label: 'Level 2', maxMaterialCost: 12, customerRate: 44, active: true },
  { id: 'l3', label: 'Level 3', maxMaterialCost: 14, customerRate: 54, active: true },
  { id: 'l4', label: 'Level 4', maxMaterialCost: 16, customerRate: 60, active: true },
  { id: 'l5', label: 'Level 5', maxMaterialCost: 19, customerRate: 68, active: true },
  { id: 'l6', label: 'Level 6', maxMaterialCost: 21, customerRate: 75, active: true },
  { id: 'l7', label: 'Level 7', maxMaterialCost: 23, customerRate: 85, active: true },
];

const guide: Pick<MaterialLevelGuideDocument, 'rules' | 'slabPricingThresholdCostPerSf' | 'slabPricingMultiplier'> = {
  rules,
  slabPricingThresholdCostPerSf: 23,
  slabPricingMultiplier: 2.2,
};

function slabVariant(overrides: Partial<MaterialVariant> = {}): MaterialVariant {
  return {
    id: 'variant',
    active: true,
    default: true,
    thickness: '3cm',
    finish: 'Polished',
    formatName: 'Jumbo',
    formatKind: 'slab',
    lengthIn: 65,
    widthIn: 130,
    areaSf: 58.68,
    purchaseOptions: [],
    ...overrides,
  };
}

function purchaseOption(overrides: Partial<MaterialPurchaseOption> = {}): MaterialPurchaseOption {
  return {
    id: 'price',
    label: 'Standard',
    active: true,
    default: true,
    pricingBasis: 'slab',
    ...overrides,
  };
}

describe('standard material Level suggestions', () => {
  it('uses the established Level guide instead of multiplying cheap material cost', () => {
    const recommendation = resolveMaterialPricingRecommendation(guide, 4.5);
    expect(recommendation.mode).toBe('level');
    if (recommendation.mode !== 'level') throw new Error('Expected Level pricing.');
    expect(recommendation.level.rule.label).toBe('Level 1');
    expect(recommendation.level.customerRate).toBe(34);
    expect(recommendation.level.customerRate).not.toBe(9.9);
  });

  it('maps the standard cost bands exactly through Level 7', () => {
    expect(resolveMaterialLevel(rules, 9)?.rule.label).toBe('Level 1');
    expect(resolveMaterialLevel(rules, 9.01)?.rule.label).toBe('Level 2');
    expect(resolveMaterialLevel(rules, 15)?.rule.label).toBe('Level 4');
    expect(resolveMaterialLevel(rules, 20)?.rule.label).toBe('Level 6');
    expect(resolveMaterialLevel(rules, 23)?.rule.label).toBe('Level 7');
  });

  it('leaves the standard Level guide above $23/SF instead of applying 2.2x to $/SF', () => {
    const recommendation = resolveMaterialPricingRecommendation(guide, 23.01);
    expect(recommendation).toMatchObject({
      mode: 'slab-review',
      thresholdCostPerSf: 23,
      multiplier: 2.2,
    });
  });

  it('still honors an explicitly assigned STOCK Level as a management decision', () => {
    const recommendation = resolveMaterialPricingRecommendation(guide, 28, 'l7');
    expect(recommendation.mode).toBe('level');
    if (recommendation.mode !== 'level') throw new Error('Expected assigned Level.');
    expect(recommendation.level.rule.label).toBe('Level 7');
    expect(recommendation.level.customerRate).toBe(85);
    expect(recommendation.level.basis).toMatch(/Assigned/);
  });
});

describe('premium slab quick-math', () => {
  it('uses actual listed slab purchase cost when available', () => {
    const variant = slabVariant();
    const option = purchaseOption({ costPerSf: 27.95, costPerUnit: 1640.11 });
    expect(materialPurchaseSlabCost(variant, option)).toBe(1640.11);

    const pricing = resolveSlabPrice(guide, 27.95, 1640.11, 1);
    expect(pricing.eligible).toBe(true);
    expect(pricing.customerPricePerSlab).toBeCloseTo(3608.24, 2);
    expect(pricing.customerTotal).toBeCloseTo(3608.24, 2);
  });

  it('prices from slab count, not finished job square footage', () => {
    const oneSlab = resolveSlabPrice(guide, 27.95, 1640.11, 1);
    const twoSlabs = resolveSlabPrice(guide, 27.95, 1640.11, 2);

    // Finished SF is intentionally not an input to slab pricing.
    expect(oneSlab.customerTotal).toBeCloseTo(3608.24, 2);
    expect(twoSlabs.customerTotal).toBeCloseTo(7216.48, 2);
  });

  it('can derive a full slab purchase cost from listed $/SF and listed slab area', () => {
    const variant = slabVariant();
    const option = purchaseOption({ pricingBasis: 'sf', costPerSf: 27.95 });
    expect(materialVariantAreaSf(variant)).toBeCloseTo(58.68, 2);
    expect(materialPurchaseSlabCost(variant, option)).toBeCloseTo(1640.11, 2);
  });

  it('does not pretend a half slab is a full-slab reference', () => {
    const variant = slabVariant({ formatKind: 'half-slab', widthIn: 32.5, areaSf: 29.34 });
    const option = purchaseOption({ pricingBasis: 'half-slab', costPerUnit: 946.22 });
    expect(materialPurchaseSlabCost(variant, option)).toBeUndefined();
  });

  it('does not allow slab-multiplier pricing below the premium threshold', () => {
    const pricing = resolveSlabPrice(guide, 20, 1200, 1);
    expect(pricing.eligible).toBe(false);
    expect(pricing.customerTotal).toBeUndefined();
    expect(pricing.basis).toMatch(/standard Level guide/i);
  });
});
