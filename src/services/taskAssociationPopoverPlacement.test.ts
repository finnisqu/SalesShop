import {describe,it,expect} from 'vitest';
import {taskAssociationPopoverPlacement} from './taskAssociationPopover';
describe('Activity-related CRM search placement',()=>{
 it('opens above when a search result and footer would be clipped below',()=>{
  const pos=taskAssociationPopoverPlacement(
   {left:25,width:360,top:510,bottom:550},{width:900,height:690},220);
  expect(pos.top).toBeLessThan(510);
  expect(pos.maxHeight).toBeGreaterThan(170);
 });
 it('keeps the menu below when enough viewport space is available',()=>{
  const pos=taskAssociationPopoverPlacement(
   {left:25,width:360,top:85,bottom:130},{width:900,height:690},180);
  expect(pos.top).toBeGreaterThan(130);
  expect(pos.maxHeight).toBe(180);
 });
});
