import {describe,it,expect} from 'vitest';
import {nextQuickGridCell,type QuickGridCell} from './quoteGridNavigation';

const cells:QuickGridCell[]=[
 {row:0,column:1},{row:0,column:3},{row:0,column:4},
 {row:1,column:1},{row:1,column:4},{row:1,column:5},
 {row:2,column:1},{row:2,column:3},{row:2,column:5},
];

describe('Quick Quote grid navigation',()=>{
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
});
