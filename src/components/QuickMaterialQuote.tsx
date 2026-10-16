import { useEffect, useMemo, useState } from 'react';
import { calculateQuoteSlabMultiplierPrice } from '../services/quoteSlabPricing';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { useQuoteStore } from '../store/quoteStore';
import { resolveMaterialPricingRecommendation } from '../types/materialLevelGuide';
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
const CUSTOM_MATERIAL_ID = '__custom_material__';
type QuickMaterialPricingMode = 'level' | 'slab';

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

function costsDiffer(first?: number, second?: number) {
  if (first === undefined || second === undefined) return false;
  return Math.abs(first - second) > 0.005;
}

export function QuickMaterialQuote({ quote }: { quote: Quote }) {
  const materials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const guide = useMaterialLevelGuideStore((state) => state.guide);
  const hydrateGuide = useMaterialLevelGuideStore((state) => state.hydrate);
  const addLine = useQuoteStore((state) => state.addLine);
  const updateLine = useQuoteStore((state) => state.updateLine);

  const [pricingMode, setPricingMode] = useState<QuickMaterialPricingMode>('level');
  const [materialId, setMaterialId] = useState('');
  const [customMaterialName, setCustomMaterialName] = useState('');
  const [variantId, setVariantId] = useState('');
  const [purchaseOptionId, setPurchaseOptionId] = useState('');
  const [squareFeet, setSquareFeet] = useState('');
  const [slabCostInput, setSlabCostInput] = useState('');
  const [slabMultiplierInput, setSlabMultiplierInput] = useState(String(guide.slabPricingMultiplier));
  const [slabCountInput, setSlabCountInput] = useState('');

  useEffect(() => {
    void hydrateSettings();
    hydrateGuide();
  }, [hydrateSettings, hydrateGuide]);

  const availableMaterials = useMemo(() => materials
    .filter((material) => material.active)
    .sort((a, b) => Number(b.stockProgram) - Number(a.stockProgram) || (a.supplier ?? '').localeCompare(b.supplier ?? '') || a.materialType.localeCompare(b.materialType) || a.name.localeCompare(b.name)), [materials]);

  const customMaterial = materialId === CUSTOM_MATERIAL_ID;
  const material = customMaterial ? undefined : availableMaterials.find((candidate) => candidate.id === materialId);
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

  const sf = numberValue(squareFeet);
  const levelLineTotal = sf !== undefined && sf > 0 && level
    ? Math.round((sf * level.customerRate + Number.EPSILON) * 100) / 100
    : undefined;

  const slabCost = numberValue(slabCostInput);
  const slabMultiplier = numberValue(slabMultiplierInput);
  const slabCountRaw = numberValue(slabCountInput);
  const slabCount = slabCountRaw !== undefined && Number.isInteger(slabCountRaw) ? slabCountRaw : undefined;
  const slabPricing = calculateQuoteSlabMultiplierPrice({
    slabCost,
    multiplier: slabMultiplier,
    slabCount,
  });
  const slabCostOverridden = Boolean(material && reference?.slabCost !== undefined && costsDiffer(slabCost, reference.slabCost));

  useEffect(() => {
    if (pricingMode !== 'slab') return;
    if (customMaterial) {
      setSlabCostInput('');
      return;
    }
    setSlabCostInput(reference?.slabCost === undefined ? '' : reference.slabCost.toFixed(2));
  }, [pricingMode, customMaterial, materialId, variant?.id, purchaseOption?.id, reference?.slabCost]);

  const choosePricingMode = (mode: QuickMaterialPricingMode) => {
    setPricingMode(mode);
    setSquareFeet('');
    setSlabCountInput('');
    if (mode === 'slab') {
      setSlabMultiplierInput(String(guide.slabPricingMultiplier));
      setSlabCostInput(customMaterial ? '' : reference?.slabCost === undefined ? '' : reference.slabCost.toFixed(2));
    }
  };

  const chooseMaterial = (id: string) => {
    setMaterialId(id);
    setCustomMaterialName('');
    setVariantId('');
    setPurchaseOptionId('');
    setSquareFeet('');
    setSlabCountInput('');
    if (id === CUSTOM_MATERIAL_ID) setSlabCostInput('');
  };

  const chooseVariant = (id: string) => {
    setVariantId(id);
    setPurchaseOptionId('');
    setSquareFeet('');
    setSlabCountInput('');
  };

  const addMaterialLine = () => {
    if (pricingMode === 'slab') {
      const materialName = customMaterial ? customMaterialName.trim() : material?.name;
      if (!materialName || !slabPricing) return;
      const spec = variant ? [variant.thickness, variant.finish].filter(Boolean).join(' ') : '';
      const lineId = addLine(quote.id, 'item');
      updateLine(quote.id, lineId, {
        description: [materialName, spec, material?.materialType].filter(Boolean).join(' · '),
        pricingMode: 'direct',
        quantity: undefined,
        rate: undefined,
        amount: slabPricing.customerTotal,
        customerVisible: true,
        includeInTotal: true,
        materialReference: {
          materialId: material?.id,
          customMaterialName: customMaterial ? materialName : undefined,
          variantId: variant?.id,
          purchaseOptionId: purchaseOption?.id,
          stockProgram: material?.stockProgram ?? false,
          pricingSource: 'slab-multiplier',
          sourceCostPerSf: reference?.costPerSf,
          sourceSlabCost: slabPricing.slabCost,
          catalogSlabCost: reference?.slabCost,
          slabCostOverride: slabCostOverridden || customMaterial || reference?.slabCost === undefined,
          slabMultiplier: slabPricing.multiplier,
          slabCount: slabPricing.slabCount,
          customerPricePerSlab: slabPricing.customerPricePerSlab,
        },
      });
      setSlabCountInput('');
      return;
    }

    if (!material || !level || sf === undefined || sf <= 0) return;
    const lineId = addLine(quote.id, 'item');
    const spec = variant ? [variant.thickness, variant.finish].filter(Boolean).join(' ') : '';
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
    setSquareFeet('');
  };

  if (quote.documentType !== 'quote') return null;

  const slabModeMessage = customMaterial
    ? 'Custom material is quote-only. Enter the actual slab purchase price; this does not add or change a supplier-catalog record.'
    : !material
      ? 'Choose a material from the database or select Custom material.'
      : reference?.slabCost === undefined
        ? 'No full-slab cost is stored for this selected cost reference. Enter the actual slab purchase price manually.'
        : slabCostOverridden
          ? `Catalog slab cost is ${money.format(reference.slabCost)}. Your manual slab-cost override applies only to this quote.`
          : recommendation?.mode === 'level'
            ? `SalesShop would normally suggest ${recommendation.level.rule.label} for this material. Slab / multiplier is a manual salesperson pricing choice.`
            : 'Catalog slab cost loaded. Adjust it for this quote if the actual purchase price is different.';

  return (
    <section className="quick-material-quote">
      <header className="quick-material-header">
        <div>
          <span className="quote-control-heading">Quick material</span>
          <small>Choose the pricing method for this quote. Level pricing uses the standard builder guide; slab / multiplier prices actual slabs purchased.</small>
        </div>
        <div className="quick-material-pricing-modes" role="group" aria-label="Material pricing method">
          <button type="button" className={pricingMode === 'level' ? 'active' : ''} onClick={() => choosePricingMode('level')}>Level pricing</button>
          <button type="button" className={pricingMode === 'slab' ? 'active' : ''} onClick={() => choosePricingMode('slab')}>Slab / multiplier</button>
        </div>
      </header>

      {pricingMode === 'level' ? (
        <div className="quick-material-fields quick-material-level-fields">
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
                  ? item.stockProgram
                    ? `STOCK · ${itemRecommendation.level.rule.label}`
                    : `Suggest ${itemRecommendation.level.rule.label}`
                  : itemRecommendation.mode === 'slab-review'
                    ? 'Slab pricing recommended'
                    : 'Needs cost';
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
              <select value={purchaseOption?.id ?? ''} onChange={(event) => { setPurchaseOptionId(event.target.value); setSquareFeet(''); }}>
                {activePurchaseOptions.map((item) => <option value={item.id} key={item.id}>{item.label}{item.minQuantity ? ` · ${item.minQuantity}+` : ''}</option>)}
              </select>
            </label>
          )}

          <label>
            <span>Square feet</span>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={squareFeet} onChange={(event) => setSquareFeet(event.target.value)} placeholder="45" />
          </label>

          <div className={`quick-material-rate ${material && !material.stockProgram ? 'is-non-stock' : ''}`}>
            <span>{material?.stockProgram ? 'Standard builder' : 'Suggested Level'}</span>
            <strong>{level ? `${money.format(level.customerRate)}/SF` : '—'}</strong>
            <small>{level
              ? `${level.rule.label} from ${reference?.costPerSf === undefined ? 'material cost' : `${money.format(reference.costPerSf)}/SF effective cost`}`
              : recommendation?.mode === 'slab-review'
                ? 'Above the standard Level range · use Slab / multiplier or assign a Level deliberately'
                : recommendation?.basis ?? 'Choose a material'}</small>
          </div>

          <button type="button" disabled={!material || levelLineTotal === undefined} onClick={addMaterialLine}>
            + Add to quote{levelLineTotal === undefined ? '' : ` · ${money.format(levelLineTotal)}`}
          </button>
        </div>
      ) : (
        <>
          <div className="quick-material-fields quick-material-slab-fields">
            <label className="quick-material-select quick-material-slab-material">
              <span>Material</span>
              <select value={materialId} onChange={(event) => chooseMaterial(event.target.value)}>
                <option value="">Choose material…</option>
                {availableMaterials.map((item) => {
                  const source = item.brand || item.supplier;
                  return <option value={item.id} key={item.id}>{item.name} · {item.materialType}{source ? ` · ${source}` : ''}</option>;
                })}
                <option value={CUSTOM_MATERIAL_ID}>+ Custom material…</option>
              </select>
            </label>

            {customMaterial && (
              <label className="quick-material-custom-name">
                <span>Custom material name</span>
                <input value={customMaterialName} onChange={(event) => setCustomMaterialName(event.target.value)} placeholder="Material / color" autoFocus />
              </label>
            )}

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
                <select value={purchaseOption?.id ?? ''} onChange={(event) => { setPurchaseOptionId(event.target.value); setSlabCountInput(''); }}>
                  {activePurchaseOptions.map((item) => <option value={item.id} key={item.id}>{item.label}{item.minQuantity ? ` · ${item.minQuantity}+` : ''}</option>)}
                </select>
              </label>
            )}

            <label>
              <span>Slab price</span>
              <div className="quick-material-money-input"><b>$</b><input type="number" inputMode="decimal" min="0" step="0.01" value={slabCostInput} onChange={(event) => setSlabCostInput(event.target.value)} placeholder="1500.00" /></div>
            </label>

            <label>
              <span>Multiplier</span>
              <div className="quick-material-multiplier-input"><input type="number" inputMode="decimal" min="0.01" step="0.01" value={slabMultiplierInput} onChange={(event) => setSlabMultiplierInput(event.target.value)} /><b>×</b></div>
            </label>

            <label>
              <span>Slabs</span>
              <input type="number" inputMode="numeric" min="1" step="1" value={slabCountInput} onChange={(event) => setSlabCountInput(event.target.value)} placeholder="1" />
            </label>

            <div className="quick-material-rate is-slab-review quick-material-slab-result">
              <span>Material price</span>
              <strong>{slabPricing ? money.format(slabPricing.customerTotal) : '—'}</strong>
              <small>{slabPricing
                ? `${money.format(slabPricing.slabCost)} × ${slabPricing.multiplier} × ${slabPricing.slabCount} slab${slabPricing.slabCount === 1 ? '' : 's'} · ${money.format(slabPricing.customerPricePerSlab)}/slab`
                : 'Slab price × multiplier × whole slabs required'}</small>
            </div>

            <button
              type="button"
              disabled={!(customMaterial ? customMaterialName.trim() : material) || !slabPricing}
              onClick={addMaterialLine}
            >
              + Add to quote{slabPricing ? ` · ${money.format(slabPricing.customerTotal)}` : ''}
            </button>
          </div>
          <div className="quick-material-slab-note">{slabModeMessage}</div>
        </>
      )}

      {(material || customMaterial) && (
        <footer>
          <span className={`quick-material-program-status ${pricingMode === 'slab' ? 'is-slab-review' : material?.stockProgram ? 'is-stock' : 'is-non-stock'}`}>
            {pricingMode === 'slab' ? 'SLAB / MULTIPLIER' : material?.stockProgram ? 'STOCK PROGRAM' : 'NON-STOCK MATERIAL'}
          </span>
          {material && <span>{materialLabel(material, variant, purchaseOption)}</span>}
          {customMaterial && customMaterialName.trim() && <span>{customMaterialName.trim()} · custom quote material</span>}
          {material && <span>{reference?.costPerSf === undefined ? 'Effective material cost not set' : `${money.format(reference.costPerSf)}/SF effective material cost`}</span>}
          {pricingMode === 'slab' && material && <span>{reference?.slabCost === undefined ? 'No catalog full-slab price' : `${money.format(reference.slabCost)} catalog slab price`}</span>}
          {variant?.features?.length ? <span>{variant.features.join(' · ')}</span> : null}
          <span>Sinks and special add-ons remain separate.</span>
        </footer>
      )}
    </section>
  );
}
