/** One reset entry point for Materials, Sinks, Rates and Other. Clearing
 * filters must not clear pins or write any Catalog record. */
export function CatalogFilterReset({activeCount,onReset}:{
 activeCount:number;onReset:()=>void;
}){
 return <button type="button" className="catalog-card-reset"
  disabled={activeCount<=0} onClick={onReset}>
  Reset filters &amp; sort
 </button>;
}
