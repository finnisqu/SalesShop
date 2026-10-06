import type {
  PricingBuilderProductType,
  PricingOptionPackage,
  PricingOptionRule,
  PricingPlan,
  PricingPlanTakeoff,
  PricingRateItem,
  PricingScheduleBuilderData,
  PricingScheduleItem,
} from '../types/quote';

export interface PricingCalculationLine {
  id: string;
  label: string;
  room: string;
  productType: PricingBuilderProductType;
  productName?: string;
  quantity: number;
  unit: string;
  rate?: number;
  amount?: number;
  warning?: string;
}

export interface PricingPlanOptionCalculation {
  plan: PricingPlan;
  option: PricingOptionPackage;
  lines: PricingCalculationLine[];
  total?: number;
  warnings: string[];
}

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export function createPricingScheduleBuilderData(): PricingScheduleBuilderData {
  return {
    rateBookName: 'Working rate book',
    rates: [],
    options: [],
    plans: [],
    takeoffs: [],
  };
}

export function createPricingRateItem(productType: PricingBuilderProductType = 'Countertops'): PricingRateItem {
  return {
    id: uid('rate'),
    productType,
    name: productType,
    unit: productType === 'Countertops' || productType === 'Backsplash' ? 'sf' : 'each',
    rate: undefined,
  };
}

export function createPricingOptionPackage(index = 0): PricingOptionPackage {
  return {
    id: uid('option'),
    code: String.fromCharCode(65 + (index % 26)),
    name: index === 0 ? 'Base' : `Option ${String.fromCharCode(65 + (index % 26))}`,
    isBase: index === 0,
    flatAdjustment: 0,
    rules: [],
  };
}

export function createPricingOptionRule(productType: PricingBuilderProductType = 'Countertops'): PricingOptionRule {
  return {
    id: uid('rule'),
    scope: 'All',
    productType,
    rateItemId: '',
  };
}

export function createPricingPlan(): PricingPlan {
  return {
    id: uid('plan'),
    planNumber: '',
    name: 'New plan',
    description: '',
    notes: '',
  };
}

export function createPricingTakeoff(planId: string): PricingPlanTakeoff {
  return {
    id: uid('takeoff'),
    planId,
    room: 'Kitchen',
    piece: 'Countertop',
  };
}

export function takeoffSquareFeet(takeoff: PricingPlanTakeoff) {
  if (typeof takeoff.squareFeet === 'number' && Number.isFinite(takeoff.squareFeet)) return takeoff.squareFeet;
  if (typeof takeoff.length === 'number' && typeof takeoff.width === 'number') {
    return (takeoff.length * takeoff.width) / 144;
  }
  return 0;
}

