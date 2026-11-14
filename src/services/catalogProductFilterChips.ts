/** Shared visible-filter controls for Catalog Sinks and OTHER on phones.
 * Header search and worktable search are independent conjunctive inputs:
 * removing one must never silently erase the other. */
export interface CatalogProductFilterChip{
 key:string;
 label:string;
 onRemove:()=>void;
}
export interface CatalogProductFilterState{
 localQuery:string;
 headerQuery:string;
 category:string;
 categoryLabel:string;
 includeArchived:boolean;
 sort:string;
 defaultSort:string;
 sortLabel:string;
 clearLocalQuery:()=>void;
 clearHeaderQuery:()=>void;
 clearCategory:()=>void;
 clearArchived:()=>void;
 clearSort:()=>void;
}
export function catalogProductFilterChips(
 state:CatalogProductFilterState,
):CatalogProductFilterChip[]{
 const chips:CatalogProductFilterChip[]=[];
 const local=state.localQuery.trim(),header=state.headerQuery.trim();
 if(header)chips.push({key:'header-search',label:'Catalog: '+header,
  onRemove:state.clearHeaderQuery});
 if(local)chips.push({key:'worktable-search',label:'Find: '+local,
  onRemove:state.clearLocalQuery});
 if(state.category!=='all')chips.push({key:'category',
  label:'Type: '+state.categoryLabel,onRemove:state.clearCategory});
 if(state.includeArchived)chips.push({key:'archived',label:'Including archived',
  onRemove:state.clearArchived});
 if(state.sort!==state.defaultSort)chips.push({key:'sort',
  label:'Sort: '+state.sortLabel,onRemove:state.clearSort});
 return chips;
}
