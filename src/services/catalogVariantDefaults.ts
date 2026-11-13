/** Shared invariant for sellable Sinks and OTHER catalog configurations.
 * Exactly one ACTIVE variant is default when an active variant exists.
 * All defaults are false when everything is inactive. Do not mutate callers'
 * variant objects: they may also be referenced by immutable quote snapshots. */
export interface CatalogDefaultVariant{
 id:string;active:boolean;default:boolean;
}
export function normalizeCatalogVariantDefaults<T extends CatalogDefaultVariant>(
 variants:readonly T[],preferredId?:string,
):T[]{
 const active=variants.filter(variant=>variant.active);
 const chosen=(preferredId?active.find(variant=>variant.id===preferredId):undefined)
  ??active.find(variant=>variant.default)??active[0];
 return variants.map(variant=>{
  const shouldDefault=Boolean(chosen)&&variant.active&&variant.id===chosen?.id;
  return variant.default===shouldDefault?variant:{...variant,default:shouldDefault};
 });
}
\n

/** Read an available default without exposing an inactive historical SKU.
 * A legacy source may not have been normalized yet; fall back to its first
 * active variant, not the first (possibly retired) variant in the list. */
export function activeCatalogDefaultVariant<T extends CatalogDefaultVariant>(
 variants:readonly T[],
):T|undefined{
 return variants.find(variant=>variant.active&&variant.default)
  ??variants.find(variant=>variant.active);
}
