/** How far a focused inline Record control lies outside the usable
 * visual viewport. Positive scrolls down, negative scrolls up. */
export function recordInlineScrollDelta(
 control:{top:number;bottom:number},
 viewport:{top:number;height:number},
 paddingTop=12,paddingBottom=24,
):number{
 const top=viewport.top+Math.max(0,paddingTop);
 const bottom=viewport.top+Math.max(0,viewport.height)-Math.max(0,paddingBottom);
 if(!Number.isFinite(control.top)||!Number.isFinite(control.bottom)||
    !Number.isFinite(top)||!Number.isFinite(bottom)||bottom<=top)return 0;
 if(control.bottom>bottom)return Math.ceil(control.bottom-bottom);
 if(control.top<top)return Math.floor(control.top-top);
 return 0;
}
