import { Button, Field } from '../design-system/components';
import {
  RATE_BOOK_PRICING_BEHAVIOR_LABELS,
  RATE_BOOK_UNIT_LABELS,
  type RateBookPricingBehavior, type RateBookUnit,
} from '../types/rateBook';

type OverrideFilter = 'all' | 'has' | 'base';

export interface RatesFilterFieldsProps {
  idPrefix: string;
  behaviorFilter: 'all' | RateBookPricingBehavior;
  unitFilter: 'all' | RateBookUnit;
  overrideFilter: OverrideFilter;
  availableUnits: RateBookUnit[];
  activeFilterCount: number;
  onBehaviorChange: (value: 'all' | RateBookPricingBehavior) => void;
  onUnitChange: (value: 'all' | RateBookUnit) => void;
  onOverrideChange: (value: OverrideFilter) => void;
  onClear: () => void;
}

/** Shared controlled filter fields in desktop popover and mobile sheet. */
export function RatesFilterFields({
  idPrefix, behaviorFilter, unitFilter, overrideFilter, availableUnits, activeFilterCount,
  onBehaviorChange, onUnitChange, onOverrideChange, onClear,
}: RatesFilterFieldsProps) {
  return <div className="rates-foundation-filter-fields">
    <Field id={`${idPrefix}-behavior`} label="Pricing behavior">
      {(control) => <select {...control} value={behaviorFilter}
        onChange={(event) => onBehaviorChange(event.target.value as 'all' | RateBookPricingBehavior)}>
        <option value="all">All behaviors</option>
        {(['suggested', 'cost-reference', 'manual'] as const).map((kind) =>
          <option key={kind} value={kind}>{RATE_BOOK_PRICING_BEHAVIOR_LABELS[kind]}</option>)}
      </select>}
    </Field>
    <Field id={`${idPrefix}-unit`} label="Unit">
      {(control) => <select {...control} value={unitFilter}
        onChange={(event) => onUnitChange(event.target.value as 'all' | RateBookUnit)}>
        <option value="all">All units</option>
        {availableUnits.map((unit) => <option value={unit} key={unit}>{RATE_BOOK_UNIT_LABELS[unit]}</option>)}
      </select>}
    </Field>
    <Field id={`${idPrefix}-overrides`} label="Division pricing">
      {(control) => <select {...control} value={overrideFilter}
        onChange={(event) => onOverrideChange(event.target.value as OverrideFilter)}>
        <option value="all">All rows</option><option value="has">Has division override</option>
        <option value="base">Base rate only</option>
      </select>}
    </Field>
    <Button variant="secondary" className="rates-foundation-clear-filters"
      disabled={!activeFilterCount} onClick={onClear}>Clear filters</Button>
  </div>;
}
