/** Device-local display preferences. Per-account keys avoid leaking preferences between
 * signed-in users sharing a browser. No organization data or server policy is touched. */
export type DateOrder = 'month-first' | 'day-first' | 'year-first';
export type TimeMode = '12-hour' | '24-hour';
export type WeekStart = 'sunday' | 'monday' | 'saturday';
export type DisplayTimeZone = 'system' | 'America/New_York' | 'America/Chicago'
  | 'America/Denver' | 'America/Los_Angeles' | 'UTC';
export interface PersonalDateTimePreferences {
  dateOrder: DateOrder;
  timeMode: TimeMode;
  weekStart: WeekStart;
  timeZone: DisplayTimeZone;
}
export const DEFAULT_DATE_TIME_PREFERENCES: PersonalDateTimePreferences = {
  dateOrder: 'month-first',
  timeMode: '12-hour',
  weekStart: 'sunday',
  timeZone: 'system',
};
const KEY_ROOT = 'salesshop:personal-datetime-v1:';
const ZONES: readonly DisplayTimeZone[] = [
  'system','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','UTC',
];

export function normalizePersonalDateTimePreferences(value: unknown): PersonalDateTimePreferences {
  if (!value || typeof value !== 'object') return {...DEFAULT_DATE_TIME_PREFERENCES};
  const obj = value as Partial<PersonalDateTimePreferences>;
  return {
    dateOrder: obj.dateOrder === 'day-first' || obj.dateOrder === 'year-first'
      ? obj.dateOrder : 'month-first',
    timeMode: obj.timeMode === '24-hour' ? '24-hour' : '12-hour',
    weekStart: obj.weekStart === 'monday' || obj.weekStart === 'saturday'
      ? obj.weekStart : 'sunday',
    timeZone: ZONES.includes(obj.timeZone as DisplayTimeZone)
      ? obj.timeZone as DisplayTimeZone : 'system',
  };
}

/** Explicitly encode user ownership in the storage key, never organization-wide. */
export function personalDateTimeStorageKey(userId: string | null): string {
  return KEY_ROOT + (userId?.trim() ? encodeURIComponent(userId.trim()) : 'local-preview');
}
export function readPersonalDateTimePreferences(userId: string | null): PersonalDateTimePreferences {
  if (typeof window === 'undefined') return {...DEFAULT_DATE_TIME_PREFERENCES};
  try {
    const raw=window.localStorage.getItem(personalDateTimeStorageKey(userId));
    return normalizePersonalDateTimePreferences(raw ? JSON.parse(raw) : null);
  } catch { return {...DEFAULT_DATE_TIME_PREFERENCES}; }
}
export function savePersonalDateTimePreferences(
  userId: string | null, preferences: PersonalDateTimePreferences,
): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(personalDateTimeStorageKey(userId),
    JSON.stringify(normalizePersonalDateTimePreferences(preferences))); } catch { /* storage optional */ }
}

export function formatPersonalDate(date: Date, preference: PersonalDateTimePreferences): string {
  if (!Number.isFinite(date.getTime())) return '—';
  const tz=preference.timeZone === 'system' ? undefined : preference.timeZone;
  return new Intl.DateTimeFormat(
    preference.dateOrder === 'day-first' ? 'en-GB' : preference.dateOrder === 'year-first' ? 'sv-SE' : 'en-US',
    { year:'numeric', month:'2-digit', day:'2-digit', timeZone:tz },
  ).format(date);
}
export function formatPersonalTime(date: Date, preference: PersonalDateTimePreferences): string {
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour:'numeric', minute:'2-digit', hour12:preference.timeMode === '12-hour',
    timeZone: preference.timeZone === 'system' ? undefined : preference.timeZone,
  }).format(date);
}
export function orderedCalendarDays(start: WeekStart): readonly string[] {
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const n=start === 'monday'?1:start === 'saturday'?6:0;
  return [...days.slice(n),...days.slice(0,n)];
}
