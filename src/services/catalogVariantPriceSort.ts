import {activeCatalogDefaultVariant,type CatalogDefaultVariant} from './catalogVariantDefaults';

export type CatalogVariantPriceKind='cost'|'price';
export type CatalogSortDirection='ascending'|'descending';
export type CatalogPricedVariant=CatalogDefaultVariant&{
 internalCost?:number;sellPrice?:number;
};
export type CatalogVariantPriceRecord<T extends CatalogPricedVariant=CatalogPricedVariant>={
 name:string;variants:readonly T[];
};

/** Same default variant and blank-price semantics in SINKS and OTHER.
 * Active default only: archived SKUs must never appear as current prices.
 * Missing, NaN or infinite prices sort last (including when both are blank).
 * Never mutate catalog records or quote snapshots. */
export function catalogDefaultVariantPrice(
 record:CatalogVariantPriceRecord,kind:CatalogVariantPriceKind,
):number|undefined{
 const variant=activeCatalogDefaultVariant(record.variants);
 const amount=kind==='cost'?variant?.internalCost:variant?.sellPrice;
 return typeof amount==='number'&&Number.isFinite(amount)?amount:undefined;
}
export function compareCatalogVariantPrice(
 left:CatalogVariantPriceRecord,right:CatalogVariantPriceRecord,
 kind:CatalogVariantPriceKind,direction:CatalogSortDirection='ascending',
):number{
 const a=catalogDefaultVariantPrice(left,kind);
 const b=catalogDefaultVariantPrice(right,kind);
 if(a===undefined&&b===undefined)return left.name.localeCompare(right.name);
 if(a===undefined)return 1;
 if(b===undefined)return -1;
 return (direction==='descending'?b-a:a-b)||left.name.localeCompare(right.name);
}
