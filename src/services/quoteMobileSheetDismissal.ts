/** A header gesture must be an intentional single-finger downward swipe.
 * Scrolling, horizontal gestures, keyboard use and cancelled touches must
 * never dismiss an editing sheet with unsaved inputs. */
export interface QuoteSheetTouchPoint {x:number;y:number;}
export function quoteSheetSwipeShouldClose(
 start:QuoteSheetTouchPoint|null,end:QuoteSheetTouchPoint|null,
 keyboardOpen:boolean,
):boolean{
 if(!start||!end||keyboardOpen)return false;
 if(![start.x,start.y,end.x,end.y].every(Number.isFinite))return false;
 const dy=end.y-start.y;
 const dx=Math.abs(end.x-start.x);
 return dy>=85&&dx<=Math.min(64,dy*0.65);
}

/** Only noninteractive header space is a safe drag start. */
export function quoteSheetSwipeCanStart(
 target:Element|null,keyboardOpen:boolean,touchCount:number,
):boolean{
 return !keyboardOpen&&touchCount===1&&Boolean(target)&&
  !target!.closest('button,input,textarea,select,a,[role="button"],[contenteditable="true"]');
}
