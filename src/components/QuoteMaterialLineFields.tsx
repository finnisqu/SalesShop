import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateQuoteSlabMultiplierPrice } from '../services/quoteSlabPricing';
import {
  compareQuoteMaterialSnapshot,
  createQuoteMaterialCostSnapshot,
} from '../services/quoteMaterialSnapshot';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { useQuoteStore } from '../store/quoteStore';
import type { QuoteLine, QuoteLineMaterialReference } from '../types/quote';
import {
  defaultMaterialPurchaseOption,
  resolveStockMaterialCostReference,
  type MaterialVariant,
  type StockMaterial,
} from '../types/settings';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function variantLabel(variant?: MaterialVariant) {
  if (!variant) return 'Variant required';
  const dimensions = variant.lengthIn && variant.widthIn ? `${variant.lengthIn}×${variant.widthIn}` : undefined;
  return [variant.thickness, variant.finish, variant.formatName, dimensions].filter(Boolean).join(' · ') || 'Standard spec';
}

function materialDescription(material: StockMaterial, variant?: MaterialVariant) {
  return [material.brand, material.name, variant?.thickness, variant?.finish, variant?.formatName].filter(Boolean).join(' · ');
}

function materialSearchText(material: StockMaterial) {
  const variants = (material.variants ?? []).flatMap((variant) => [
    variant.sku,
    variant.thickness,
    variant.finish,
    variant.formatName,
    variant.lengthIn && variant.widthIn ? `${variant.lengthIn}x${variant.widthIn}` : undefined,
    ...(variant.features ?? []),
  ]);
  return [
    material.name,
    material.supplier,
    material.brand,
    material.collection,
    material.supplierGroup,
    material.sku,
    material.materialType,
    ...(material.features ?? []),
    ...variants,
  ].filter(Boolean).join(' ').toLowerCase();
}

function sameMoney(a?: number, b?: number) {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a - b) < 0.005;
}

