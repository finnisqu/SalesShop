import { useEffect, useMemo, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { useQuoteStore } from '../store/quoteStore';
import { resolveMaterialLevel } from '../types/materialLevelGuide';
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
    .sort((a, b) => (a.supplier ?? '').localeCompare(b.supplier ?? '') || a.materialType.localeCompare(b.materialType) || a.name.localeCompare(b.name)), [materials]);
  const material = availableMaterials.find((candidate) => candidate.id === materialId);
  const activeVariants = (material?.variants ?? []).filter((variant) => variant.active !== false);
  const variant = activeVariants.find((candidate) => candidate.id === variantId) ?? (material ? defaultMaterialVariant(material) : undefined);
  const activePurchaseOptions = (variant?.purchaseOptions ?? []).filter((option) => option.active !== false);
  const purchaseOption = activePurchaseOptions.find((candidate) => candidate.id === purchaseOptionId) ?? defaultMaterialPurchaseOption(variant);
  const reference = material ? resolveStockMaterialCostReference(material, variant?.id, purchaseOption?.id) : undefined;
  const resolved = material ? resolveMaterialLevel(guide.rules, reference?.costPerSf, material.builderLevelId) : undefined;
  const sf = numberValue(quantity);
  const lineTotal = sf !== undefined && resolved?.customerRate !== undefined ? sf * resolved.customerRate : undefined;

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
    if (!material || sf === undefined || resolved?.customerRate === undefined) return;
    const lineId = addLine(quote.id, 'item');
    const levelLabel = resolved.rule.label;
    const spec = variant ? [variant.thickness, variant.finish].filter(Boolean).join(' ') : '';
    const description = [material.name, spec, levelLabel, material.materialType].filter(Boolean).join(' · ');
    updateLine(quote.id, lineId, {
      description,
      pricingMode: 'quantity-rate',
      quantity: sf,
      rate: resolved.customerRate,
      amount: undefined,
      customerVisible: true,
      includeInTotal: true,
    });
    setQuantity('');
  };

  if (quote.documentType !== 'quote' || !availableMaterials.length) return null;

  return (
    <section className="quick-material-quote">
      <header>
        <div><span className="quote-control-heading">Quick material</span><small>Choose the actual material spec. SalesShop uses its supplier cost reference to find the standard builder level, then you can change the quote rate anytime.</small></div>
        {resolved && <span className="quick-material-level-chip">{resolved.rule.label}</span>}
      </header>
      <div className="quick-material-fields">
        <label className="quick-material-select"><span>Material</span><select value={materialId} onChange={(event) => chooseMaterial(event.target.value)}><option value="">Choose color…</option>{availableMaterials.map((item) => {
          const itemReference = resolveStockMaterialCostReference(item);
          const level = resolveMaterialLevel(guide.rules, itemReference.costPerSf, item.builderLevelId);
          const source = item.brand || item.supplier;
          return <option value={item.id} key={item.id}>{item.name}{level ? ` · ${level.rule.label}` : ''} · {item.materialType}{source ? ` · ${source}` : ''}</option>;
        })}</select></label>
        {material && activeVariants.length > 0 && <label className="quick-material-variant"><span>Spec</span><select value={variant?.id ?? ''} onChange={(event) => chooseVariant(event.target.value)}>{activeVariants.map((item) => <option value={item.id} key={item.id}>{variantLabel(item)}</option>)}</select></label>}
        {variant && activePurchaseOptions.length > 1 && <label className="quick-material-program"><span>Cost reference</span><select value={purchaseOption?.id ?? ''} onChange={(event) => setPurchaseOptionId(event.target.value)}>{activePurchaseOptions.map((item) => <option value={item.id} key={item.id}>{item.label}{item.minQuantity ? ` · ${item.minQuantity}+` : ''}</option>)}</select></label>}
        <label><span>Square feet</span><input type="number" inputMode="decimal" step="0.01" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="45" /></label>
        <div className="quick-material-rate">
          <span>Standard builder</span>
          <strong>{resolved?.customerRate === undefined ? '—' : `${money.format(resolved.customerRate)}/SF`}</strong>
          <small>{resolved ? `${resolved.basis} · final countertop rate` : 'This spec needs an SF cost or assigned fixed level'}</small>
        </div>
        <button type="button" disabled={!material || sf === undefined || resolved?.customerRate === undefined} onClick={addMaterialLine}>+ Add to quote{lineTotal === undefined ? '' : ` · ${money.format(lineTotal)}`}</button>
      </div>
      {material && <footer>
        <span>{materialLabel(material, variant, purchaseOption)}</span>
        <span>{reference?.costPerSf === undefined ? 'Material cost not set' : `${money.format(reference.costPerSf)}/SF effective material cost`}</span>
        {variant?.features?.length ? <span>{variant.features.join(' · ')}</span> : null}
        <span>Sinks and special add-ons remain separate.</span>
      </footer>}
    </section>
  );
}
