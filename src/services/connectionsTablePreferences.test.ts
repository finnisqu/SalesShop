import {describe,expect,it} from 'vitest';
import {visibleConnectionColumns,compareConnectionSortValues} from './connectionsTablePreferences';
describe('Shared directory table preferences',()=>{
 const fields=['name','status','updated','value'];
 it('restores defaults if all remembered column names were retired',()=>{
   expect(visibleConnectionColumns(['retired'],fields)).toEqual(fields);
 });
 it('deduplicates saved columns and preserves an openable name column',()=>{
   expect(visibleConnectionColumns(['status','status','updated'],fields)).toEqual(['name','status','updated']);
 });
 it('sorts financial numbers and raw ISO dates correctly',()=>{
   expect(compareConnectionSortValues(100,20)).toBeGreaterThan(0);
   expect(compareConnectionSortValues('2026-11-02','2026-10-10')).toBeGreaterThan(0);
 });
});
