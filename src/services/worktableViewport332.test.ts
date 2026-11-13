import {describe,expect,it} from 'vitest';
import {placeWorktableMenu} from '../components/useViewportBoundDetails';
const base={
 panelLeft:15,panelRight:350,triggerTop:80,triggerBottom:125,
 viewportLeft:0,viewportTop:0,viewportWidth:390,viewportHeight:780,
};
describe('Batch 332d — shared mobile worktable popovers',()=>{
 it('shifts a right-anchored filter panel away from the left edge',()=>{
  expect(placeWorktableMenu({...base,panelLeft:-170,panelRight:165}).shiftX).toBe(182);
 });
 it('shifts an action panel away from the right edge',()=>{
  expect(placeWorktableMenu({...base,panelLeft:260,panelRight:560}).shiftX).toBe(-182);
 });
 it('leaves a fitting panel stable and caps its height below the trigger',()=>{
  expect(placeWorktableMenu(base)).toEqual({shiftX:0,side:'below',maxHeight:540});
 });
 it('flips above the trigger when a keyboard makes below too small',()=>{
  expect(placeWorktableMenu({...base,triggerTop:330,triggerBottom:375,
   viewportHeight:455})).toEqual({shiftX:0,side:'above',maxHeight:311});
 });
 it('respects a panned, zoomed visual viewport',()=>{
  expect(placeWorktableMenu({...base,viewportLeft:75,viewportTop:120,
   viewportWidth:280,viewportHeight:350,panelLeft:25,panelRight:305,
   triggerTop:190,triggerBottom:230})).toMatchObject({shiftX:62,side:'below'});
 });
});
