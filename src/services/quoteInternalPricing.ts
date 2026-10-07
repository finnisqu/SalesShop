import { quoteLineTotal, roundCurrency, type QuoteLine } from '../types/quote';

export interface QuoteInternalPricingLineSummary {
  lineId: string;
  customerAmount: number;
  internalCost?: number;
  costSource?: 'manual-total' | 'material-sf' | 'material-slab' | 'sink-unit' | 'rate-unit' | 'rate-flat';
  requiresCost: boolean;
}

export interface QuoteInternalPricingSummary {
  customerTotal: number;
  knownInternalCost: number;
  grossSpread: number;
  marginPercent?: number;
  costedLineCount: number;
  costRequiredLineCount: number;
  complete: boolean;
  lines: QuoteInternalPricingLineSummary[];
}

function validNumber(value: number | undefined) {
  return value !== undefined && Number.isFinite(value);
}

function materialInternalCost(line: QuoteLine) {
  const reference = line.materialReference;
  if (!reference) return undefined;

  const slabCost = reference.sourceSlabCost
    ?? reference.snapshot?.slabCost
    ?? reference.catalogSlabCost;
  if (validNumber(slabCost) && validNumber(reference.slabCount)) {
    return {
      value: roundCurrency((slabCost ?? 0) * (reference.slabCount ?? 0)),
      source: 'material-slab' as const,
    };
  }

  const costPerSf = reference.snapshot?.costPerSf ?? reference.sourceCostPerSf;
  if (validNumber(costPerSf) && validNumber(line.quantity)) {
    return {
      value: roundCurrency((costPerSf ?? 0) * (line.quantity ?? 0)),
      source: 'material-sf' as const,
    };
  }

  return undefined;
}

function sinkInternalCost(line: QuoteLine) {
  const snapshot = line.sinkReference?.snapshot;
  if (!snapshot || !validNumber(snapshot.internalCost)) return undefined;
  const quantity = validNumber(line.quantity) ? line.quantity ?? 0 : 1;
  return {
    value: roundCurrency((snapshot.internalCost ?? 0) * quantity),
    source: 'sink-unit' as const,
  };
}

function rateInternalCost(line: QuoteLine) {
  const snapshot = line.rateReference?.snapshot;
  if (!snapshot || !validNumber(snapshot.internalCost)) return undefined;

  if (snapshot.unit === 'flat') {
    return {
      value: roundCurrency(snapshot.internalCost ?? 0),
      source: 'rate-flat' as const,
    };
  }

  if (validNumber(line.quantity)) {
    return {
      value: roundCurrency((snapshot.internalCost ?? 0) * (line.quantity ?? 0)),
      source: 'rate-unit' as const,
    };
  }

  return undefined;
}

function internalCostForLine(line: QuoteLine) {
  if (line.kind === 'item' && validNumber(line.internalCost)) {
    return {
      value: roundCurrency(line.internalCost ?? 0),
      source: 'manual-total' as const,
    };
  }
  if (line.kind === 'material') return materialInternalCost(line);
  if (line.kind === 'sink') return sinkInternalCost(line);
  if (line.kind === 'rate') return rateInternalCost(line);
  return undefined;
}

function lineRequiresCost(line: QuoteLine, customerAmount: number) {
  if (line.kind === 'material' || line.kind === 'sink' || line.kind === 'rate') return true;
  if (customerAmount <= 0) return false;
  return !['tax', 'discount', 'allowance'].includes(line.kind);
}

export function summarizeQuoteInternalPricing(lines: QuoteLine[]): QuoteInternalPricingSummary {
  const lineSummaries = lines.map((line) => {
    const customerAmount = quoteLineTotal(line);
    const internalCost = internalCostForLine(line);
    return {
      lineId: line.id,
      customerAmount,
      internalCost: internalCost?.value,
      costSource: internalCost?.source,
      requiresCost: lineRequiresCost(line, customerAmount),
    };
  });

  const customerTotal = roundCurrency(lineSummaries.reduce((sum, line) => sum + line.customerAmount, 0));
  const knownInternalCost = roundCurrency(lineSummaries.reduce((sum, line) => sum + (line.internalCost ?? 0), 0));
  const grossSpread = roundCurrency(customerTotal - knownInternalCost);
  const costRequiredLineCount = lineSummaries.filter((line) => line.requiresCost).length;
  const costedLineCount = lineSummaries.filter((line) => line.requiresCost && line.internalCost !== undefined).length;
  const complete = costRequiredLineCount > 0 && costedLineCount === costRequiredLineCount;
  const marginPercent = complete && customerTotal > 0
    ? Math.round(((grossSpread / customerTotal) * 100 + Number.EPSILON) * 10) / 10
    : undefined;

  return {
    customerTotal,
    knownInternalCost,
    grossSpread,
    marginPercent,
    costedLineCount,
    costRequiredLineCount,
    complete,
    lines: lineSummaries,
  };
}
