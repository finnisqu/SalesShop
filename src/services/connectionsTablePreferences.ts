const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
/** Saved column configurations survive schema changes and keep a clickable Name. */
export function visibleConnectionColumns(saved:string[],available:string[]):string[]{
 const usable=new Set(available);
 const columns=[...new Set((saved.length?saved:available).filter(x=>usable.has(x)))];
 if(!columns.length)return [...available];
 if(usable.has('name')&&!columns.includes('name'))columns.unshift('name');
 return columns;
}
/** Show column choices in the actual saved table order, with hidden columns
 * afterward. The menu previously used schema order, so pressing its move
 * arrows looked like nothing happened even while the table rearranged. */
export function orderedConnectionColumnChoices<T extends {key:string}>(
 columns:readonly T[],activeKeys:readonly string[],
):T[]{
 const byKey=new Map(columns.map(col=>[col.key,col]));
 const seen=new Set<string>();
 const ordered:T[]=[];
 for(const key of activeKeys){
  const col=byKey.get(key);
  if(col&&!seen.has(key)){seen.add(key);ordered.push(col);}
 }
 for(const col of columns){
  if(!seen.has(col.key)){seen.add(col.key);ordered.push(col);}
 }
 return ordered;
}
/** Date stamps and monetary values should sort by source values, not display text. */
export function compareConnectionSortValues(a?:string|number,b?:string|number):number{
 if(typeof a==='number'&&typeof b==='number')return a-b;
 return collator.compare(String(a??''),String(b??''));
}
