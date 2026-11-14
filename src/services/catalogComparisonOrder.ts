/** Shared comparison-board order for Catalog Sinks and OTHER.
 * Dragging a stale/deleted key must NEVER recreate a ghost pin. */
export function reorderCatalogPins(
 current:string[],sourceKey:string,targetKey:string,
):string[]{
 if(!sourceKey||sourceKey===targetKey||
  !current.includes(sourceKey)||!current.includes(targetKey))return current;
 const reordered=current.filter(key=>key!==sourceKey);
 const target=reordered.indexOf(targetKey);
 if(target<0)return current;
 reordered.splice(target,0,sourceKey);
 return reordered;
}

/** Accessible arrow-button equivalent of comparison card drag-and-drop. */
export function shiftCatalogPin(
 current:string[],key:string,direction:-1|1,
):string[]{
 const index=current.indexOf(key),target=index+direction;
 if(index<0||target<0||target>=current.length)return current;
 const reordered=[...current];
 [reordered[index],reordered[target]]=[reordered[target],reordered[index]];
 return reordered;
}
