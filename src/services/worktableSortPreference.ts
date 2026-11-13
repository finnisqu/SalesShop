/** Validated device-local sort preference for Records worktables.
 * Unknown columns and corrupt saved settings fall back to the current view.
 * This is a presentation preference, never CRM record data.
 */
export interface WorktableSortPreference{key:string;reverse:boolean;}
export function worktableStoredSort(
 raw:string|null,fallback:WorktableSortPreference,available:readonly string[],
):WorktableSortPreference{
 if(!raw)return fallback;
 try{
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value))return fallback;
  const candidate=value as Partial<WorktableSortPreference>;
  if(typeof candidate.key!=='string'||!available.includes(candidate.key)||
    typeof candidate.reverse!=='boolean')return fallback;
  return {key:candidate.key,reverse:candidate.reverse};
 }catch{return fallback;}
}
