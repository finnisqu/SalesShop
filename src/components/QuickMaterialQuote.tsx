import { useEffect, useMemo, useState } from 'react';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { useMaterialLevelGuideStore } from '../store/materialLevelGuideStore';
import { useQuoteStore } from '../store/quoteStore';
import { resolveMaterialLevel } from '../types/materialLevelGuide';
import type { Quote } from '../types/quote';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function numberValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function QuickMaterialQuote({ quote }: { quote: Quote }) {
  const materials = useCompanySettingsStore((state) => state.settings.stockMaterials);
  const hydrateSettings = useCompanySettingsStore((state) => state.hydrate);
  const guide = useMaterialLevelGuideStore((state) => state.guide);
  const hydrateGuide = useMaterialLevelGuideStore((state) => state.hydrate);
  const addLine = useQuoteStore((state) => state.addLine);
  const updateLine = useQuoteStore((state) => state.updateLine);
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    void hydrateSettings();
    hydrateGuide();
  }, [hydrateSettings, hydrateGuide]);

  const availableMaterials = useMemo(() => materials
    .filter((material) => material.active && material.unit === 'sf')
    .sort((a, b) => a.materialType.localeCompare(b.materialType) || a.name.localeCompare(b.name)), [materials]);
  const material = availableMaterials.find((candidate) => candidate.id === materialId);
  const resolved = material ? resolveMaterialLevel(guide.rules, material.internalCost, material.builderLevelId) : undefined;
  const sf = numberValue(quantity);
  const lineTotal = sf !== undefined && resolved?.customerRate !== undefined ? sf * resolved.customerRate : undefined;

  const addMaterialLine = () => {
    if (!material || sf === undefined || resolved?.customerRate === undefined) return;
    const lineId = addLine(quote.id, 'item');
    const levelLabel = resolved.rule.label;
    const materialLabel = [material.name, levelLabel, material.materialType].filter(Boolean).join(' · ');
    updateLine(quote.id, lineId, {
      description: materialLabel,
      pricingMode: 'quantity-rate',
      quantity: sf,
      rate: resolved.customerRate,
      amount: undefined,
      customerVisible: true,
      includeInTotal: true,
    });
    setQuantity('');
  };

  if (!availableMaterials.length) return null;

  return (
    <section className="quick-material-quote">
      <header>
        <div><span className="quote-control-heading">Quick material</span><small>Start from the standard builder level guide, then change the quote rate anytime.</small></div>
        {resolved && <span className="quick-material-level-chip">{resolved.rule.label}</span>}
      </header>
      <div className="quick-material-fields">
        <label className="quick-material-select"><span>Material</span><select value={materialId} onChange={(event) => setMaterialId(event.target.value)}><option value="">Choose color…</option>{availableMaterials.map((item) => {
          const level = resolveMaterialLevel(guide.rules, item.internalCost, item.builderLevelId);
          return <option value={item.id} key={item.id}>{item.name}{level ? ` · ${level.rule.label}` : ''} · {item.materialType}</option>;
        })}</select></label>
        <label><span>Square feet</span><input type="number" inputMode="decimal" step="0.01" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="45" /></label>
        <div className="quick-material-rate">
          <span>Standard builder</span>
          <strong>{resolved?.customerRate === undefined ? '—' : `${money.format(resolved.customerRate)}/SF`}</strong>
          <small>{resolved ? `${resolved.basis} · final countertop rate` : 'Material needs an SF cost or assigned level'}</small>
        </div>
        <button type="button" disabled={!material || sf === undefined || resolved?.customerRate === undefined} onClick={addMaterialLine}>+ Add to quote{lineTotal === undefined ? '' : ` · ${money.format(lineTotal)}`}</button>
      </div>
      {material && <footer><span>{material.brand ? `${material.brand} · ` : ''}{money.format(material.internalCost ?? 0)}/SF material cost</span><span>Sinks and special add-ons remain separate.</span></footer>}
    </section>
  );
}
