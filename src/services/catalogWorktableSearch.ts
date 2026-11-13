/** The Catalog page header and a worktable's Find box are independent
 * searches. Both constraints must match the record, not an invented
 * concatenated phrase like "arctic polished". Preserve multiword phrases
 * within each input and avoid changing any saved Catalog data. */
export function matchesCatalogSearch(
 fields:readonly (string|number|null|undefined)[],
 ...searches:readonly string[]
):boolean{
 const needles=searches.map(value=>value.trim().toLocaleLowerCase()).filter(Boolean);
 if(!needles.length)return true;
 const haystack=fields.filter(value=>value!==null&&value!==undefined)
  .join(' ').toLocaleLowerCase();
 return needles.every(needle=>haystack.includes(needle));
}
