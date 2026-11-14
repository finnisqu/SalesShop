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
 const margin=12;
 const edgeLeft=g.viewportLeft+margin;
 const edgeRight=g.viewportLeft+Math.max(0,g.viewportWidth)-margin;
 const panelWidth=Math.max(0,g.panelRight-g.panelLeft);
 // When a pane has a legacy CSS min-width bigger than the visible screen,
 // favor the safe left edge. Otherwise clamp both sides in one operation.
 const maxLeft=Math.max(edgeLeft,edgeRight-panelWidth);
 const shiftX=Math.min(Math.max(g.panelLeft,edgeLeft),maxLeft)-g.panelLeft;
 const below=Math.max(0,g.viewportTop+g.viewportHeight-g.triggerBottom-margin-7);
 const above=Math.max(0,g.triggerTop-g.viewportTop-margin-7);
 const side:WorktableMenuPlacement['side']=below<220&&above>below?'above':'below';
 const available=side==='above'?above:below;
 // A 40px floor used to force menus below the keyboard when space was
 // smaller than 40px. A constrained menu may be tiny, but never spill.
 return {shiftX,side,maxHeight:Math.max(0,Math.min(540,Math.floor(available)))};
}
/** Positions an open native-details menu without introducing a scroll parent.
 * The existing dismissal and Escape behavior remain with useDismissibleDetails. */
export function useViewportBoundDetails(ref:RefObject<HTMLDetailsElement|null>){
 useEffect(()=>{
  const menu=ref.current;if(!menu)return;
  const panel=menu.querySelector<HTMLElement>(
   '.ss-worktable-filter-panel,.ss-worktable-action-panel,.connections-columns-popover,.ss-record-actions-popover'
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
   const usableWidth=Math.max(1,Math.floor(viewportWidth-24));
   panel.style.maxWidth=usableWidth+'px';
   // A legacy min-width must not win over the visible viewport on very
   // narrow devices or when the user pinches in.
   if(viewportWidth<240)panel.style.minWidth='0px';
   else panel.style.removeProperty('min-width');
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
