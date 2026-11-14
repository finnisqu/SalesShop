import type {CatalogQuoteSource} from './catalogQuoteInsertion';
import type {SinkModel} from '../types/sink';
import type {StockMaterial} from '../types/settings';
import type {RateBookItem} from '../types/rateBook';
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
 catalogs:{
  materials?:readonly StockMaterial[];rateItems?:readonly RateBookItem[];
  sinkModels?:readonly SinkModel[];otherItems?:readonly OtherCatalogItem[];
 },
):CatalogQuoteSource|null{
 if(source.kind==='material'&&catalogs.materials){
  const material=catalogs.materials.find(item=>item.id===source.material.id);
  return material?{...source,material}:null;
 }
 if(source.kind==='rate'&&catalogs.rateItems){
  const item=catalogs.rateItems.find(candidate=>candidate.id===source.item.id);
  return item?{...source,item}:null;
 }
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
