import { useEffect, useState } from 'react';
import {
  DEFAULT_DATE_TIME_PREFERENCES, formatPersonalDate, formatPersonalTime,
  orderedCalendarDays, readPersonalDateTimePreferences,
  savePersonalDateTimePreferences, type PersonalDateTimePreferences,
} from '../services/personalDateTimePreferences';

export function PersonalDateTimeSettings({ userId }: { userId: string | null }) {
  const [preferences,setPreferences]=useState<PersonalDateTimePreferences>(()=>readPersonalDateTimePreferences(userId));
  useEffect(()=>setPreferences(readPersonalDateTimePreferences(userId)),[userId]);
  const set=(patch:Partial<PersonalDateTimePreferences>)=>{
    const next={...preferences,...patch};
    setPreferences(next);
    savePersonalDateTimePreferences(userId,next);
  };
  // A static example prevents a rapidly changing clock from creating noisy autosaves.
  const example = new Date('2026-10-14T19:30:00.000Z');
  return <article className="company-settings-card settings-main-card settings-datetime-card">
    <header><div><strong>Date, time &amp; calendar</strong>
      <small>Personal preferences saved on this browser for your account, not the entire company.</small></div></header>
    <div className="settings-datetime-grid">
      <label><span>Date format</span>
        <select aria-label="Preferred date format" value={preferences.dateOrder}
          onChange={event=>set({dateOrder:event.target.value as PersonalDateTimePreferences['dateOrder']})}>
          <option value="month-first">Month / Day / Year</option>
          <option value="day-first">Day / Month / Year</option>
          <option value="year-first">Year – Month – Day</option>
        </select>
      </label>
      <label><span>Time format</span>
        <select aria-label="Preferred time format" value={preferences.timeMode}
          onChange={event=>set({timeMode:event.target.value as PersonalDateTimePreferences['timeMode']})}>
          <option value="12-hour">12-hour · AM/PM</option>
          <option value="24-hour">24-hour</option>
        </select>
      </label>
      <label><span>Week starts on</span>
        <select aria-label="First day of calendar week" value={preferences.weekStart}
          onChange={event=>set({weekStart:event.target.value as PersonalDateTimePreferences['weekStart']})}>
          <option value="sunday">Sunday</option><option value="monday">Monday</option>
          <option value="saturday">Saturday</option>
        </select>
      </label>
      <label><span>Time zone</span>
        <select aria-label="Preferred time zone" value={preferences.timeZone}
          onChange={event=>set({timeZone:event.target.value as PersonalDateTimePreferences['timeZone']})}>
          <option value="system">Use device time zone</option>
          <option value="America/New_York">Eastern (US)</option>
          <option value="America/Chicago">Central (US)</option>
          <option value="America/Denver">Mountain (US)</option>
          <option value="America/Los_Angeles">Pacific (US)</option>
          <option value="UTC">UTC</option>
        </select>
      </label>
    </div>
    <div className="settings-datetime-preview" aria-label="Date and calendar preview">
      <div><small>Example date</small><strong>{formatPersonalDate(example,preferences)}</strong></div>
      <div><small>Example time</small><strong>{formatPersonalTime(example,preferences)}</strong></div>
      <div className="settings-calendar-week"><small>Calendar week</small>
        <div>{orderedCalendarDays(preferences.weekStart).map(day=><span key={day}>{day}</span>)}</div>
      </div>
    </div>
    <div className="settings-inline-actions">
      <button type="button" onClick={()=>set(DEFAULT_DATE_TIME_PREFERENCES)}>Restore date &amp; time defaults</button>
      <span className="settings-muted">Saved on this device · display preview only</span>
    </div>
    <p className="settings-help">Date order and time zone also apply to the Sales Documents list's edited dates. Other calendars and timestamps will adopt these preferences as those workspaces are upgraded; saved document dates and signed records never change.</p>
  </article>;
}
