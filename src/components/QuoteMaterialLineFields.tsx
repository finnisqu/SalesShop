import { useEffect, useMemo, useState } from 'react';
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
  defaultMaterialVariant,
  resolveStockMaterialCostReference,
  type MaterialVariant,
  type StockMaterial,
} from '../types/settings';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function variantLabel(variant?: MaterialVariant) {
  if (!variant) return 'Default spec';
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

export function QuoteMaterialLineFields({ quoteId, line }: { quoteId: string; line: QuoteLine }) {
  const materials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const guide = useMaterialLevelGuideStore((state) => state.guide);
  const hydrateGuide = useMaterialLevelGuideStore((state) => state.hydrate);
  const updateLine = useQuoteStore((state) => state.updateLine);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(!line.materialReference?.materialId && !line.materialReference?.customMaterialName);

  useEffect(() => {
    void hydrateSettings();
    hydrateGuide();
  }, [hydrateSettings, hydrateGuide]);

  const activeMaterials = useMemo(
    () => materials.filter((material) => material.active),
    [materials],
  );
  const selectedMaterial = line.materialReference?.materialId
    ? activeMaterials.find((material) => material.id === line.materialReference?.materialId)
    : undefined;
  const selectedVariant = selectedMaterial
    ? line.materialReference?.variantId
      ? (selectedMaterial.variants ?? []).find((variant) => variant.active !== false && variant.id === line.materialReference?.variantId)
      : defaultMaterialVariant(selectedMaterial)
    : undefined;
  const selectedPurchaseOption = selectedVariant
    ? line.materialReference?.purchaseOptionId
      ? (selectedVariant.purchaseOptions ?? []).find((option) => option.active !== false && option.id === line.materialReference?.purchaseOptionId)
      : defaultMaterialPurchaseOption(selectedVariant)
    : undefined;

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

  const applyMaterial = (material: StockMaterial, variantId?: string, purchaseOptionId?: string, keepSearching = false) => {
    const reference = resolveStockMaterialCostReference(material, variantId, purchaseOptionId);
    const variant = reference.variant ?? defaultMaterialVariant(material);
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
      variantId: variant?.id,
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
    if (!keepSearching) setSearching(false);
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
    setSearching(false);
  };

  const selectVariant = (variantId: string) => {
    if (!selectedMaterial) return;
    const variant = (selectedMaterial.variants ?? []).find((candidate) => candidate.id === variantId && candidate.active !== false);
    const option = defaultMaterialPurchaseOption(variant);
    applyMaterial(selectedMaterial, variant?.id, option?.id, true);
  };

  const selectPurchaseOption = (purchaseOptionId: string) => {
    if (!selectedMaterial || !selectedVariant) return;
    applyMaterial(selectedMaterial, selectedVariant.id, purchaseOptionId, true);
  };

  const snapshot = line.materialReference?.snapshot;
  const activeVariants = (selectedMaterial?.variants ?? []).filter((variant) => variant.active !== false);
  const activeOptions = (selectedVariant?.purchaseOptions ?? []).filter((option) => option.active !== false);
  const currentReference = selectedMaterial
    && (!line.materialReference?.variantId || selectedVariant)
    && (!line.materialReference?.purchaseOptionId || selectedPurchaseOption)
      ? resolveStockMaterialCostReference(selectedMaterial, selectedVariant?.id, selectedPurchaseOption?.id)
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
          {snapshotComparison?.changed && currentReference && (
            <button type="button" onClick={() => applyMaterial(selectedMaterial!, currentReference.variant?.id, currentReference.purchaseOption?.id)}>Update snapshot</button>
          )}
        </div>}
        {selectedMaterial && (activeVariants.length > 1 || activeOptions.length > 1) && <div className="quote-picker-options">
          {activeVariants.length > 1 && <label><span>Variant</span><select value={selectedVariant?.id ?? ''} onChange={(event) => selectVariant(event.target.value)}>
            {activeVariants.map((variant) => <option key={variant.id} value={variant.id}>{variantLabel(variant)}</option>)}
          </select></label>}
          {selectedVariant && activeOptions.length > 1 && <label><span>Cost program</span><select value={selectedPurchaseOption?.id ?? ''} onChange={(event) => selectPurchaseOption(event.target.value)}>
            {activeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}{option.minQuantity ? ` · ${option.minQuantity}+` : ''}</option>)}
          </select></label>}
        </div>}
        <div className="quote-material-search-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Materials database…"
            aria-label="Search material database"
          />
          {(selectedMaterial || line.materialReference?.customMaterialName) && <button type="button" onClick={() => setSearching(false)}>Cancel</button>}
        </div>
        <div className="quote-material-results">
          {results.map((material) => {
            const reference = resolveStockMaterialCostReference(material);
            return (
              <button type="button" key={material.id} onClick={() => applyMaterial(material)}>
                <span><strong>{[material.brand, material.name].filter(Boolean).join(' ')}</strong><small>{[material.materialType, material.supplier].filter(Boolean).join(' · ')}</small></span>
                <span><b>{variantLabel(reference.variant)}</b><small>{reference.slabCost === undefined ? 'No slab price' : `${money.format(reference.slabCost)}/slab`}</small></span>
              </button>
            );
          })}
          {search.trim() && (
            <button type="button" className="quote-material-custom-result" onClick={applyCustom}>
              <span><strong>Use “{search.trim()}”</strong><small>Custom material for this quote</small></span>
              <span><b>Not in database</b><small>Does not create a catalog record</small></span>
            </button>
          )}
          {!results.length && !search.trim() && <div className="quote-material-empty">No active materials are available.</div>}
        </div>
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
        <span>Material</span>
        <strong>{[quotedBrand, quotedName].filter(Boolean).join(' ')}</strong>
        <small>{[
          quotedVariantLabel,
          quotedPurchaseLabel,
          quotedType,
        ].filter(Boolean).join(' · ') || 'Custom quote material'}</small>
      </div>

      {(snapshot || selectedMaterial) && <div className="quote-material-cost-reference">
        <span>Source cost</span>
        <strong>{quotedCostPerSf === undefined ? '—' : `${money.format(quotedCostPerSf)}/SF`}</strong>
        <small>{quotedSlabCost === undefined ? 'No slab cost' : `${money.format(quotedSlabCost)}/slab`}</small>
      </div>}

      {snapshot && !selectedMaterial && snapshot.materialId && <span className="quote-source-status is-warning">Source unavailable</span>}
      {snapshotComparison?.changed && currentSnapshot && <span className="quote-source-status">Source updated</span>}
      {!snapshot && selectedMaterial && currentReference && <span className="quote-source-status">Snapshot needed</span>}

      <button type="button" className="quote-material-change quote-database-change" onClick={() => { setSearch(''); setSearching(true); }}>Change</button>
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
