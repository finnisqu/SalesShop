import {
  type Quote,
  type QuoteAreaScope,
  type QuoteAreaScopeField,
  type QuoteLine,
  type QuoteLineQuantitySource,
  type QuoteSection,
} from '../types/quote';

export const QUOTE_AREA_SCOPE_VISIBLE_FIELDS: QuoteAreaScopeField[] = [
  'countertopSf',
  'kitchenSinkCount',
  'vanitySinkCount',
];

export const QUOTE_AREA_SCOPE_META: Record<QuoteAreaScopeField, { label: string; shortLabel: string; unit: 'SF' | 'LF' | 'Each' }> = {
  countertopSf: { label: 'Countertop SF', shortLabel: 'Countertop', unit: 'SF' },
  splashLf: { label: '4" splash LF', shortLabel: 'Splash', unit: 'LF' },
  fullHeightSplashSf: { label: 'Full-height splash SF', shortLabel: 'Full-height', unit: 'SF' },
  kitchenSinkCount: { label: 'Kitchen sinks', shortLabel: 'Kitchen sinks', unit: 'Each' },
  vanitySinkCount: { label: 'Vanity sinks', shortLabel: 'Vanity sinks', unit: 'Each' },
  cutoutCount: { label: 'Cutouts', shortLabel: 'Cutouts', unit: 'Each' },
};

export function scopeValue(scope: QuoteAreaScope | undefined, field: QuoteAreaScopeField) {
  const value = scope?.[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function areaScopeSummary(section: QuoteSection) {
  const scope = section.scope;
  if (!scope) return '';
  const parts: string[] = [];
  if (scope.countertopSf !== undefined) parts.push(`${scope.countertopSf} SF`);
  const sinkTotal = (scope.kitchenSinkCount ?? 0) + (scope.vanitySinkCount ?? 0);
  if (sinkTotal) parts.push(`${sinkTotal} sink${sinkTotal === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function compatibleAreaScopeFields(line: QuoteLine): QuoteAreaScopeField[] {
  if (line.kind === 'material') return ['countertopSf'];
  if (line.kind === 'sink') {
    const category = line.sinkReference?.snapshot?.category;
    if (category === 'kitchen') return ['kitchenSinkCount'];
    if (category === 'vanity') return ['vanitySinkCount'];
    return ['kitchenSinkCount', 'vanitySinkCount'];
  }
  if (line.kind === 'rate') {
    const snapshot = line.rateReference?.snapshot;
    if (!snapshot) return QUOTE_AREA_SCOPE_VISIBLE_FIELDS.slice();
    if (snapshot.unit === 'sf') return ['countertopSf'];
    if (snapshot.unit === 'each') {
      const text = `${snapshot.name} ${snapshot.code ?? ''}`.toLowerCase();
      if (text.includes('cutout')) return [];
      if (text.includes('sink')) return ['kitchenSinkCount', 'vanitySinkCount'];
    }
    return [];
  }
  if (line.pricingMode === 'quantity-rate') return QUOTE_AREA_SCOPE_VISIBLE_FIELDS.slice();
  return [];
}

export function applyAreaScopeQuantity(
  section: QuoteSection,
  field: QuoteAreaScopeField,
  appliedAt = new Date().toISOString(),
): Pick<QuoteLine, 'quantity' | 'quantitySource'> | undefined {
  const value = scopeValue(section.scope, field);
  if (value === undefined) return undefined;
  const quantitySource: QuoteLineQuantitySource = {
    kind: 'area-scope',
    sectionId: section.id,
    field,
    capturedValue: value,
    appliedAt,
  };
  return { quantity: value, quantitySource };
}

export function resolveLineAreaScopeState(quote: Quote, line: QuoteLine) {
  const source = line.quantitySource;
  if (!source || source.kind !== 'area-scope') return undefined;
  const section = quote.sections.find((candidate) => candidate.id === source.sectionId);
  const currentValue = section ? scopeValue(section.scope, source.field) : undefined;
  return {
    section,
    currentValue,
    changed: currentValue === undefined || currentValue !== source.capturedValue,
  };
}
