/** Status labels shared by Sinks and OTHER worktables. 
 * The model/item and its variants each have independent active flags. */
export function CatalogLifecycleStatus({active,isDefault=false}:{
 active:boolean;isDefault?:boolean;
}){
 return <span className="catalog-product-statuses">
  <span className={'catalog-product-status '+(active?'is-active':'is-archived')}>
   {active?'Active':'Archived'}
  </span>
  {active&&isDefault&&<span className="catalog-product-status is-default">Default</span>}
 </span>;
}
