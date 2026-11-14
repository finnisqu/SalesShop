/** Does the focused Quick Quote field cross the visible keyboard-safe
 * viewport? Independent of screen size and DOM to allow direct tests. */
export function quoteSheetFieldNeedsReveal(
 fieldTop:number,fieldBottom:number,
 visibleTop:number,visibleBottom:number,
 bottomReserve=20,
):boolean{
 return fieldTop<visibleTop+12||fieldBottom>visibleBottom-bottomReserve;
}

/** Return the smallest vertical movement of an *inner sheet scrollport*,
 * not the page, needed to reveal a focused field above the mobile keyboard.
 * Visual viewport and inner scrollport bounds are both in client coordinates. */
export function quoteSheetFieldScrollDelta(
 fieldTop:number,fieldBottom:number,
 scrollportTop:number,scrollportBottom:number,
 visualTop:number,visualBottom:number,
 bottomReserve=64,
):number{
 const safeTop=Math.max(scrollportTop+12,visualTop+12);
 const safeBottom=Math.min(scrollportBottom-12,visualBottom-bottomReserve);
 if(![fieldTop,fieldBottom,safeTop,safeBottom].every(Number.isFinite)||
    safeBottom<=safeTop)return 0;
 if(fieldTop<safeTop)return fieldTop-safeTop;
 if(fieldBottom>safeBottom)return fieldBottom-safeBottom;
 return 0;
}

/** Catalog menus remain inside the detail sheet, but may be positioned
 * above the trigger if the keyboard leaves more room there. Never claim
 * more pixels than the intersected sheet + visual viewport can show. */
export function quoteSheetCatalogMenuPlacement(
 triggerTop:number,triggerBottom:number,scrollportTop:number,scrollportBottom:number,
 visualTop:number,visualBottom:number,
):{side:'above'|'below';maxHeight:number}{
 const top=Math.max(scrollportTop+8,visualTop+8);
 const bottom=Math.min(scrollportBottom-8,visualBottom-8);
 if(![triggerTop,triggerBottom,top,bottom].every(Number.isFinite)||bottom<=top)
  return {side:'below',maxHeight:0};
 const below=Math.max(0,bottom-triggerBottom-4);
 const above=Math.max(0,triggerTop-top-4);
 const side=below<144&&above>below+40?'above':'below';
 return {side,maxHeight:Math.floor(Math.min(320,side==='above'?above:below))};
}
