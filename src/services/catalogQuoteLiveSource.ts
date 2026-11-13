import type {CatalogQuoteSource} from './catalogQuoteInsertion';
import type {SinkModel} from '../types/sink';
import type {OtherCatalogItem} from '../store/otherCatalogStore';

/** Resolve the source that is CURRENT in the Catalog before creating a quote.
 * A dialog may stay open while a model, variant or selling price changes.
 * Never fall back to its old snapshot if a hydrated catalog has removed it.
 *
 * Omitted catalogs mean hydration is still pending and the passed source is
 * the only available version. Callers with hydrated stores must supply them.
 */
export function resolveCatalogQuoteLiveSource(
 source:CatalogQuoteSource,
 catalogs:{sinkModels?:readonly SinkModel[];otherItems?:readonly OtherCatalogItem[]},
):CatalogQuoteSource|null{
 if(source.kind==='sink'&&catalogs.sinkModels){
  const model=catalogs.sinkModels.find(item=>item.id===source.model.id);
  return model?{...source,model}:null;
 }
 if(source.kind==='other'&&catalogs.otherItems){
  const item=catalogs.otherItems.find(candidate=>candidate.id===source.item.id);
  return item?{...source,item}:null;
 }
 return source;
}
