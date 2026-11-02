/** Pure, viewport-safe geometry for the Task related-records search popover. */
export function taskAssociationPopoverPlacement(
 anchor:Pick<DOMRect,'left'|'top'|'bottom'|'width'>,
 viewport:{width:number;height:number},
){
 const margin=8,gap=6,desiredHeight=264;
 const below=Math.max(0,viewport.height-anchor.bottom-gap-margin);
 const above=Math.max(0,anchor.top-gap-margin);
 const showAbove=below<175&&above>below;
 const available=showAbove?above:below;
 const maxHeight=Math.min(desiredHeight,available);
 const width=Math.min(Math.max(anchor.width,230),Math.max(0,viewport.width-2*margin));
 const left=Math.max(margin,Math.min(anchor.left,viewport.width-width-margin));
 const top=showAbove?Math.max(margin,anchor.top-gap-maxHeight):anchor.bottom+gap;
 return {top,left,width,maxHeight};
}