function normalized(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

function scopeRank(scope: string, room: string) {
  const s = normalized(scope);
  const r = normalized(room);
  if (!s || s === 'all') return 1;
  if (s === r) return 5;
  if (s === 'kitchen' && r.includes('kitchen')) return 4;
  if ((s === 'bathrooms' || s === 'baths') && r.includes('bath')) return 4;
  if (s === 'other' && !r.includes('kitchen') && !r.includes('bath')) return 3;
  return 0;
}

function findRule(option: PricingOptionPackage, room: string, productType: PricingBuilderProductType) {
  return option.rules
    .filter((rule) => rule.productType === productType)
    .map((rule) => ({ rule, rank: scopeRank(rule.scope, room) }))
    .filter((entry) => entry.rank > 0)
    .sort((a, b) => b.rank - a.rank)[0]?.rule;
}

function rateFor(builder: PricingScheduleBuilderData, option: PricingOptionPackage, room: string, productType: PricingBuilderProductType) {
  const rule = findRule(option, room, productType);
  const rate = rule ? builder.rates.find((candidate) => candidate.id === rule.rateItemId) : undefined;
  return { rule, rate };
}

function pieceProductType(takeoff: PricingPlanTakeoff): PricingBuilderProductType {
  const piece = normalized(takeoff.piece);
  return piece.includes('splash') ? 'Backsplash' : 'Countertops';
}

function addCharge(
  builder: PricingScheduleBuilderData,
  option: PricingOptionPackage,
  takeoff: PricingPlanTakeoff,
  productType: PricingBuilderProductType,
  quantity: number,
  unitLabel: string,
  label: string,
): PricingCalculationLine | null {
  if (!quantity) return null;
  const { rate } = rateFor(builder, option, takeoff.room, productType);
  const numericRate = typeof rate?.rate === 'number' && Number.isFinite(rate.rate) ? rate.rate : undefined;
  return {
    id: `${takeoff.id}-${productType}-${label}`,
    label,
    room: takeoff.room,
    productType,
    productName: rate?.name,
    quantity,
    unit: unitLabel,
    rate: numericRate,
    amount: numericRate === undefined ? undefined : quantity * numericRate,
    warning: rate ? (numericRate === undefined ? `${rate.name} has no rate.` : undefined) : `No ${productType} rate is assigned for ${takeoff.room}.`,
  };
}

export function calculatePlanOption(
  builder: PricingScheduleBuilderData,
  plan: PricingPlan,
  option: PricingOptionPackage,
): PricingPlanOptionCalculation {
  const lines: PricingCalculationLine[] = [];
  const takeoffs = builder.takeoffs.filter((takeoff) => takeoff.planId === plan.id);

  takeoffs.forEach((takeoff) => {
    const sf = takeoffSquareFeet(takeoff);
    const surface = addCharge(builder, option, takeoff, pieceProductType(takeoff), sf, 'SF', takeoff.piece || 'Surface');
    if (surface) lines.push(surface);

    const kitchenSink = addCharge(builder, option, takeoff, 'Kitchen Sink', takeoff.kitchenSinks ?? 0, 'EA', 'Kitchen sink');
    if (kitchenSink) lines.push(kitchenSink);

    const vanitySink = addCharge(builder, option, takeoff, 'Vanity Sink', takeoff.vanityBowls ?? 0, 'EA', 'Vanity bowl');
    if (vanitySink) lines.push(vanitySink);

    const support = addCharge(builder, option, takeoff, 'Support', takeoff.supports ?? 0, 'EA', 'Support');
    if (support) lines.push(support);
  });

  if (option.flatAdjustment) {
    lines.push({
      id: `${option.id}-flat`,
      label: 'Flat adjustment',
      room: 'Agreement',
      productType: 'Other',
      productName: 'Flat adjustment',
      quantity: 1,
      unit: 'EA',
      rate: option.flatAdjustment,
      amount: option.flatAdjustment,
    });
  }

  const warnings = lines.flatMap((line) => line.warning ? [line.warning] : []);
  if (!takeoffs.length) warnings.push(`${plan.planNumber || plan.name} has no takeoff rows.`);
  const total = warnings.length || lines.some((line) => line.amount === undefined)
    ? undefined
    : lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);

  return { plan, option, lines, total, warnings: [...new Set(warnings)] };
}

export function pricingBuilderMatrix(builder: PricingScheduleBuilderData) {
  return builder.plans.flatMap((plan) => builder.options.map((option) => calculatePlanOption(builder, plan, option)));
}

export function deriveBuilderCustomerItems(builder?: PricingScheduleBuilderData): PricingScheduleItem[] {
  if (!builder) return [];
  return pricingBuilderMatrix(builder).map((calculation, index) => ({
    sourceRow: index + 1,
    series: calculation.plan.series,
    itemType: calculation.option.isBase ? 'Base' : 'Option',
    planNumber: calculation.plan.planNumber || undefined,
    planName: calculation.plan.name || undefined,
    optionCode: calculation.option.code || undefined,
    description: calculation.option.description?.trim() || calculation.option.name || undefined,
    customerPrice: calculation.total,
  }));
}

export function pricingBuilderHealth(builder?: PricingScheduleBuilderData) {
  if (!builder) return ['Structured Builder has not been configured.'];
  const warnings: string[] = [];
  if (!builder.rates.length) warnings.push('Add at least one rate to the Rate Book.');
  if (!builder.options.length) warnings.push('Add at least one option package.');
  if (!builder.plans.length) warnings.push('Add at least one plan.');
  builder.plans.forEach((plan) => {
    if (!plan.planNumber.trim() && !plan.name.trim()) warnings.push('A plan is missing both its number and name.');
    if (!builder.takeoffs.some((takeoff) => takeoff.planId === plan.id)) warnings.push(`${plan.planNumber || plan.name || 'A plan'} has no takeoff rows.`);
  });
  builder.options.forEach((option) => {
    if (!option.rules.length && !option.flatAdjustment) warnings.push(`${option.code || option.name} has no pricing rules.`);
  });
  pricingBuilderMatrix(builder).forEach((calculation) => warnings.push(...calculation.warnings));
  return [...new Set(warnings)];
}
