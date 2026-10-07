import { useEffect, useMemo, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { useQuoteStore } from '../store/quoteStore';
import {
  resolveMaterialPricingRecommendation,
  resolveSlabPrice,
} from '../types/materialLevelGuide';
import type { Quote } from '../types/quote';
import {
  defaultMaterialPurchaseOption,
  defaultMaterialVariant,
  resolveStockMaterialCostReference,
  type MaterialPurchaseOption,
  type MaterialVariant,
  type StockMaterial,
} from '../types/settings';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function numberValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function variantLabel(variant?: MaterialVariant) {
  if (!variant) return 'Default material cost';
  const size = variant.lengthIn && variant.widthIn ? `${variant.lengthIn}×${variant.widthIn}` : variant.formatName;
  return [variant.thickness, variant.finish, size].filter(Boolean).join(' · ') || 'Standard variant';
}

function materialLabel(material: StockMaterial, variant?: MaterialVariant, option?: MaterialPurchaseOption) {
  const source = [material.supplier, material.brand].filter(Boolean).join(' / ');
  return [source, material.name, variantLabel(variant), option?.label].filter(Boolean).join(' · ');
}

export function QuickMaterialQuote({ quote }: { quote: Quote }) {
  const materials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const guide = useMaterialLevelGuideStore((state) => state.guide);
  const hydrateGuide = useMaterialLevelGuideStore((state) => state.hydrate);
  const addLine = useQuoteStore((state) => state.addLine);
  const updateLine = useQuoteStore((state) => state.updateLine);
  const [materialId, setMaterialId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [purchaseOptionId, setPurchaseOptionId] = useState('');
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    void hydrateSettings();
    hydrateGuide();
  }, [hydrateSettings, hydrateGuide]);

  const availableMaterials = useMemo(() => materials
    .filter((material) => material.active)
    .sort((a, b) => Number(b.stockProgram) - Number(a.stockProgram) || (a.supplier ?? '').localeCompare(b.supplier ?? '') || a.materialType.localeCompare(b.materialType) || a.name.localeCompare(b.name)), [materials]);

  const material = availableMaterials.find((candidate) => candidate.id === materialId);
  const activeVariants = (material?.variants ?? []).filter((variant) => variant.active !== false);
  const variant = activeVariants.find((candidate) => candidate.id === variantId) ?? (material ? defaultMaterialVariant(material) : undefined);
  const activePurchaseOptions = (variant?.purchaseOptions ?? []).filter((option) => option.active !== false);
  const purchaseOption = activePurchaseOptions.find((candidate) => candidate.id === purchaseOptionId) ?? defaultMaterialPurchaseOption(variant);
  const reference = material ? resolveStockMaterialCostReference(material, variant?.id, purchaseOption?.id) : undefined;

  const recommendation = material
    ? resolveMaterialPricingRecommendation(
        guide,
        reference?.costPerSf,
        material.stockProgram ? material.builderLevelId : undefined,
      )
    : undefined;
  const level = recommendation?.mode === 'level' ? recommendation.level : undefined;
  const slabMode = recommendation?.mode === 'slab-review';

  const rawQuantity = numberValue(quantity);
  const sf = !slabMode && rawQuantity !== undefined && rawQuantity > 0 ? rawQuantity : undefined;
  const slabCount = slabMode && rawQuantity !== undefined && rawQuantity > 0 && Number.isInteger(rawQuantity)
    ? rawQuantity
    : undefined;
  const slabPricing = slabMode
    ? resolveSlabPrice(guide, reference?.costPerSf, reference?.slabCost, slabCount)
    : undefined;

  const quoteRate = level?.customerRate;
  const lineTotal = slabMode
    ? slabPricing?.customerTotal
    : sf !== undefined && quoteRate !== undefined
      ? sf * quoteRate
      : undefined;

  const chooseMaterial = (id: string) => {
    setMaterialId(id);
    setVariantId('');
    setPurchaseOptionId('');
    setQuantity('');
  };

  const chooseVariant = (id: string) => {
    setVariantId(id);
    setPurchaseOptionId('');
    setQuantity('');
  };

  const addMaterialLine = () => {
    if (!material) return;
    const spec = variant ? [variant.thickness, variant.finish].filter(Boolean).join(' ') : '';

    if (slabMode) {
      if (!slabPricing?.eligible || slabPricing.customerTotal === undefined || slabPricing.customerPricePerSlab === undefined || slabCount === undefined) return;
      const lineId = addLine(quote.id, 'item');
      updateLine(quote.id, lineId, {
        description: [material.name, spec, material.materialType].filter(Boolean).join(' · '),
        pricingMode: 'direct',
        quantity: undefined,
        rate: undefined,
        amount: slabPricing.customerTotal,
        customerVisible: true,
        includeInTotal: true,
        materialReference: {
          materialId: material.id,
          variantId: variant?.id,
          purchaseOptionId: purchaseOption?.id,
          stockProgram: material.stockProgram,
          pricingSource: 'slab-multiplier',
          sourceCostPerSf: reference?.costPerSf,
          sourceSlabCost: reference?.slabCost,
          slabMultiplier: guide.slabPricingMultiplier,
          slabCount,
          customerPricePerSlab: slabPricing.customerPricePerSlab,
        },
      });
      setQuantity('');
      return;
    }

    if (!level || sf === undefined) return;
    const lineId = addLine(quote.id, 'item');
    const description = material.stockProgram
      ? [material.name, spec, level.rule.label, material.materialType].filter(Boolean).join(' · ')
      : [material.name, spec, material.materialType].filter(Boolean).join(' · ');
    updateLine(quote.id, lineId, {
      description,
      pricingMode: 'quantity-rate',
      quantity: sf,
      rate: level.customerRate,
      amount: undefined,
      customerVisible: true,
      includeInTotal: true,
      materialReference: {
        materialId: material.id,
        variantId: variant?.id,
        purchaseOptionId: purchaseOption?.id,
        stockProgram: material.stockProgram,
        pricingSource: material.stockProgram ? 'stock-level' : 'suggested-level',
        sourceCostPerSf: reference?.costPerSf,
        guideRate: level.customerRate,
        stockEquivalentLevel: level.rule.label,
      },
    });
    setQuantity('');
  };

  if (quote.documentType !== 'quote' || !availableMaterials.length) return null;

  return (
    <section className="quick-material-quote">
      <header>
        <div>
          <span className="quote-control-heading">Quick material</span>
          <small>SalesShop suggests the standard Level from material cost. Above the Level guide, pricing switches to actual slabs purchased × the slab multiplier—never $/SF × 2.2.</small>
        </div>
        {material && (
          <span className={`quick-material-level-chip ${slabMode ? 'is-slab-review' : material.stockProgram ? 'is-stock' : 'is-non-stock'}`}>
            {slabMode
              ? 'SLAB REVIEW'
              : level
                ? material.stockProgram ? level.rule.label : `SUGGEST ${level.rule.label}`
                : material.stockProgram ? 'STOCK' : 'NON-STOCK'}
          </span>
        )}
      </header>

      <div className="quick-material-fields">
        <label className="quick-material-select">
          <span>Material</span>
          <select value={materialId} onChange={(event) => chooseMaterial(event.target.value)}>
            <option value="">Choose color…</option>
            {availableMaterials.map((item) => {
              const itemReference = resolveStockMaterialCostReference(item);
              const itemRecommendation = resolveMaterialPricingRecommendation(
                guide,
                itemReference.costPerSf,
                item.stockProgram ? item.builderLevelId : undefined,
              );
              const source = item.brand || item.supplier;
              const priceHint = itemRecommendation.mode === 'level'
                ? `${item.stockProgram ? 'STOCK' : 'NON-STOCK'} · ${item.stockProgram ? itemRecommendation.level.rule.label : `Suggest ${itemRecommendation.level.rule.label}`}`
                : itemRecommendation.mode === 'slab-review'
                  ? 'SLAB PRICING REVIEW'
                  : item.stockProgram ? 'STOCK · needs cost' : 'NON-STOCK · needs cost';
              return <option value={item.id} key={item.id}>{item.name} · {priceHint} · {item.materialType}{source ? ` · ${source}` : ''}</option>;
            })}
          </select>
        </label>

        {material && activeVariants.length > 0 && (
          <label className="quick-material-variant">
            <span>Spec</span>
            <select value={variant?.id ?? ''} onChange={(event) => chooseVariant(event.target.value)}>
              {activeVariants.map((item) => <option value={item.id} key={item.id}>{variantLabel(item)}</option>)}
            </select>
          </label>
        )}

        {variant && activePurchaseOptions.length > 1 && (
          <label className="quick-material-program">
            <span>Cost reference</span>
            <select value={purchaseOption?.id ?? ''} onChange={(event) => { setPurchaseOptionId(event.target.value); setQuantity(''); }}>
              {activePurchaseOptions.map((item) => <option value={item.id} key={item.id}>{item.label}{item.minQuantity ? ` · ${item.minQuantity}+` : ''}</option>)}
            </select>
          </label>
        )}

        <label>
          <span>{slabMode ? 'Slabs required' : 'Square feet'}</span>
          <input
            type="number"
            inputMode={slabMode ? 'numeric' : 'decimal'}
            step={slabMode ? '1' : '0.01'}
            min={slabMode ? '1' : '0'}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder={slabMode ? '1' : '45'}
          />
        </label>

        <div className={`quick-material-rate ${slabMode ? 'is-slab-review' : material && !material.stockProgram ? 'is-non-stock' : ''}`}>
          <span>{slabMode ? 'Slab-based quick math' : material?.stockProgram ? 'Standard builder' : 'Suggested Level'}</span>
          <strong>
            {slabMode
              ? slabPricing?.customerPricePerSlab === undefined ? '—' : `${money.format(slabPricing.customerPricePerSlab)}/slab`
              : quoteRate === undefined ? '—' : `${money.format(quoteRate)}/SF`}
          </strong>
          <small>
            {slabMode
              ? slabPricing?.customerPricePerSlab !== undefined
                ? `${money.format(reference?.slabCost ?? 0)} actual slab cost × ${guide.slabPricingMultiplier}; finished SF does not change the price while slab count stays the same`
                : 'Above the standard Level range · choose a full-slab cost reference with an actual slab cost'
              : level
                ? `${level.rule.label} suggested from ${reference?.costPerSf === undefined ? 'material cost' : `${money.format(reference.costPerSf)}/SF effective material cost`} · final countertop rate`
                : recommendation?.basis ?? 'Needs material cost'}
          </small>
        </div>

        <button
          type="button"
          disabled={!material || lineTotal === undefined}
          onClick={addMaterialLine}
        >
          + Add to quote{lineTotal === undefined ? '' : ` · ${money.format(lineTotal)}`}
        </button>
      </div>

      {material && (
        <footer>
          <span className={`quick-material-program-status ${slabMode ? 'is-slab-review' : material.stockProgram ? 'is-stock' : 'is-non-stock'}`}>
            {slabMode ? 'SLAB PRICING REVIEW' : material.stockProgram ? 'STOCK PROGRAM' : 'NON-STOCK MATERIAL'}
          </span>
          <span>{materialLabel(material, variant, purchaseOption)}</span>
          <span>{reference?.costPerSf === undefined ? 'Material cost not set' : `${money.format(reference.costPerSf)}/SF effective material cost`}</span>
          {slabMode && <span>{reference?.slabCost === undefined ? 'Full slab cost not available' : `${money.format(reference.slabCost)} actual slab purchase cost`}</span>}
          {variant?.features?.length ? <span>{variant.features.join(' · ')}</span> : null}
          <span>Sinks and special add-ons remain separate.</span>
        </footer>
      )}
    </section>
  );
}
