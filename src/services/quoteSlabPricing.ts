export interface QuoteSlabMultiplierInput {
  slabCost?: number;
  multiplier?: number;
  slabCount?: number;
}

export interface QuoteSlabMultiplierResult {
  slabCost: number;
  multiplier: number;
  slabCount: number;
  customerPricePerSlab: number;
  customerTotal: number;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateQuoteSlabMultiplierPrice(
  input: QuoteSlabMultiplierInput,
): QuoteSlabMultiplierResult | undefined {
  const { slabCost, multiplier, slabCount } = input;
  if (slabCost === undefined || multiplier === undefined || slabCount === undefined) return undefined;
  if (!Number.isFinite(slabCost) || slabCost <= 0) return undefined;
  if (!Number.isFinite(multiplier) || multiplier <= 0) return undefined;
  if (!Number.isFinite(slabCount) || slabCount <= 0 || !Number.isInteger(slabCount)) return undefined;

  const customerPricePerSlab = roundCurrency(slabCost * multiplier);
  return {
    slabCost: roundCurrency(slabCost),
    multiplier,
    slabCount,
    customerPricePerSlab,
    customerTotal: roundCurrency(customerPricePerSlab * slabCount),
  };
}
