import {useEffect,type RefObject} from 'react';

/**
 * Shift + wheel should always navigate the horizontal Board rail even when
 * the pointer sits over an independently scrollable column's card stack.
 * Capture the native wheel event before nested scrollers receive it.
 *
 * Keep ordinary wheel scrolling, touch gestures and unmodified trackpad
 * scrolling untouched. Browsers differ in whether Shift+wheel produces
 * deltaY or converts it into deltaX, so use the dominant axis.
 */
export function useBoardShiftWheelScroll(
 boardRef:RefObject<HTMLElement|null>,
 enabled=true,
){
 useEffect(()=>{
  if(!enabled)return;
  const board=boardRef.current;
  if(!board)return;

  const onWheel=(event:WheelEvent)=>{
   if(!event.shiftKey||event.ctrlKey||event.metaKey)return;
   if(board.scrollWidth<=board.clientWidth+1)return;
   const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)
    ?event.deltaX:event.deltaY;
   if(!delta)return;

   // React's delegated wheel handlers are passive in browsers; a native
   // capture listener with passive:false lets us override column scrolling.
   if(event.cancelable)event.preventDefault();
   event.stopPropagation();
   const pixels=event.deltaMode===1?delta*16
    :event.deltaMode===2?delta*board.clientWidth:delta;
   board.scrollLeft+=pixels;
  };
  board.addEventListener('wheel',onWheel,{capture:true,passive:false});
  return ()=>board.removeEventListener('wheel',onWheel,true);
 },[boardRef,enabled]);
}
