import {describe,it,expect} from 'vitest';
import {nextQuickGridCell,quickGridControlIsNavigable,quickGridKeyDirection,quickGridLinearNeighborAvailable,type QuickGridCell} from './quoteGridNavigation';

const cells:QuickGridCell[]=[
 {row:0,column:1},{row:0,column:3},{row:0,column:4},
 {row:1,column:1},{row:1,column:4},{row:1,column:5},
 {row:2,column:1},{row:2,column:3},{row:2,column:5},
];

describe('Quick Quote grid navigation',()=>{
 it('skips disabled and visually collapsed mobile fields, preserving available cells',()=>{
  const control=(visible:boolean,disabled:boolean,hidden=false)=>({
    getClientRects:()=>visible?[{}]:[],
    matches:(selector:string)=>selector.includes(':disabled')&&disabled,
    closest:(_selector:string)=>hidden?{}:null,
  }) as unknown as HTMLElement;
  expect(quickGridControlIsNavigable(control(true,false))).toBe(true);
  expect(quickGridControlIsNavigable(control(false,false))).toBe(false);
  expect(quickGridControlIsNavigable(control(true,true))).toBe(false);
  expect(quickGridControlIsNavigable(control(true,false,true))).toBe(false);
 });
 it('moves Tab and Shift+Tab through only the editable cells',()=>{
  expect(nextQuickGridCell(cells,0,'next')).toBe(1);
  expect(nextQuickGridCell(cells,2,'next')).toBe(3);
  expect(nextQuickGridCell(cells,5,'previous')).toBe(4);
  expect(nextQuickGridCell(cells,0,'previous')).toBeNull();
  expect(nextQuickGridCell(cells,cells.length-1,'next')).toBeNull();
 });
 it('keeps horizontal arrows within their row, skipping non-editable columns',()=>{
  expect(nextQuickGridCell(cells,0,'right')).toBe(1);
  expect(nextQuickGridCell(cells,1,'right')).toBe(2);
  expect(nextQuickGridCell(cells,2,'left')).toBe(1);
  expect(nextQuickGridCell(cells,2,'right')).toBeNull();
 });
 it('moves up and down to the closest editable column in the nearest row',()=>{
  expect(nextQuickGridCell(cells,1,'down')).toBe(4);
  expect(nextQuickGridCell(cells,4,'up')).toBe(2);
  expect(nextQuickGridCell(cells,4,'down')).toBe(7);
  expect(nextQuickGridCell(cells,0,'up')).toBeNull();
 });
 it('returns null for empty grids or invalid focus indices, leaving browser shortcuts intact',()=>{
  expect(nextQuickGridCell([],0,'next')).toBeNull();
  expect(nextQuickGridCell(cells,-1,'down')).toBeNull();
  expect(nextQuickGridCell(cells,999,'right')).toBeNull();
 });
 it('advances iPhone Prev/Next across consecutive measurement cells and rows',()=>{
  // A takeoff row has editable Piece, Qty, Length and Width followed by the
  // next row's cells; computed SF, prices and action buttons aren't included.
  const takeoff:QuickGridCell[]=[
   {row:0,column:2},{row:0,column:3},{row:0,column:4},{row:0,column:5},
   {row:1,column:2},{row:1,column:3},{row:1,column:4},{row:1,column:5},
  ];
  expect(nextQuickGridCell(takeoff,1,'next')).toBe(2);
  expect(nextQuickGridCell(takeoff,2,'next')).toBe(3);
  expect(nextQuickGridCell(takeoff,3,'next')).toBe(4);
  expect(nextQuickGridCell(takeoff,4,'previous')).toBe(3);
  expect(nextQuickGridCell(takeoff,7,'next')).toBeNull();
 });
 it('skips derived cells in mixed sink and charge rows without leaving the worksheet',()=>{
  const mixed:QuickGridCell[]=[
   {row:0,column:2},{row:0,column:3},{row:0,column:7},
   {row:1,column:2},{row:1,column:7},
  ];
  expect(nextQuickGridCell(mixed,1,'next')).toBe(2);
  expect(nextQuickGridCell(mixed,2,'next')).toBe(3);
  expect(nextQuickGridCell(mixed,3,'previous')).toBe(2);
  expect(nextQuickGridCell(mixed,2,'down')).toBe(4);
  expect(nextQuickGridCell(mixed,3,'left')).toBeNull();
 });
 it('does not mutate geometry while navigating',()=>{
  const before=JSON.stringify(cells);
  nextQuickGridCell(cells,7,'left');
  nextQuickGridCell(cells,7,'down');
  expect(JSON.stringify(cells)).toBe(before);
 });
 it('uses Shift+Enter for the preceding single-line cell, not for multiline or composing text',()=>{
  const base={key:'Enter',shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,isComposing:false};
  expect(quickGridKeyDirection(base,true,true)).toBe('next');
  expect(quickGridKeyDirection({...base,shiftKey:true},true,true)).toBe('previous');
  expect(quickGridKeyDirection(base,true,false)).toBeUndefined();
  expect(quickGridKeyDirection({...base,isComposing:true},true,true)).toBeUndefined();
  expect(quickGridKeyDirection({...base,ctrlKey:true},true,true)).toBeUndefined();
  expect(quickGridKeyDirection({...base,altKey:true},true,true)).toBeUndefined();
  expect(quickGridKeyDirection({...base,key:'ArrowDown'},true,true)).toBeUndefined();
  expect(quickGridKeyDirection({...base,key:'ArrowDown'},false,false)).toBe('down');
  expect(quickGridKeyDirection({...base,key:'Tab',shiftKey:true},true,true)).toBe('previous');
  expect(quickGridKeyDirection({...base,key:'Tab',metaKey:true},true,true)).toBeUndefined();
 });
 it('excludes visibility-hidden desktop cells and disables mobile Prev/Next at boundaries',()=>{
  const mock=(visibility='visible')=>({
   getClientRects:()=>[{}],
   matches:()=>false,
   closest:()=>null,
   contains:(item:unknown)=>false,
   ownerDocument:{defaultView:{getComputedStyle:()=>({visibility})}},
  }) as unknown as HTMLElement;
  const first=mock(),hidden=mock('hidden'),last=mock();
  const root={querySelectorAll:()=>[first,hidden,last]} as unknown as HTMLElement;
  expect(quickGridControlIsNavigable(hidden)).toBe(false);
  expect(quickGridLinearNeighborAvailable(root,first,'previous')).toBe(false);
  expect(quickGridLinearNeighborAvailable(root,first,'next')).toBe(true);
  expect(quickGridLinearNeighborAvailable(root,last,'previous')).toBe(true);
  expect(quickGridLinearNeighborAvailable(root,last,'next')).toBe(false);
  expect(quickGridLinearNeighborAvailable(root,hidden,'next')).toBe(false);
 });
});
