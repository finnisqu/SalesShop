import {describe,it,expect} from 'vitest';
import {taskAssociationPopoverPlacement} from './taskAssociationPopover';
describe('Activity-related CRM search placement',()=>{
 it('opens above when a search result and footer would be clipped below',()=>{
  const pos=taskAssociationPopoverPlacement(
   {left:25,width:360,top:510,bottom:550},{width:900,height:690},220);
  expect(pos.top).toBeLessThan(510);
  expect(pos.maxHeight).toBeGreaterThan(170);
 });
 it('fits above the iPhone keyboard when the visual viewport is shorter',()=>{
  const visible={width:390,height:398,offsetTop:0,offsetLeft:0};
  const pos=taskAssociationPopoverPlacement(
   {left:12,width:366,top:298,bottom:338},visible,240);
  expect(pos.top).toBeLessThan(298);
  expect(pos.top).toBeGreaterThanOrEqual(8);
  expect(pos.maxHeight).toBeLessThanOrEqual(240);
  expect(pos.left+pos.width).toBeLessThanOrEqual(382);
 });
 it('respects a scrolled visual viewport and horizontal bounds',()=>{
  const visible={width:320,height:420,offsetTop:80,offsetLeft:10};
  const pos=taskAssociationPopoverPlacement(
   {left:250,width:280,top:310,bottom:355},visible,180);
  expect(pos.left).toBeGreaterThanOrEqual(18);
  expect(pos.left+pos.width).toBeLessThanOrEqual(322);
  expect(pos.top).toBeGreaterThanOrEqual(88);
  expect(pos.top+pos.maxHeight).toBeLessThanOrEqual(492);
 });
 it('keeps the menu below when enough viewport space is available',()=>{
  const pos=taskAssociationPopoverPlacement(
   {left:25,width:360,top:85,bottom:130},{width:900,height:690},180);
  expect(pos.top).toBeGreaterThan(130);
  expect(pos.maxHeight).toBe(180);
 });
});
