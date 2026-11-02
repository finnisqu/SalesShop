/** Convert a single clipboard or typed numeric value without accepting ambiguous
 * thousands separators, percent signs or formulas. Inches use parseInches instead. */
export function parseQuickGridNumber(raw:string):number|undefined{
 const text=raw.trim().replace(/^\$\s*/,'');
 if(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text))return undefined;
 const parsed=Number(text.replace(/,/g,''));
 return Number.isFinite(parsed)?parsed:undefined;
}
