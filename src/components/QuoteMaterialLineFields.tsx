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

function displayDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

  const applyMaterial = (material: StockMaterial, variantId?: string, purchaseOptionId?: string) => {
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
    setSearching(false);
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
    applyMaterial(selectedMaterial, variant?.id, option?.id);
  };

  const selectPurchaseOption = (purchaseOptionId: string) => {
    if (!selectedMaterial || !selectedVariant) return;
    applyMaterial(selectedMaterial, selectedVariant.id, purchaseOptionId);
  };

  const snapshot = line.materialReference?.snapshot;
  if (searching || (!snapshot && !selectedMaterial && !line.materialReference?.customMaterialName)) {
    return (
      <div className="quote-material-picker">
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
  const customName = line.materialReference?.customMaterialName;
  const quotedCostPerSf = snapshot?.costPerSf ?? line.materialReference?.sourceCostPerSf;
  const quotedSlabCost = snapshot?.slabCost ?? line.materialReference?.catalogSlabCost;
  const quotedName = snapshot?.materialName ?? selectedMaterial?.name ?? customName ?? 'Custom material';
  const quotedBrand = snapshot?.brand ?? selectedMaterial?.brand;
  const quotedType = snapshot?.materialType ?? selectedMaterial?.materialType;
  const quotedSupplier = snapshot?.supplier ?? selectedMaterial?.supplier;
  const quotedVariantLabel = snapshot?.variantLabel ?? variantLabel(selectedVariant);
  const quotedPurchaseLabel = snapshot?.purchaseOptionLabel ?? selectedPurchaseOption?.label;
  const sourceDate = displayDate(snapshot?.sourceEffectiveDate);
  const sourceLabel = snapshot?.sourcePriceListLabel ?? snapshot?.sourceFileName;

  const refreshSnapshot = () => {
    if (!selectedMaterial || !currentReference) return;
    applyMaterial(selectedMaterial, currentReference.variant?.id, currentReference.purchaseOption?.id);
  };

  return (
    <div className="quote-material-selection">
      <div className="quote-material-selection-main">
        <span>Quoted material</span>
        <strong>{[quotedBrand, quotedName].filter(Boolean).join(' ')}</strong>
        <small>{[quotedType, quotedSupplier].filter(Boolean).join(' · ') || 'Custom quote material'}</small>
      </div>

      {selectedMaterial && activeVariants.length > 0 && (
        <label>
          <span>Slab / variant</span>
          <select value={selectedVariant?.id ?? ''} onChange={(event) => selectVariant(event.target.value)}>
            {activeVariants.map((variant) => <option key={variant.id} value={variant.id}>{variantLabel(variant)}</option>)}
          </select>
        </label>
      )}

      {selectedMaterial && selectedVariant && activeOptions.length > 1 && (
        <label>
          <span>Cost program</span>
          <select value={selectedPurchaseOption?.id ?? ''} onChange={(event) => selectPurchaseOption(event.target.value)}>
            {activeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}{option.minQuantity ? ` · ${option.minQuantity}+` : ''}</option>)}
          </select>
        </label>
      )}

      {(snapshot || selectedMaterial) && (
        <div className="quote-material-cost-reference">
          <span>{snapshot ? 'Quoted cost' : 'Legacy reference'}</span>
          <strong>{quotedCostPerSf === undefined ? '—' : `${money.format(quotedCostPerSf)}/SF`}</strong>
          <small>{quotedSlabCost === undefined ? 'No full-slab cost' : `${money.format(quotedSlabCost)}/slab`}</small>
        </div>
      )}

      {snapshot && (
        <div className="quote-material-snapshot-meta">
          <span>{quotedVariantLabel || 'Default spec'}{quotedPurchaseLabel ? ` · ${quotedPurchaseLabel}` : ''}</span>
          <small>{[sourceLabel, sourceDate ? `effective ${sourceDate}` : undefined].filter(Boolean).join(' · ') || `Captured ${displayDate(snapshot.capturedAt) ?? ''}`}</small>
        </div>
      )}

      {snapshot && !selectedMaterial && snapshot.materialId && (
        <div className="quote-material-catalog-state is-unavailable">
          <strong>Catalog item unavailable</strong>
          <small>The quote snapshot is retained and unchanged.</small>
        </div>
      )}

      {snapshotComparison?.changed && currentSnapshot && (
        <div className="quote-material-catalog-state is-changed">
          <div>
            <strong>Catalog pricing changed</strong>
            <small>
              Now {currentSnapshot.costPerSf === undefined ? '—' : `${money.format(currentSnapshot.costPerSf)}/SF`}
              {currentSnapshot.slabCost === undefined ? '' : ` · ${money.format(currentSnapshot.slabCost)}/slab`}
            </small>
          </div>
          <button type="button" onClick={refreshSnapshot}>Update quote snapshot</button>
        </div>
      )}

      {!snapshot && selectedMaterial && currentReference && (
        <div className="quote-material-catalog-state is-legacy">
          <strong>Legacy material reference</strong>
          <button type="button" onClick={refreshSnapshot}>Capture current snapshot</button>
        </div>
      )}

      <button type="button" className="quote-material-change" onClick={() => { setSearch(''); setSearching(true); }}>Change</button>
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
