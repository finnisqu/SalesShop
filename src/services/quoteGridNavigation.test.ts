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
 it('does not mutate geometry while navigating',()=>{
  const before=JSON.stringify(cells);
  nextQuickGridCell(cells,7,'left');
  nextQuickGridCell(cells,7,'down');
  expect(JSON.stringify(cells)).toBe(before);
 });
});
