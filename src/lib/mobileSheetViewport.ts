/** Shared handset sheet geometry. VisualViewport dimensions shrink on iOS
 * when the software keyboard is raised, unlike some 100dvh measurements. */
export const MOBILE_SHEET_MEDIA_QUERY=
 '(max-width:760px), (orientation:landscape) and (max-height:520px) and (pointer:coarse)';

export interface MobileSheetViewportInput{
 viewportHeight:number;
 visualHeight?:number|null;
 visualTop?:number|null;
}
export function mobileSheetViewportGeometry(input:MobileSheetViewportInput){
 const layoutHeight=Number.isFinite(input.viewportHeight)&&input.viewportHeight>0
  ?input.viewportHeight:1;
 const visualHeight=input.visualHeight;
 const height=visualHeight!=null&&Number.isFinite(visualHeight)&&visualHeight>0
  ?Math.min(layoutHeight,visualHeight):layoutHeight;
 const visualTop=input.visualTop;
 const top=visualTop!=null&&Number.isFinite(visualTop)&&visualTop>0
  ?Math.min(visualTop,Math.max(0,layoutHeight-height)):0;
 return {top:Math.round(top),height:Math.max(1,Math.round(height))};
}