export function QuoteMaterialLineFields({ quoteId, line, editSignal = 0 }: { quoteId: string; line: QuoteLine; editSignal?: number }) {
  const materials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const guide = useMaterialLevelGuideStore((state) => state.guide);
  const hydrateGuide = useMaterialLevelGuideStore((state) => state.hydrate);
  const updateLine = useQuoteStore((state) => state.updateLine);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(!line.materialReference?.materialId && !line.materialReference?.customMaterialName);
  const [pendingMaterialId, setPendingMaterialId] = useState<string | null>(null);
  const [pendingVariantId, setPendingVariantId] = useState<string | null>(null);
  const lastEditSignal = useRef(editSignal);

  useEffect(() => {
    void hydrateSettings();
    hydrateGuide();
  }, [hydrateSettings, hydrateGuide]);

  useEffect(() => {
    if (editSignal === lastEditSignal.current) return;
    lastEditSignal.current = editSignal;
    setSearch('');
    setPendingMaterialId(line.materialReference?.materialId ?? null);
    setPendingVariantId(null);
    setSearching(true);
  }, [editSignal, line.materialReference?.materialId]);

  useEffect(() => {
    const collapse = () => {
      if (!line.materialReference?.materialId && !line.materialReference?.customMaterialName) return;
      setSearching(false);
      setPendingMaterialId(null);
      setPendingVariantId(null);
      setSearch('');
    };
    window.addEventListener('sales-shop:quote-collapse-all', collapse);
    return () => window.removeEventListener('sales-shop:quote-collapse-all', collapse);
  }, [line.materialReference?.materialId, line.materialReference?.customMaterialName]);

  const activeMaterials = useMemo(
    () => materials.filter((material) => material.active),
    [materials],
  );

  const selectedMaterial = line.materialReference?.materialId
    ? activeMaterials.find((material) => material.id === line.materialReference?.materialId)
    : undefined;
  const selectedVariant = selectedMaterial && line.materialReference?.variantId
    ? (selectedMaterial.variants ?? []).find((variant) => variant.active !== false && variant.id === line.materialReference?.variantId)
    : undefined;
  const selectedPurchaseOption = selectedVariant && line.materialReference?.purchaseOptionId
    ? (selectedVariant.purchaseOptions ?? []).find((option) => option.active !== false && option.id === line.materialReference?.purchaseOptionId)
    : selectedVariant
      ? defaultMaterialPurchaseOption(selectedVariant)
      : undefined;

  const pendingMaterial = pendingMaterialId
    ? activeMaterials.find((material) => material.id === pendingMaterialId)
    : undefined;
  const pendingVariants = (pendingMaterial?.variants ?? []).filter((variant) => variant.active !== false);
  const pendingVariant = pendingVariantId
    ? pendingVariants.find((variant) => variant.id === pendingVariantId)
    : undefined;
  const pendingOptions = (pendingVariant?.purchaseOptions ?? []).filter((option) => option.active !== false);

  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const source = needle
      ? activeMaterials.filter((material) => materialSearchText(material).includes(needle))
      : activeMaterials;
    return source
      .slice()
      .sort((a, b) => Number(b.stockProgram) - Number(a.stockProgram) || a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [activeMaterials, search]);

  const applyMaterial = (material: StockMaterial, variantId: string, purchaseOptionId?: string) => {
    const variant = (material.variants ?? []).find((candidate) => candidate.active !== false && candidate.id === variantId);
    if (!variant) return;
    const reference = resolveStockMaterialCostReference(material, variant.id, purchaseOptionId);
    const purchaseOption = reference.purchaseOption ?? defaultMaterialPurchaseOption(variant);
    const current = line.materialReference;
    const slabMode = line.pricingMode === 'slab-multiplier';
    const multiplier = current?.slabMultiplier ?? guide.slabPricingMultiplier;
    const slabCount = current?.slabCount;
    const slabCost = slabMode ? reference.slabCost : undefined;
    const slabPricing = slabMode
      ? calculateQuoteSlabMultiplierPrice({ slabCost, multiplier, slabCount })
      : undefined;

    const materialReference: QuoteLineMaterialReference = {
      materialId: material.id,
      variantId: variant.id,
      purchaseOptionId: purchaseOption?.id,
      stockProgram: material.stockProgram,
      pricingSource: slabMode ? 'slab-multiplier' : 'manual-line-rate',
      sourceCostPerSf: reference.costPerSf,
      catalogSlabCost: reference.slabCost,
      sourceSlabCost: slabCost,
      slabCostOverride: false,
      slabMultiplier: slabMode ? multiplier : undefined,
      slabCount: slabMode ? slabCount : undefined,
      customerPricePerSlab: slabPricing?.customerPricePerSlab,
      snapshot: createQuoteMaterialCostSnapshot(material, reference),
    };

    updateLine(quoteId, line.id, {
      description: materialDescription(material, variant),
      materialReference,
      amount: slabMode ? slabPricing?.customerTotal : line.amount,
    });
    setSearch('');
    setPendingMaterialId(null);
    setPendingVariantId(null);
    setSearching(false);
  };

  const chooseMaterial = (material: StockMaterial) => {
    setPendingMaterialId(material.id);
    setPendingVariantId(null);
  };

  const chooseVariant = (variant: MaterialVariant) => {
    if (!pendingMaterial) return;
    const options = (variant.purchaseOptions ?? []).filter((option) => option.active !== false);
    if (options.length > 1) {
      setPendingVariantId(variant.id);
      return;
    }
    applyMaterial(pendingMaterial, variant.id, options[0]?.id);
  };

  const choosePurchaseOption = (purchaseOptionId: string) => {
    if (!pendingMaterial || !pendingVariant) return;
    applyMaterial(pendingMaterial, pendingVariant.id, purchaseOptionId);
  };

  const applyCustom = () => {
    const name = search.trim();
    if (!name) return;
    const slabMode = line.pricingMode === 'slab-multiplier';
    const multiplier = line.materialReference?.slabMultiplier ?? guide.slabPricingMultiplier;
    const materialReference: QuoteLineMaterialReference = {
      customMaterialName: name,
      stockProgram: false,
      pricingSource: slabMode ? 'slab-multiplier' : 'manual-line-rate',
      slabMultiplier: slabMode ? multiplier : undefined,
    };
    updateLine(quoteId, line.id, {
      description: name,
      materialReference,
      amount: slabMode ? undefined : line.amount,
    });
    setSearch('');
    setPendingMaterialId(null);
    setPendingVariantId(null);
    setSearching(false);
  };

  const snapshot = line.materialReference?.snapshot;
  const currentReference = selectedMaterial && selectedVariant
    && (!line.materialReference?.purchaseOptionId || selectedPurchaseOption)
      ? resolveStockMaterialCostReference(selectedMaterial, selectedVariant.id, selectedPurchaseOption?.id)
      : undefined;
  const currentSnapshot = selectedMaterial && currentReference
    ? createQuoteMaterialCostSnapshot(selectedMaterial, currentReference)
    : undefined;
  const snapshotComparison = snapshot && currentSnapshot
    ? compareQuoteMaterialSnapshot(snapshot, currentSnapshot)
    : undefined;

  if (searching || (!snapshot && !selectedMaterial && !line.materialReference?.customMaterialName)) {
    return (
      <div className="quote-material-picker">
        {(snapshot || selectedMaterial || line.materialReference?.customMaterialName) && <div className="quote-picker-current">
          <div>
            <span>Current material</span>
            <strong>{[
              snapshot?.brand ?? selectedMaterial?.brand,
              snapshot?.materialName ?? selectedMaterial?.name ?? line.materialReference?.customMaterialName,
            ].filter(Boolean).join(' ')}</strong>
            <small>{[
              snapshot?.variantLabel ?? variantLabel(selectedVariant),
              snapshot?.purchaseOptionLabel ?? selectedPurchaseOption?.label,
            ].filter(Boolean).join(' · ') || 'Custom quote material'}</small>
          </div>
          {snapshotComparison?.changed && currentReference && selectedMaterial && selectedVariant && (
            <button type="button" onClick={() => applyMaterial(selectedMaterial, selectedVariant.id, currentReference.purchaseOption?.id)}>Update snapshot</button>
          )}
        </div>}

        {pendingMaterial ? (
          <div className="quote-material-choice-step">
            <div className="quote-material-choice-heading">
              <button type="button" onClick={() => { setPendingMaterialId(null); setPendingVariantId(null); }}>← Materials</button>
              <div>
                <span>{pendingVariant ? 'Choose cost program' : 'Choose variant'}</span>
                <strong>{[pendingMaterial.brand, pendingMaterial.name].filter(Boolean).join(' ')}</strong>
              </div>
            </div>
            {!pendingVariant ? (
              <div className="quote-material-variant-choices">
                {pendingVariants.map((variant) => {
                  const reference = resolveStockMaterialCostReference(pendingMaterial, variant.id, defaultMaterialPurchaseOption(variant)?.id);
                  return <button type="button" key={variant.id} onClick={() => chooseVariant(variant)}>
                    <span><strong>{variantLabel(variant)}</strong><small>{variant.sku || 'No SKU'}</small></span>
                    <span><b>{reference.costPerSf === undefined ? 'Cost —' : `${money.format(reference.costPerSf)}/SF`}</b><small>{reference.slabCost === undefined ? 'No slab cost' : `${money.format(reference.slabCost)}/slab`}</small></span>
                  </button>;
                })}
                {!pendingVariants.length && <div className="quote-material-empty">This material has no active variants. Add a variant in Catalog before quoting it.</div>}
              </div>
            ) : (
              <div className="quote-material-variant-choices">
                {pendingOptions.map((option) => {
                  const reference = resolveStockMaterialCostReference(pendingMaterial, pendingVariant.id, option.id);
                  return <button type="button" key={option.id} onClick={() => choosePurchaseOption(option.id)}>
                    <span><strong>{option.label}</strong><small>{option.minQuantity ? `${option.minQuantity}+ minimum` : 'Standard purchase program'}</small></span>
                    <span><b>{reference.costPerSf === undefined ? 'Cost —' : `${money.format(reference.costPerSf)}/SF`}</b><small>{reference.slabCost === undefined ? 'No slab cost' : `${money.format(reference.slabCost)}/slab`}</small></span>
                  </button>;
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="quote-material-search-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Materials database…"
                aria-label="Search material database"
              />
              {(snapshot || selectedMaterial || line.materialReference?.customMaterialName) && <button type="button" onClick={() => setSearching(false)}>Cancel</button>}
            </div>
            <div className="quote-material-results">
              {results.map((material) => (
                <button type="button" key={material.id} onClick={() => chooseMaterial(material)}>
                  <span><strong>{[material.brand, material.name].filter(Boolean).join(' ')}</strong><small>{[material.materialType, material.supplier].filter(Boolean).join(' · ')}</small></span>
                  <span><b>{(material.variants ?? []).filter((variant) => variant.active !== false).length} variant{(material.variants ?? []).filter((variant) => variant.active !== false).length === 1 ? '' : 's'}</b><small>Choose next</small></span>
                </button>
              ))}
              {search.trim() && (
                <button type="button" className="quote-material-custom-result" onClick={applyCustom}>
                  <span><strong>Use “{search.trim()}”</strong><small>Custom material for this quote</small></span>
                  <span><b>Not in database</b><small>No catalog variant required</small></span>
                </button>
              )}
              {!results.length && !search.trim() && <div className="quote-material-empty">No active materials are available.</div>}
            </div>
          </>
        )}
      </div>
    );
  }

  const customName = line.materialReference?.customMaterialName;
  const quotedCostPerSf = snapshot?.costPerSf ?? line.materialReference?.sourceCostPerSf;
  const quotedSlabCost = snapshot?.slabCost ?? line.materialReference?.catalogSlabCost;
  const quotedName = snapshot?.materialName ?? selectedMaterial?.name ?? customName ?? 'Custom material';
  const quotedBrand = snapshot?.brand ?? selectedMaterial?.brand;
  const quotedType = snapshot?.materialType ?? selectedMaterial?.materialType;
  const quotedVariantLabel = snapshot?.variantLabel ?? variantLabel(selectedVariant);
  const quotedPurchaseLabel = snapshot?.purchaseOptionLabel ?? selectedPurchaseOption?.label;

  return (
    <div className="quote-material-selection quote-database-result">
      <div className="quote-material-selection-main">
        <strong>{[quotedBrand, quotedName].filter(Boolean).join(' ')}</strong>
        <small>{[
          quotedVariantLabel,
          quotedPurchaseLabel,
          quotedType,
        ].filter(Boolean).join(' · ') || 'Custom quote material'}</small>
      </div>

      {(snapshot || selectedMaterial) && <div className="quote-material-cost-reference">
        <strong>{quotedCostPerSf === undefined ? 'Cost —' : `Cost ${money.format(quotedCostPerSf)}/SF`}</strong>
        <small>{quotedSlabCost === undefined ? 'No slab cost' : `${money.format(quotedSlabCost)}/slab`}</small>
      </div>}

      {snapshot && !selectedMaterial && snapshot.materialId && <span className="quote-source-status is-warning">Source unavailable</span>}
      {snapshotComparison?.changed && currentSnapshot && <span className="quote-source-status">Source updated</span>}
    </div>
  );
}

export function slabReferencePatch(
  line: QuoteLine,
  guideMultiplier: number,
  patch: Partial<Pick<QuoteLineMaterialReference, 'sourceSlabCost' | 'slabMultiplier' | 'slabCount'>>,
) {
  const current: QuoteLineMaterialReference = line.materialReference ?? {
    stockProgram: false,
    pricingSource: 'slab-multiplier',
  };
  const next: QuoteLineMaterialReference = {
    ...current,
    ...patch,
    pricingSource: 'slab-multiplier',
    slabMultiplier: patch.slabMultiplier ?? current.slabMultiplier ?? guideMultiplier,
  };
  const pricing = calculateQuoteSlabMultiplierPrice({
    slabCost: next.sourceSlabCost,
    multiplier: next.slabMultiplier,
    slabCount: next.slabCount,
  });
  next.customerPricePerSlab = pricing?.customerPricePerSlab;
  next.slabCostOverride = next.catalogSlabCost === undefined
    ? next.sourceSlabCost !== undefined
    : !sameMoney(next.sourceSlabCost, next.catalogSlabCost);
  return { materialReference: next, amount: pricing?.customerTotal };
}
