import {useEffect,type RefObject} from 'react';

export interface WorktableMenuGeometry{
 panelLeft:number;panelRight:number;triggerTop:number;triggerBottom:number;
 viewportLeft:number;viewportTop:number;viewportWidth:number;viewportHeight:number;
}
export interface WorktableMenuPlacement{
 shiftX:number;side:'above'|'below';maxHeight:number;
}
/** Pure geometry for Filters, Actions and Columns, including the visible
 * viewport when pinch-zoom or the mobile keyboard changes screen bounds. */
export function placeWorktableMenu(g:WorktableMenuGeometry):WorktableMenuPlacement{
 const margin=12,edgeLeft=g.viewportLeft+margin;
 const edgeRight=g.viewportLeft+g.viewportWidth-margin;
 const shiftX=g.panelLeft<edgeLeft?edgeLeft-g.panelLeft:
  g.panelRight>edgeRight?edgeRight-g.panelRight:0;
 const below=Math.max(0,g.viewportTop+g.viewportHeight-g.triggerBottom-margin-7);
 const above=Math.max(0,g.triggerTop-g.viewportTop-margin-7);
 const side:WorktableMenuPlacement['side']=below<220&&above>below?'above':'below';
 const available=side==='above'?above:below;
 return {shiftX,side,maxHeight:Math.max(40,Math.min(540,Math.floor(available)))};
}
/** Positions an open native-details menu without introducing a scroll parent.
 * The existing dismissal and Escape behavior remain with useDismissibleDetails. */
export function useViewportBoundDetails(ref:RefObject<HTMLDetailsElement|null>){
 useEffect(()=>{
  const menu=ref.current;if(!menu)return;
  const panel=menu.querySelector<HTMLElement>(
   '.ss-worktable-filter-panel,.ss-worktable-action-panel,.connections-columns-popover'
  );
  if(!panel)return;
  const position=()=>{
   if(!menu.open)return;
   const viewport=window.visualViewport;
   const viewportLeft=viewport?.offsetLeft??0;
   const viewportTop=viewport?.offsetTop??0;
   const viewportWidth=viewport?.width??window.innerWidth;
   const viewportHeight=viewport?.height??window.innerHeight;
   // Reset the preceding shift before measuring, so scroll/resize callbacks
   // cannot compound the panel's translation across viewport changes.
   panel.style.setProperty('--ss-worktable-menu-shift-x','0px');
   panel.style.maxWidth=Math.max(100,Math.floor(viewportWidth-24))+'px';
   const box=panel.getBoundingClientRect();
   const trigger=menu.querySelector<HTMLElement>('summary')?.getBoundingClientRect();
   if(!trigger)return;
   const next=placeWorktableMenu({
    panelLeft:box.left,panelRight:box.right,
    triggerTop:trigger.top,triggerBottom:trigger.bottom,
    viewportLeft,viewportTop,viewportWidth,viewportHeight,
   });
   menu.dataset.worktableSide=next.side;
   panel.style.setProperty('--ss-worktable-menu-shift-x',next.shiftX+'px');
   panel.style.maxHeight=next.maxHeight+'px';
  };
  const toggle=()=>{if(menu.open)position();};
  // Wheel/touch scrolling INSIDE the panel never moves its anchor. Avoid
  // a synchronous geometry pass on every item-list scroll event.
  const outsideScroll=(event:Event)=>{
   if(event.target instanceof Node&&menu.contains(event.target))return;
   position();
  };
  menu.addEventListener('toggle',toggle);
  window.addEventListener('resize',position,{passive:true});
  document.addEventListener('scroll',outsideScroll,true);
  window.visualViewport?.addEventListener('resize',position,{passive:true});
  window.visualViewport?.addEventListener('scroll',position,{passive:true});
  return ()=>{
   menu.removeEventListener('toggle',toggle);
   window.removeEventListener('resize',position);
   document.removeEventListener('scroll',outsideScroll,true);
   window.visualViewport?.removeEventListener('resize',position);
   window.visualViewport?.removeEventListener('scroll',position);
  };
  // A Records toolbar may render in a portal only after its host mounts.
  // Rebind on React rerenders so a previously null ref cannot strand the menu.
 });
}
