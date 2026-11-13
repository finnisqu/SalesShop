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
