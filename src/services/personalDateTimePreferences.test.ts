import { describe, expect, it } from 'vitest';
import { DEFAULT_DATE_TIME_PREFERENCES, formatPersonalDate,formatPersonalTime,
  normalizePersonalDateTimePreferences, orderedCalendarDays,personalDateTimeStorageKey,
} from './personalDateTimePreferences';

describe('personal date and calendar display settings',()=>{
  it('normalizes unknown values without exposing arbitrary time-zone strings',()=>{
    expect(normalizePersonalDateTimePreferences({dateOrder:'bogus',timeMode:'23-hour',
      weekStart:'Tuesday',timeZone:'Invalid/Zone'})).toEqual(DEFAULT_DATE_TIME_PREFERENCES);
    expect(normalizePersonalDateTimePreferences({
      dateOrder:'year-first',timeMode:'24-hour',weekStart:'monday',timeZone:'America/New_York',
    })).toEqual({dateOrder:'year-first',timeMode:'24-hour',weekStart:'monday',timeZone:'America/New_York'});
  });
  it('never shares the storage key across accounts on the same browser',()=>{
    expect(personalDateTimeStorageKey('owner-1')).not.toBe(personalDateTimeStorageKey('salesperson-2'));
    expect(personalDateTimeStorageKey(null)).not.toBe(personalDateTimeStorageKey('owner-1'));
  });
  it('formats date, time and calendar start without changing the timestamp',()=>{
    const date = new Date('2026-10-14T19:30:00.000Z');
    const prefs={...DEFAULT_DATE_TIME_PREFERENCES,timeZone:'America/New_York' as const,
      dateOrder:'day-first' as const,timeMode:'24-hour' as const,weekStart:'monday' as const};
    expect(formatPersonalDate(date,prefs)).toBe('14/10/2026');
    expect(formatPersonalTime(date,prefs)).toBe('15:30');
    expect(orderedCalendarDays(prefs.weekStart)).toEqual(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
    expect(orderedCalendarDays('saturday')[0]).toBe('Sat');
    expect(date.toISOString()).toBe('2026-10-14T19:30:00.000Z');
  });
  it('falls back for invalid or missing dates',()=>{
    expect(formatPersonalDate(new Date('invalid'),DEFAULT_DATE_TIME_PREFERENCES)).toBe('—');
    expect(formatPersonalTime(new Date('invalid'),DEFAULT_DATE_TIME_PREFERENCES)).toBe('—');
  });
});
