import {describe,expect,it} from 'vitest';
import {taskAssociationPopoverPlacement} from './taskAssociationPopover';
describe('Task related-record search popover',()=>{
 it('anchors below when there is room',()=>{
   const result=taskAssociationPopoverPlacement({left:80,top:140,bottom:180,width:420},{width:1000,height:800});
   expect(result.top).toBe(186);expect(result.width).toBe(420);expect(result.maxHeight).toBe(264);
 });
 it('opens above when the task dialog is near the viewport bottom',()=>{
   const result=taskAssociationPopoverPlacement({left:80,top:640,bottom:680,width:420},{width:1000,height:750});
   expect(result.top).toBeLessThan(640);expect(result.maxHeight).toBe(264);
 });
 it('stays within a narrow mobile viewport',()=>{
   const result=taskAssociationPopoverPlacement({left:300,top:380,bottom:420,width:500},{width:340,height:500});
   expect(result.left+result.width).toBeLessThanOrEqual(332);
   expect(result.left).toBeGreaterThanOrEqual(8);expect(result.top).toBeGreaterThanOrEqual(8);
 });
});
