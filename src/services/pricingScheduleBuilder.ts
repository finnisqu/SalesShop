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
import {contractScheduleHealth,deriveContractCustomerItems} from './pricingScheduleContract';

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
    variantCode: 'BASE',
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
  const surface = productType === 'Countertops' || productType === 'Backsplash';
  const scope = normalized(room);
  const materialRateId = scope.includes('kitchen')
    ? option.kitchenMaterialRateId
    : scope.includes('bath') ? option.bathroomMaterialRateId : option.otherMaterialRateId;
  if (surface && materialRateId) return {
    rule: undefined,
    rate: builder.rates.find(candidate => candidate.id === materialRateId),
  };
  const rule = findRule(option, room, productType);
  if (rule) return { rule, rate: builder.rates.find(candidate => candidate.id === rule.rateItemId) };
  // For simple builder agreements, one price is shared by tops and splashes,
  // and a unique per-each item rate is the default for that add-on type.
  const candidates = builder.rates.filter(rate => surface
    ? rate.kind === 'material-level' && rate.unit === 'sf'
    : rate.productType === productType && rate.kind !== 'material-level');
  return { rule: undefined, rate: candidates.length === 1 ? candidates[0] : undefined };
}

function pieceProductType(takeoff: PricingPlanTakeoff): PricingBuilderProductType {
  const piece = normalized(takeoff.piece);
  return piece.includes('splash') || normalized(takeoff.category).includes('splash')
    ? 'Backsplash' : 'Countertops';
}

export function pricingTakeoffGroups(builder: PricingScheduleBuilderData, planId?: string) {
  const grouped = new Map<string, Set<string>>();
  for (const takeoff of builder.takeoffs) {
    if (planId && takeoff.planId !== planId) continue;
    const group = takeoff.variantGroup?.trim();
    if (!group) continue;
    if (!grouped.has(group)) grouped.set(group, new Set());
    grouped.get(group)!.add(takeoff.variantCode?.trim() || 'BASE');
  }
  return [...grouped.entries()].map(([name,codes]) => ({
    name,
    codes: [...codes],
    defaultCode: [...codes].find(c => c.toUpperCase() === 'BASE'),
  }));
}

export function includedPricingTakeoffs(
  builder: PricingScheduleBuilderData,
  plan: PricingPlan,
  option: PricingOptionPackage,
): { takeoffs: PricingPlanTakeoff[]; warnings: string[] } {
  const all = builder.takeoffs.filter(takeoff => takeoff.planId === plan.id);
  const warnings: string[] = [];
  const groups = pricingTakeoffGroups(builder, plan.id);
  for (const group of groups) {
    const chosen = option.takeoffVariants?.[group.name] || group.defaultCode;
    if (!chosen || !group.codes.includes(chosen))
      warnings.push(`Select an available ${group.name} configuration for ${option.code || option.name}.`);
  }
  const selected = all.filter(takeoff => {
    if (takeoff.variantGroup?.trim()) {
      const name = takeoff.variantGroup.trim();
      const group = groups.find(candidate => candidate.name === name);
      const variant = option.takeoffVariants?.[name] || group?.defaultCode;
      if (!variant || (takeoff.variantCode?.trim() || 'BASE') !== variant) return false;
    }
    if (pieceProductType(takeoff) === 'Backsplash') {
      const room = normalized(takeoff.room);
      if (room.includes('kitchen') && option.includeKitchenSplash === false) return false;
      if (room.includes('bath') && option.includeBathroomSplash === false) return false;
    }
    return true;
  });
  return { takeoffs: selected, warnings };
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
  const selection = includedPricingTakeoffs(builder,plan,option);
  const takeoffs = selection.takeoffs;

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

  // Flat means one lump-sum charge, while /EA and /SF use quantity × rate.
  for (const [rateId, quantity] of Object.entries(option.extraRateQuantities ?? {})) {
    if (!quantity) continue;
    const rate = builder.rates.find(candidate => candidate.id === rateId);
    if (!rate || rate.kind === 'material-level') {
      selection.warnings.push(`A selected add-on rate is missing from the Rate Book.`);
      continue;
    }
    const billedQuantity = rate.unit === 'flat' ? 1 : quantity;
    const numericRate = rateItemNumericRate(rate);
    lines.push({
      id: `${option.id}-addon-${rateId}`, label: rate.name, room: 'Option extras',
      productType: rate.productType, productName: rate.name,
      quantity: billedQuantity, unit: rate.unit === 'sf' ? 'SF' : rate.unit === 'flat' ? 'Flat' : 'EA',
      rate: numericRate, amount: numericRate === undefined ? undefined : billedQuantity * numericRate,
      warning: numericRate === undefined ? `${rate.name} is missing its rate.` : undefined,
    });
  }
  const warnings = [
    ...selection.warnings,
    ...lines.flatMap((line) => line.warning ? [line.warning] : []),
  ];
  if (!builder.takeoffs.some(takeoff => takeoff.planId === plan.id))
    warnings.push(`${plan.planNumber || plan.name} has no takeoff rows.`);
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
  if (builder.outputMode === 'contract') return deriveContractCustomerItems(builder);
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
  if (builder.outputMode === 'contract') return contractScheduleHealth(builder);
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
    // Explicit shared-material selectors and uniquely defined add-on rates
    // replace the old requirement to manually attach a pricing rule per scope.
    if (used && !option.rules.length && !option.flatAdjustment &&
        !option.kitchenMaterialRateId && !option.bathroomMaterialRateId &&
        !builder.rates.some(rate => rate.kind === 'material-level'))
      warnings.push(`${option.code || option.name} needs material rates.`);
  });
  pricingBuilderMatrix(builder).forEach((calculation) => warnings.push(...calculation.warnings));
  return [...new Set(warnings)];
}
