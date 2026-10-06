import type {
  PricingBuilderProductType,
  PricingOptionPackage,
  PricingOptionRule,
  PricingPlan,
  PricingPlanTakeoff,
  PricingRateItem,
  PricingRateKind,
  PricingRatePriceMode,
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

export function createPricingRateItem(
  productType: PricingBuilderProductType = 'Countertops',
  kind: PricingRateKind = 'add-on',
): PricingRateItem {
  return {
    id: uid('rate'),
    productType,
    kind,
    name: productType,
    materialType: kind === 'material-level' ? 'Granite' : undefined,
    level: kind === 'material-level' ? 'Level 1' : undefined,
    colors: [],
    colorsText: '',
    unit: productType === 'Countertops' || productType === 'Backsplash' ? 'sf' : 'each',
    rate: undefined,
    priceMode: 'priced',
    customerVisible: true,
    showLevelOnCustomer: kind === 'material-level' ? false : undefined,
    detailsLayout: kind === 'material-level' ? 'list' : 'inline',
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
    excludedOptionIds: [],
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

export function parsePricingDetailLines(value?: string) {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function rateColorsText(rate: PricingRateItem) {
  if (rate.colorsText !== undefined) return rate.colorsText;
  return (rate.colors ?? []).join('\n');
}

export function planOptionEnabled(plan: PricingPlan, option: PricingOptionPackage) {
  return !plan.excludedOptionIds?.includes(option.id);
}

function priceMode(rate: PricingRateItem): PricingRatePriceMode {
  return rate.priceMode ?? 'priced';
}

export function rateItemNumericRate(rate?: PricingRateItem) {
  if (!rate) return undefined;
  const mode = priceMode(rate);
  if (mode === 'no-charge' || mode === 'included') return 0;
  if (mode === 'tbd') return undefined;
  return typeof rate.rate === 'number' && Number.isFinite(rate.rate) ? rate.rate : undefined;
}

export function rateItemPriceLabel(rate: PricingRateItem) {
  const mode = priceMode(rate);
  if (mode === 'no-charge') return 'NC';
  if (mode === 'included') return 'Included';
  if (mode === 'tbd') return 'TBD';
  return undefined;
}

function unitLabel(rate: PricingRateItem) {
  if (rate.unit === 'sf') return '/ SF';
  if (rate.unit === 'each') return '/ EA';
  return 'Flat';
}

export function deriveRateSheetCustomerItems(builder?: PricingScheduleBuilderData): PricingScheduleItem[] {
  if (!builder) return [];
  return builder.rates
    .filter((rate) => rate.customerVisible !== false)
    .map((rate, index) => {
      const numericRate = rateItemNumericRate(rate);
      const label = rateItemPriceLabel(rate);
      const material = rate.kind === 'material-level';
      const details = material
        ? parsePricingDetailLines(rateColorsText(rate))
        : parsePricingDetailLines(rate.description);
      return {
        sourceRow: index + 1,
        itemType: material && rate.showLevelOnCustomer !== false ? (rate.level || undefined) : undefined,
        description: rate.name,
        customerPrice: label ? undefined : numericRate,
        displayType: material ? 'rate-level' : 'rate-add-on',
        groupLabel: material ? `${rate.materialType || 'Material'} Levels` : 'Sinks & Add-ons',
        priceLabel: label,
        unitLabel: unitLabel(rate),
        colors: material ? details : undefined,
        details,
        detailsLayout: rate.detailsLayout ?? (material ? 'list' : 'inline'),
      } satisfies PricingScheduleItem;
    });
}

export function rateSheetHealth(builder?: PricingScheduleBuilderData) {
  if (!builder) return ['Add at least one Rate Book item.'];
  const visible = builder.rates.filter((rate) => rate.customerVisible !== false);
  const warnings: string[] = [];
  if (!visible.length) warnings.push('Add at least one customer-visible Rate Book item.');
  visible.forEach((rate) => {
    if (!rate.name.trim()) warnings.push('A Rate Book item is missing its customer label / item name.');
    if (rate.kind === 'material-level' && rate.showLevelOnCustomer !== false && !rate.level?.trim()) warnings.push(`${rate.name || 'A material'} is set to show Level but has no level value.`);
    if (priceMode(rate) === 'priced' && rateItemNumericRate(rate) === undefined) warnings.push(`${rate.name || 'A Rate Book item'} is missing its price.`);
  });
  return [...new Set(warnings)];
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
  unitLabelValue: string,
  label: string,
): PricingCalculationLine | null {
  if (!quantity) return null;
  const { rate } = rateFor(builder, option, takeoff.room, productType);
  const numericRate = rateItemNumericRate(rate);
  const mode = rate ? priceMode(rate) : undefined;
  return {
    id: `${takeoff.id}-${productType}-${label}`,
    label,
    room: takeoff.room,
    productType,
    productName: rate?.name,
    quantity,
    unit: unitLabelValue,
    rate: numericRate,
    amount: numericRate === undefined ? undefined : quantity * numericRate,
    warning: rate
      ? (numericRate === undefined ? `${rate.name} is ${mode === 'tbd' ? 'TBD' : 'missing a rate'}.` : undefined)
      : `No ${productType} rate is assigned for ${takeoff.room}.`,
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
  return builder.plans.flatMap((plan) => builder.options
    .filter((option) => planOptionEnabled(plan, option))
    .map((option) => calculatePlanOption(builder, plan, option)));
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
    displayType: 'schedule-item',
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
    if (!builder.options.some((option) => planOptionEnabled(plan, option))) warnings.push(`${plan.planNumber || plan.name || 'A plan'} has no available option packages.`);
  });
  builder.options.forEach((option) => {
    const used = builder.plans.some((plan) => planOptionEnabled(plan, option));
    if (used && !option.rules.length && !option.flatAdjustment) warnings.push(`${option.code || option.name} has no pricing rules.`);
  });
  pricingBuilderMatrix(builder).forEach((calculation) => warnings.push(...calculation.warnings));
  return [...new Set(warnings)];
}
