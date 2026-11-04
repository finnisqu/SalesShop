/** Pure, viewport-safe geometry for the Task related-records search popover. */
export function taskAssociationPopoverPlacement(
 anchor:Pick<DOMRect,'left'|'top'|'bottom'|'width'>,
 viewport:{width:number;height:number},
 measuredHeight?:number,
){
 const margin=8,gap=6,desiredHeight=Math.min(264,Math.max(64,measuredHeight??264));
 const below=Math.max(0,viewport.height-anchor.bottom-gap-margin);
 const above=Math.max(0,anchor.top-gap-margin);
 // Prefer the side with enough room for a complete result and footer,
 // rather than clipping a one-item result under the Activity form.
 const showAbove=(below<desiredHeight+8&&above>below)||(below<125&&above>below);
 const available=showAbove?above:below;
 const maxHeight=Math.min(desiredHeight,available);
 const width=Math.min(Math.max(anchor.width,230),Math.max(0,viewport.width-2*margin));
 const left=Math.max(margin,Math.min(anchor.left,viewport.width-width-margin));
 const top=showAbove?Math.max(margin,anchor.top-gap-maxHeight):anchor.bottom+gap;
 return {top,left,width,maxHeight};
}
