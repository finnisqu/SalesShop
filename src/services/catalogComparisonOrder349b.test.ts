import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {reorderCatalogPins,shiftCatalogPin} from './catalogComparisonOrder';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Batch 349b — shared Sinks and OTHER comparison ordering',()=>{
 it('moves a pinned variant before its destination in either direction',()=>{
  const keys=['sink-a:white','sink-b:black','sink-c:gray'];
  expect(reorderCatalogPins(keys,'sink-c:gray','sink-a:white'))
   .toEqual(['sink-c:gray','sink-a:white','sink-b:black']);
  expect(reorderCatalogPins(keys,'sink-a:white','sink-c:gray'))
   .toEqual(['sink-b:black','sink-a:white','sink-c:gray']);
  expect(keys).toEqual(['sink-a:white','sink-b:black','sink-c:gray']);
 });
 it('never recreates removed pins or accepts an unknown drag destination',()=>{
  const keys=['a','b','c'];
  expect(reorderCatalogPins(keys,'missing','a')).toBe(keys);
  expect(reorderCatalogPins(keys,'a','missing')).toBe(keys);
  expect(reorderCatalogPins(keys,'a','a')).toBe(keys);
  expect(reorderCatalogPins(keys,'','a')).toBe(keys);
 });
 it('moves comparison cards by accessible left/right controls without wrapping',()=>{
  const keys=['a','b','c'];
  expect(shiftCatalogPin(keys,'b',-1)).toEqual(['b','a','c']);
  expect(shiftCatalogPin(keys,'b',1)).toEqual(['a','c','b']);
  expect(shiftCatalogPin(keys,'a',-1)).toBe(keys);
  expect(shiftCatalogPin(keys,'c',1)).toBe(keys);
  expect(shiftCatalogPin(keys,'missing',1)).toBe(keys);
  expect(keys).toEqual(['a','b','c']);
 });
 it('both Catalog worktables use the same guarded drop and keyboard-arrow helpers',()=>{
  const sinks=source('src/components/CatalogSinksWorktable.tsx');
  const other=source('src/components/CatalogOtherWorktable.tsx');
  for(const table of [sinks,other]){
   expect(table).toContain('reorderCatalogPins(current,');
   expect(table).toContain('shiftCatalogPin(current,key,direction)');
   expect(table).toContain('disabled={index===0}');
   expect(table).toMatch(/disabled=\{index===\w+\.length-1\}/);
  }
  expect(sinks).toContain('if(dragging)setPins(current=>reorderCatalogPins(current,dragging,key))');
  expect(other).toContain('setPins(current=>reorderCatalogPins(current,source,key))');
 });
});
