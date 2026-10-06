import { useEffect, useMemo, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { useQuoteStore } from '../store/quoteStore';
import { resolveMaterialLevel, resolveNonStockMaterialPrice } from '../types/materialLevelGuide';
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
  const stockEquivalent = material ? resolveMaterialLevel(guide.rules, reference?.costPerSf, material.stockProgram ? material.builderLevelId : undefined) : undefined;
  const nonStockGuide = material ? resolveNonStockMaterialPrice(guide, reference?.costPerSf) : undefined;
  const quoteRate = material?.stockProgram
    ? stockEquivalent?.customerRate
    : stockEquivalent?.customerRate ?? nonStockGuide?.customerRate;
  const pricingSource = material?.stockProgram
    ? 'stock-level' as const
    : stockEquivalent?.customerRate !== undefined
      ? 'non-stock-stock-equivalent' as const
      : 'non-stock-guide' as const;
  const sf = numberValue(quantity);
  const lineTotal = sf !== undefined && quoteRate !== undefined ? sf * quoteRate : undefined;

  const chooseMaterial = (id: string) => {
    setMaterialId(id);
    setVariantId('');
    setPurchaseOptionId('');
  };

  const chooseVariant = (id: string) => {
    setVariantId(id);
    setPurchaseOptionId('');
  };

  const addMaterialLine = () => {
    if (!material || sf === undefined || quoteRate === undefined) return;
    const lineId = addLine(quote.id, 'item');
    const spec = variant ? [variant.thickness, variant.finish].filter(Boolean).join(' ') : '';
    const description = material.stockProgram
      ? [material.name, spec, stockEquivalent?.rule.label, material.materialType].filter(Boolean).join(' · ')
      : [material.name, spec, material.materialType].filter(Boolean).join(' · ');
    updateLine(quote.id, lineId, {
      description,
      pricingMode: 'quantity-rate',
      quantity: sf,
      rate: quoteRate,
      amount: undefined,
      customerVisible: true,
      includeInTotal: true,
      materialReference: {
        materialId: material.id,
        variantId: variant?.id,
        purchaseOptionId: purchaseOption?.id,
        stockProgram: material.stockProgram,
        pricingSource,
        sourceCostPerSf: reference?.costPerSf,
        guideRate: nonStockGuide?.customerRate,
        stockEquivalentLevel: stockEquivalent?.rule.label,
      },
    });
    setQuantity('');
  };

  if (quote.documentType !== 'quote' || !availableMaterials.length) return null;

  return (
    <section className="quick-material-quote">
      <header>
        <div><span className="quote-control-heading">Quick material</span><small>STOCK colors use the Level guide. Non-stock colors are clearly flagged; Quick Quote still assumes the stock-equivalent Level price for speed while showing the normal non-stock formula reference.</small></div>
        {material && <span className={`quick-material-level-chip ${material.stockProgram ? 'is-stock' : 'is-non-stock'}`}>{material.stockProgram ? stockEquivalent?.rule.label ?? 'STOCK' : 'NON-STOCK'}</span>}
      </header>
      <div className="quick-material-fields">
        <label className="quick-material-select"><span>Material</span><select value={materialId} onChange={(event) => chooseMaterial(event.target.value)}><option value="">Choose color…</option>{availableMaterials.map((item) => {
          const itemReference = resolveStockMaterialCostReference(item);
          const level = resolveMaterialLevel(guide.rules, itemReference.costPerSf, item.stockProgram ? item.builderLevelId : undefined);
          const source = item.brand || item.supplier;
          return <option value={item.id} key={item.id}>{item.name} · {item.stockProgram ? `STOCK${level ? ` · ${level.rule.label}` : ''}` : 'NON-STOCK'} · {item.materialType}{source ? ` · ${source}` : ''}</option>;
        })}</select></label>
        {material && activeVariants.length > 0 && <label className="quick-material-variant"><span>Spec</span><select value={variant?.id ?? ''} onChange={(event) => chooseVariant(event.target.value)}>{activeVariants.map((item) => <option value={item.id} key={item.id}>{variantLabel(item)}</option>)}</select></label>}
        {variant && activePurchaseOptions.length > 1 && <label className="quick-material-program"><span>Cost reference</span><select value={purchaseOption?.id ?? ''} onChange={(event) => setPurchaseOptionId(event.target.value)}>{activePurchaseOptions.map((item) => <option value={item.id} key={item.id}>{item.label}{item.minQuantity ? ` · ${item.minQuantity}+` : ''}</option>)}</select></label>}
        <label><span>Square feet</span><input type="number" inputMode="decimal" step="0.01" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="45" /></label>
        <div className={`quick-material-rate ${material && !material.stockProgram ? 'is-non-stock' : ''}`}>
          <span>{material?.stockProgram === false ? 'Quick quote assumption' : 'Standard builder'}</span>
          <strong>{quoteRate === undefined ? '—' : `${money.format(quoteRate)}/SF`}</strong>
          <small>{material?.stockProgram === false
            ? stockEquivalent?.customerRate !== undefined
              ? `Assumes ${stockEquivalent.rule.label} STOCK-program price · normal non-stock guide ${nonStockGuide?.customerRate === undefined ? '—' : `${money.format(nonStockGuide.customerRate)}/SF`} (${nonStockGuide?.basis ?? 'not set'})`
              : `No stock-equivalent Level available · using non-stock guide ${nonStockGuide?.basis ?? 'not set'}`
            : stockEquivalent ? `${stockEquivalent.basis} · final countertop rate` : 'This STOCK spec needs an SF cost or assigned Level'}</small>
        </div>
        <button type="button" disabled={!material || sf === undefined || quoteRate === undefined} onClick={addMaterialLine}>+ Add to quote{lineTotal === undefined ? '' : ` · ${money.format(lineTotal)}`}</button>
      </div>
      {material && <footer>
        <span className={material.stockProgram ? 'quick-material-program-status is-stock' : 'quick-material-program-status is-non-stock'}>{material.stockProgram ? 'STOCK PROGRAM' : 'NON-STOCK MATERIAL'}</span>
        <span>{materialLabel(material, variant, purchaseOption)}</span>
        <span>{reference?.costPerSf === undefined ? 'Material cost not set' : `${money.format(reference.costPerSf)}/SF effective material cost`}</span>
        {variant?.features?.length ? <span>{variant.features.join(' · ')}</span> : null}
        <span>Sinks and special add-ons remain separate.</span>
      </footer>}
    </section>
  );
}
