import {describe,expect,it} from 'vitest';
import {taskDuePresetDate} from './taskSchedule';
describe('Quick due-date presets',()=>{
 it('keeps today and changes only calendar days',()=>{
   expect(taskDuePresetDate('2026-11-02','today')).toBe('2026-11-02');
   expect(taskDuePresetDate('2026-11-02','tomorrow')).toBe('2026-11-03');
   expect(taskDuePresetDate('2026-11-02','next-week')).toBe('2026-11-09');
 });
 it('handles month, year and leap-day rollover',()=>{
   expect(taskDuePresetDate('2026-12-31','tomorrow')).toBe('2027-01-01');
   expect(taskDuePresetDate('2028-02-28','tomorrow')).toBe('2028-02-29');
 });
 it('clears due date without fabricating a deadline',()=>{
   expect(taskDuePresetDate('2026-11-02','clear')).toBeUndefined();
   expect(taskDuePresetDate('invalid','today')).toBeUndefined();
 });
});
