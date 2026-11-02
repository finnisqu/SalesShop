import { Button, Field } from '../design-system/components';
import { MATERIAL_FAMILIES, type MaterialFamily } from '../types/settings';

/** One filtering UI for desktop popover and mobile sheet; the parent retains
 * the exact same filter state and predicate logic. */
export interface MaterialsFilterFieldsProps {
  idPrefix: string;
  programFilter: 'all' | 'stock' | 'non-stock';
  materialFamilyFilter: 'all' | MaterialFamily;
  materialTypeFilter: string;
  brandFilter: string;
  collectionFilter:string;
  tagFilter:string;
  finishFilter: string;
  thicknessFilter: string;
  materialTypes: string[];
  brands: string[];
  collections:string[];
  tags:string[];
  finishes: string[];
  thicknesses: string[];
  activeFilterCount: number;
  onProgramChange: (next: 'all' | 'stock' | 'non-stock') => void;
  onFamilyChange: (next: 'all' | MaterialFamily) => void;
  onTypeChange: (next: string) => void;
  onBrandChange: (next: string) => void;
  onCollectionChange:(next:string)=>void;
  onTagChange:(next:string)=>void;
  onFinishChange: (next: string) => void;
  onThicknessChange: (next: string) => void;
  onClear: () => void;
}

export function MaterialsFilterFields({
  idPrefix, programFilter, materialFamilyFilter, materialTypeFilter,
  brandFilter, collectionFilter, tagFilter, finishFilter, thicknessFilter, materialTypes,
  brands, collections, tags, finishes, thicknesses, activeFilterCount,
  onProgramChange, onFamilyChange, onTypeChange, onBrandChange,
  onCollectionChange, onTagChange, onFinishChange, onThicknessChange, onClear,
}: MaterialsFilterFieldsProps) {
  return <div className="materials-foundation-filter-fields">
    <Field id={`${idPrefix}-program`} label="Program">
      {(control) => <select {...control} value={programFilter} onChange={(event) => onProgramChange(event.target.value as 'all' | 'stock' | 'non-stock')}>
        <option value="all">All programs</option><option value="stock">STOCK only</option><option value="non-stock">Non-stock only</option>
      </select>}
    </Field>
    <Field id={`${idPrefix}-family`} label="Material family">
      {(control) => <select {...control} value={materialFamilyFilter} onChange={(event) => onFamilyChange(event.target.value as 'all' | MaterialFamily)}>
        <option value="all">All families</option>{MATERIAL_FAMILIES.map((family) => <option key={family} value={family}>{family}</option>)}
      </select>}
    </Field>
    <Field id={`${idPrefix}-type`} label="Material type">
      {(control) => <select {...control} value={materialTypeFilter} onChange={(event) => onTypeChange(event.target.value)}>
        <option value="all">All types</option>{materialTypes.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>}
    </Field>
    <Field id={`${idPrefix}-brand`} label="Brand">
      {(control) => <select {...control} value={brandFilter} onChange={(event) => onBrandChange(event.target.value)}>
        <option value="all">All brands</option>{brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
      </select>}
    </Field>
    <Field id={`${idPrefix}-collection`} label="Collection / series">
      {(control)=><select {...control} value={collectionFilter} onChange={e=>onCollectionChange(e.target.value)}>
        <option value="all">All collections</option>
        {collections.map(name=><option key={name} value={name}>{name}</option>)}
      </select>}
    </Field>
    <Field id={`${idPrefix}-tag`} label="Specialty / tag">
      {(control)=><select {...control} value={tagFilter} onChange={e=>onTagChange(e.target.value)}>
        <option value="all">All tags</option>
        {tags.map(name=><option key={name} value={name}>{name}</option>)}
      </select>}
    </Field>
    <Field id={`${idPrefix}-finish`} label="Finish">
      {(control) => <select {...control} value={finishFilter} onChange={(event) => onFinishChange(event.target.value)}>
        <option value="all">All finishes</option>{finishes.map((finish) => <option key={finish} value={finish}>{finish}</option>)}
      </select>}
    </Field>
    <Field id={`${idPrefix}-thickness`} label="Thickness">
      {(control) => <select {...control} value={thicknessFilter} onChange={(event) => onThicknessChange(event.target.value)}>
        <option value="all">All thicknesses</option>{thicknesses.map((thickness) => <option key={thickness} value={thickness}>{thickness}</option>)}
      </select>}
    </Field>
    <Button variant="secondary" className="materials-foundation-clear-filters"
      onClick={onClear} disabled={activeFilterCount === 0}>Clear filters</Button>
  </div>;
}
