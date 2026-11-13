/** Does the focused Quick Quote field cross the visible keyboard-safe
 * viewport? Independent of screen size and DOM to allow direct tests. */
export function quoteSheetFieldNeedsReveal(
 fieldTop:number,fieldBottom:number,
 visibleTop:number,visibleBottom:number,
 bottomReserve=20,
):boolean{
 return fieldTop<visibleTop+12||fieldBottom>visibleBottom-bottomReserve;
}
