import { describe, expect, it } from 'vitest';
import {
  defaultMaterialPurchaseOption,
  defaultMaterialVariant,
  materialFamilyForType,
  materialPurchaseCostPerSf,
  materialPurchaseSlabCost,
  materialVariantAreaSf,
  resolveStockMaterialCostReference,
  resolvedMaterialFamily,
  type MaterialVariant,
  type StockMaterial,
} from './settings';

function quartzMaterial(overrides: Partial<StockMaterial> = {}): StockMaterial {
  return {
    id: 'mat-akoya',
    name: 'Akoya',
    supplier: 'UMI',
    brand: 'Vicostone',
    materialFamily: 'Engineered Surfaces',
    materialType: 'Quartz',
    stockProgram: false,
    unit: 'sf',
    active: true,
    variants: [{
      id: 'variant-3cm-jumbo',
      active: true,
      default: true,
      thickness: '3cm',
      finish: 'Polished',
      formatName: 'Jumbo',
      formatKind: 'slab',
      lengthIn: 130,
      widthIn: 65,
      areaSf: 58.68,
      purchaseOptions: [
        {
          id: 'standard',
          label: 'Standard',
          active: true,
          default: true,
          pricingBasis: 'slab',
          costPerSf: 14.5,
          costPerUnit: 850.86,
        },
        {
          id: 'bundle',
          label: 'Bundle 8+',
          active: true,
          default: false,
          minQuantity: 8,
          pricingBasis: 'slab',
          costPerSf: 13.5,
          costPerUnit: 792.18,
        },
      ],
    }],
    ...overrides,
  };
}

describe('material pricing contract for quoting', () => {
  it('derives legacy material family without changing existing catalog records', () => {
    expect(materialFamilyForType('Quartz')).toBe('Engineered Surfaces');
    expect(materialFamilyForType('Granite')).toBe('Natural Stone');
    expect(materialFamilyForType('Natural Stone')).toBe('Natural Stone');

    const legacy = quartzMaterial({ materialFamily: undefined });
    expect(resolvedMaterialFamily(legacy)).toBe('Engineered Surfaces');
  });

  it('uses active defaults when no explicit variant or purchase program is selected', () => {
    const material = quartzMaterial();
    expect(defaultMaterialVariant(material)?.id).toBe('variant-3cm-jumbo');
    expect(defaultMaterialPurchaseOption(defaultMaterialVariant(material))?.id).toBe('standard');

    expect(resolveStockMaterialCostReference(material)).toMatchObject({
      basis: 'variant',
      costPerSf: 14.5,
      slabCost: 850.86,
    });
  });

  it('honors an explicitly selected purchase program instead of silently reverting to default', () => {
    const material = quartzMaterial();
    const reference = resolveStockMaterialCostReference(material, 'variant-3cm-jumbo', 'bundle');

    expect(reference.purchaseOption?.label).toBe('Bundle 8+');
    expect(reference.costPerSf).toBe(13.5);
    expect(reference.slabCost).toBe(792.18);
  });

  it('uses supplier-listed $/SF as authoritative when both listed $/SF and unit cost exist', () => {
    const variant = quartzMaterial().variants![0];
    const option = {
      ...variant.purchaseOptions[0],
      costPerSf: 14.5,
      costPerUnit: 999,
    };

    expect(materialPurchaseCostPerSf(variant, option)).toBe(14.5);
  });

  it('derives $/SF from a listed slab price only when physical area is known', () => {
    const variant: MaterialVariant = {
      id: 'derived',
      active: true,
      default: true,
      formatKind: 'slab',
      lengthIn: 120,
      widthIn: 60,
      purchaseOptions: [],
    };
    const option = {
      id: 'unit',
      label: 'Standard',
      active: true,
      default: true,
      pricingBasis: 'slab' as const,
      costPerUnit: 1000,
    };

    expect(materialVariantAreaSf(variant)).toBe(50);
    expect(materialPurchaseCostPerSf(variant, option)).toBe(20);
  });

  it('does not invent a per-square-foot cost for each-priced products', () => {
    const variant: MaterialVariant = {
      id: 'each',
      active: true,
      default: true,
      formatKind: 'other',
      purchaseOptions: [],
    };
    const option = {
      id: 'each-price',
      label: 'Each',
      active: true,
      default: true,
      pricingBasis: 'each' as const,
      costPerUnit: 250,
    };

    expect(materialPurchaseCostPerSf(variant, option)).toBeUndefined();
  });

  it('calculates slab cost from $/SF and slab area when no listed slab total exists', () => {
    const variant: MaterialVariant = {
      id: 'slab',
      active: true,
      default: true,
      formatKind: 'slab',
      areaSf: 50,
      purchaseOptions: [],
    };
    const option = {
      id: 'sf-price',
      label: 'Standard',
      active: true,
      default: true,
      pricingBasis: 'sf' as const,
      costPerSf: 17.25,
    };

    expect(materialPurchaseSlabCost(variant, option)).toBe(862.5);
  });

  it('ignores inactive defaults and falls forward to the first active option', () => {
    const material = quartzMaterial({
      variants: [
        {
          id: 'inactive-default',
          active: false,
          default: true,
          formatKind: 'slab',
          areaSf: 50,
          purchaseOptions: [{ id: 'old', label: 'Old', active: true, default: true, pricingBasis: 'sf', costPerSf: 8 }],
        },
        {
          id: 'active-current',
          active: true,
          default: false,
          formatKind: 'slab',
          areaSf: 50,
          purchaseOptions: [
            { id: 'inactive-price', label: 'Old price', active: false, default: true, pricingBasis: 'sf', costPerSf: 9 },
            { id: 'current-price', label: 'Current', active: true, default: false, pricingBasis: 'sf', costPerSf: 11 },
          ],
        },
      ],
    });

    const reference = resolveStockMaterialCostReference(material);
    expect(reference.variant?.id).toBe('active-current');
    expect(reference.purchaseOption?.id).toBe('current-price');
    expect(reference.costPerSf).toBe(11);
  });

  it('keeps legacy internal cost as fallback only when variant pricing is unavailable', () => {
    const material = quartzMaterial({
      internalCost: 10.25,
      variants: [{
        id: 'no-price',
        active: true,
        default: true,
        formatKind: 'slab',
        areaSf: 50,
        purchaseOptions: [{ id: 'blank', label: 'Blank', active: true, default: true, pricingBasis: 'slab' }],
      }],
    });

    expect(resolveStockMaterialCostReference(material)).toMatchObject({
      basis: 'legacy',
      costPerSf: 10.25,
    });
  });
});
