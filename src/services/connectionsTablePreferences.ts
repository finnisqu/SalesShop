const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
/** Saved column configurations survive schema changes and keep a clickable Name. */
export function visibleConnectionColumns(saved:string[],available:string[]):string[]{
 const usable=new Set(available);
 const columns=[...new Set((saved.length?saved:available).filter(x=>usable.has(x)))];
 if(!columns.length)return [...available];
 if(usable.has('name')&&!columns.includes('name'))columns.unshift('name');
 return columns;
}
/** Date stamps and monetary values should sort by source values, not display text. */
export function compareConnectionSortValues(a?:string|number,b?:string|number):number{
 if(typeof a==='number'&&typeof b==='number')return a-b;
 return collator.compare(String(a??''),String(b??''));
}
